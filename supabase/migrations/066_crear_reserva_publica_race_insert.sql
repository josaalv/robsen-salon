-- H-13/reserva_error, caso real en producción (28 ago 2026): el chequeo de
-- idempotencia de la migración 063 (SELECT primero, decidir después) tiene
-- una ventana real de carrera — Mercado Pago mandó el aviso de un mismo pago
-- aprobado dos veces casi al mismo tiempo, y ambas invocaciones pasaron el
-- "no existe" antes de que cualquiera terminara de insertar. La segunda
-- falló con "duplicate key value violates unique constraint citas_pkey" —
-- un error real de Postgres, pero un falso positivo de negocio: la cita SÍ
-- se había creado bien por la primera invocación, y el pago SÍ estaba
-- aprobado. El cliente solo vio "no pudimos apartar tu cita, pago seguro"
-- por un anticipo que en realidad sí se agendó.
--
-- El chequeo previo (SELECT ... if found) no se quita — sigue evitando el
-- trabajo de más en el caso común. Lo que se agrega es un manejo de la
-- excepción real de Postgres (unique_violation) justo en el INSERT de
-- citas: si de todos modos choca (la otra invocación ganó la carrera entre
-- nuestro SELECT y nuestro INSERT), se trata como éxito idempotente en vez
-- de dejar propagar el error.

create or replace function public.crear_reserva_publica(p_cita jsonb, p_clienta jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_clienta_id text;
  v_tel_norm text;
  v_ini text;
  v_existente record;
  v_servicio record;
  v_cfg record;
  v_dow int;
  v_minutos int;
begin
  if coalesce(p_cita->>'id','') = '' or coalesce(p_cita->>'h','') = ''
     or coalesce(p_cita->>'fecha','') = '' or coalesce(p_cita->>'est','') = '' then
    raise exception 'Faltan datos de la cita';
  end if;
  if coalesce(p_clienta->>'nombre','') = '' then
    raise exception 'Falta el nombre de la clienta';
  end if;

  select id, cliente_id into v_existente from citas where id = p_cita->>'id';
  if found then
    return jsonb_build_object('cita_id', v_existente.id, 'clienta_id', v_existente.cliente_id);
  end if;

  if p_cita->>'servicio_id' is not null then
    select online, activo into v_servicio from servicios where id = p_cita->>'servicio_id';
    if not found or v_servicio.activo is false or v_servicio.online is false then
      raise exception 'Ese servicio no está disponible para agendar en línea';
    end if;
  end if;

  select agenda_start, agenda_end, dias_abiertos into v_cfg from config where id = 'main';
  if found then
    v_dow := (extract(dow from (p_cita->>'fecha')::date)::int + 6) % 7;
    if not coalesce((v_cfg.dias_abiertos -> v_dow)::boolean, true) then
      raise exception 'El salón no abre ese día';
    end if;
    v_minutos := split_part(p_cita->>'h', ':', 1)::int * 60 + split_part(p_cita->>'h', ':', 2)::int;
    if v_minutos < coalesce(v_cfg.agenda_start, 0) * 60 or v_minutos >= coalesce(v_cfg.agenda_end, 24) * 60 then
      raise exception 'Ese horario está fuera del horario de atención';
    end if;
  end if;

  v_tel_norm := regexp_replace(coalesce(p_clienta->>'tel',''), '[^0-9]', '', 'g');
  if v_tel_norm <> '' then
    select id into v_clienta_id from clientas where tel_normalizado = v_tel_norm limit 1;
  end if;

  if v_clienta_id is null then
    v_ini := upper(
      left(split_part(trim(p_clienta->>'nombre'), ' ', 1), 1) ||
      coalesce(left(split_part(trim(p_clienta->>'nombre'), ' ', 2), 1), '')
    );
    v_clienta_id := 'c' || (extract(epoch from now()) * 1000)::bigint::text;
    begin
      insert into clientas (id, nombre, tel, email, estado, ini, fav, est)
      values (
        v_clienta_id, trim(p_clienta->>'nombre'), nullif(p_clienta->>'tel', ''), nullif(p_clienta->>'email', ''),
        'Nueva', coalesce(nullif(v_ini, ''), '??'), p_cita->>'srv', p_cita->>'est'
      );
    exception when unique_violation then
      -- Mismo tipo de carrera, pero en el teléfono: otra invocación
      -- concurrente ya creó la clienta con ese tel_normalizado entre
      -- nuestro SELECT y este INSERT. Se usa la que ya quedó, en vez de
      -- fallar.
      if v_tel_norm <> '' then
        select id into v_clienta_id from clientas where tel_normalizado = v_tel_norm limit 1;
      end if;
      if v_clienta_id is null then
        raise;
      end if;
    end;
  end if;

  begin
    insert into citas (id, h, dur, cl, cliente_id, tel, email, srv, servicio_id, est, estado, total, ant, notas, fecha)
    values (
      p_cita->>'id', p_cita->>'h', coalesce((p_cita->>'dur')::int, 60), trim(p_clienta->>'nombre'), v_clienta_id,
      nullif(p_clienta->>'tel', ''), nullif(p_clienta->>'email', ''), p_cita->>'srv', nullif(p_cita->>'servicio_id', ''),
      p_cita->>'est', 'pend', coalesce((p_cita->>'total')::numeric, 0), coalesce((p_cita->>'ant')::numeric, 0),
      nullif(p_cita->>'notas', ''), p_cita->>'fecha'
    );
  exception when unique_violation then
    -- La carrera real observada en producción: otra invocación concurrente
    -- (mismo id de cita) ganó entre nuestro SELECT de arriba y este INSERT.
    -- Se confirma que existe y se responde éxito, igual que el chequeo
    -- previo — nunca se pierde el pago ni se le muestra al cliente que
    -- falló algo que en realidad sí funcionó.
    select id, cliente_id into v_existente from citas where id = p_cita->>'id';
    if found then
      return jsonb_build_object('cita_id', v_existente.id, 'clienta_id', v_existente.cliente_id);
    end if;
    raise;
  end;

  return jsonb_build_object('cita_id', p_cita->>'id', 'clienta_id', v_clienta_id);
end;
$function$;

revoke execute on function public.crear_reserva_publica(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.crear_reserva_publica(jsonb, jsonb) to service_role;

create or replace function preview.crear_reserva_publica(p_cita jsonb, p_clienta jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'preview'
as $function$
declare
  v_clienta_id text;
  v_tel_norm text;
  v_ini text;
  v_existente record;
  v_servicio record;
  v_cfg record;
  v_dow int;
  v_minutos int;
begin
  if coalesce(p_cita->>'id','') = '' or coalesce(p_cita->>'h','') = ''
     or coalesce(p_cita->>'fecha','') = '' or coalesce(p_cita->>'est','') = '' then
    raise exception 'Faltan datos de la cita';
  end if;
  if coalesce(p_clienta->>'nombre','') = '' then
    raise exception 'Falta el nombre de la clienta';
  end if;

  select id, cliente_id into v_existente from citas where id = p_cita->>'id';
  if found then
    return jsonb_build_object('cita_id', v_existente.id, 'clienta_id', v_existente.cliente_id);
  end if;

  if p_cita->>'servicio_id' is not null then
    select online, activo into v_servicio from servicios where id = p_cita->>'servicio_id';
    if not found or v_servicio.activo is false or v_servicio.online is false then
      raise exception 'Ese servicio no está disponible para agendar en línea';
    end if;
  end if;

  select agenda_start, agenda_end, dias_abiertos into v_cfg from config where id = 'main';
  if found then
    v_dow := (extract(dow from (p_cita->>'fecha')::date)::int + 6) % 7;
    if not coalesce((v_cfg.dias_abiertos -> v_dow)::boolean, true) then
      raise exception 'El salón no abre ese día';
    end if;
    v_minutos := split_part(p_cita->>'h', ':', 1)::int * 60 + split_part(p_cita->>'h', ':', 2)::int;
    if v_minutos < coalesce(v_cfg.agenda_start, 0) * 60 or v_minutos >= coalesce(v_cfg.agenda_end, 24) * 60 then
      raise exception 'Ese horario está fuera del horario de atención';
    end if;
  end if;

  v_tel_norm := regexp_replace(coalesce(p_clienta->>'tel',''), '[^0-9]', '', 'g');
  if v_tel_norm <> '' then
    select id into v_clienta_id from clientas where tel_normalizado = v_tel_norm limit 1;
  end if;

  if v_clienta_id is null then
    v_ini := upper(
      left(split_part(trim(p_clienta->>'nombre'), ' ', 1), 1) ||
      coalesce(left(split_part(trim(p_clienta->>'nombre'), ' ', 2), 1), '')
    );
    v_clienta_id := 'c' || (extract(epoch from now()) * 1000)::bigint::text;
    begin
      insert into clientas (id, nombre, tel, email, estado, ini, fav, est)
      values (
        v_clienta_id, trim(p_clienta->>'nombre'), nullif(p_clienta->>'tel', ''), nullif(p_clienta->>'email', ''),
        'Nueva', coalesce(nullif(v_ini, ''), '??'), p_cita->>'srv', p_cita->>'est'
      );
    exception when unique_violation then
      if v_tel_norm <> '' then
        select id into v_clienta_id from clientas where tel_normalizado = v_tel_norm limit 1;
      end if;
      if v_clienta_id is null then
        raise;
      end if;
    end;
  end if;

  begin
    insert into citas (id, h, dur, cl, cliente_id, tel, email, srv, servicio_id, est, estado, total, ant, notas, fecha)
    values (
      p_cita->>'id', p_cita->>'h', coalesce((p_cita->>'dur')::int, 60), trim(p_clienta->>'nombre'), v_clienta_id,
      nullif(p_clienta->>'tel', ''), nullif(p_clienta->>'email', ''), p_cita->>'srv', nullif(p_cita->>'servicio_id', ''),
      p_cita->>'est', 'pend', coalesce((p_cita->>'total')::numeric, 0), coalesce((p_cita->>'ant')::numeric, 0),
      nullif(p_cita->>'notas', ''), p_cita->>'fecha'
    );
  exception when unique_violation then
    select id, cliente_id into v_existente from citas where id = p_cita->>'id';
    if found then
      return jsonb_build_object('cita_id', v_existente.id, 'clienta_id', v_existente.cliente_id);
    end if;
    raise;
  end;

  return jsonb_build_object('cita_id', p_cita->>'id', 'clienta_id', v_clienta_id);
end;
$function$;

revoke execute on function preview.crear_reserva_publica(jsonb, jsonb) from public, anon, authenticated;
grant execute on function preview.crear_reserva_publica(jsonb, jsonb) to service_role;

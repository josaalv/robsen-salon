-- H-11 de la auditoría: la interfaz de Booking ya solo deja elegir
-- servicios en línea y horarios dentro de lo configurado — pero
-- crear_reserva_publica es alcanzable server-to-server sin pasar por esa
-- interfaz (booking-crear-reserva, mp-webhook). Defensa en profundidad:
-- se repite la misma validación aquí, no solo confiar en el frontend.

create or replace function public.crear_reserva_publica(p_cita jsonb, p_clienta jsonb)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
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
    insert into clientas (id, nombre, tel, email, estado, ini, fav, est)
    values (
      v_clienta_id, trim(p_clienta->>'nombre'), nullif(p_clienta->>'tel', ''), nullif(p_clienta->>'email', ''),
      'Nueva', coalesce(nullif(v_ini, ''), '??'), p_cita->>'srv', p_cita->>'est'
    );
  end if;

  insert into citas (id, h, dur, cl, cliente_id, tel, email, srv, servicio_id, est, estado, total, ant, notas, fecha)
  values (
    p_cita->>'id', p_cita->>'h', coalesce((p_cita->>'dur')::int, 60), trim(p_clienta->>'nombre'), v_clienta_id,
    nullif(p_clienta->>'tel', ''), nullif(p_clienta->>'email', ''), p_cita->>'srv', nullif(p_cita->>'servicio_id', ''),
    p_cita->>'est', 'pend', coalesce((p_cita->>'total')::numeric, 0), coalesce((p_cita->>'ant')::numeric, 0),
    nullif(p_cita->>'notas', ''), p_cita->>'fecha'
  );

  return jsonb_build_object('cita_id', p_cita->>'id', 'clienta_id', v_clienta_id);
end;
$$;

create or replace function preview.crear_reserva_publica(p_cita jsonb, p_clienta jsonb)
returns jsonb
language plpgsql security definer
set search_path = preview
as $$
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
    insert into clientas (id, nombre, tel, email, estado, ini, fav, est)
    values (
      v_clienta_id, trim(p_clienta->>'nombre'), nullif(p_clienta->>'tel', ''), nullif(p_clienta->>'email', ''),
      'Nueva', coalesce(nullif(v_ini, ''), '??'), p_cita->>'srv', p_cita->>'est'
    );
  end if;

  insert into citas (id, h, dur, cl, cliente_id, tel, email, srv, servicio_id, est, estado, total, ant, notas, fecha)
  values (
    p_cita->>'id', p_cita->>'h', coalesce((p_cita->>'dur')::int, 60), trim(p_clienta->>'nombre'), v_clienta_id,
    nullif(p_clienta->>'tel', ''), nullif(p_clienta->>'email', ''), p_cita->>'srv', nullif(p_cita->>'servicio_id', ''),
    p_cita->>'est', 'pend', coalesce((p_cita->>'total')::numeric, 0), coalesce((p_cita->>'ant')::numeric, 0),
    nullif(p_cita->>'notas', ''), p_cita->>'fecha'
  );

  return jsonb_build_object('cita_id', p_cita->>'id', 'clienta_id', v_clienta_id);
end;
$$;

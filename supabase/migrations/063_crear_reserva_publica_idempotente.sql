-- Mercado Pago puede mandar el aviso de un mismo pago aprobado dos veces
-- casi al mismo tiempo (confirmado con un caso real) — ambas invocaciones
-- del webhook pasan el chequeo de "estado previo" antes de que cualquiera
-- termine de escribir, y las dos intentan crear la MISMA cita. La segunda
-- fallaba con "duplicate key" y quedaba registrada como reserva_error
-- aunque la cita sí se hubiera creado bien por la primera. Se hace la
-- función idempotente por id: si ya existe, se responde éxito sin volver a
-- insertar, en vez de tratarlo como un conflicto real de horario.

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

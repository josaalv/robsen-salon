-- Agendamiento en línea público: acceso anónimo real, pero acotado a tres
-- funciones SECURITY DEFINER — nunca se le da a `anon` un GRANT/RLS directo
-- sobre `citas`/`clientas` (eso expondría nombre/teléfono de las 1345+
-- clientas reales, o permitiría escribir cualquier campo). Mismo patrón ya
-- usado en buscar_usuario_login/crear_venta_con_lineas.

-- 1) Disponibilidad: solo hora/duración/estilista de un día — nunca nombre,
--    teléfono ni notas de la clienta.
create or replace function public.disponibilidad_publica(p_fecha text, p_estilista_id text default null)
returns table(h text, dur int, est text)
language sql security definer stable
set search_path = public
as $$
  select h, dur, est from citas
  where fecha = p_fecha
    and estado <> 'canc'
    and (p_estilista_id is null or est = p_estilista_id)
$$;
grant execute on function public.disponibilidad_publica(text, text) to anon, authenticated;

-- 2) Crear la reserva: encuentra o crea la clienta por teléfono (nunca por
--    nombre — a diferencia del flujo interno, aquí no hay quien confirme
--    visualmente un posible duplicado) e inserta la cita en un solo paso
--    atómico. El trigger de traslape (fn_check_cita_solapada) y el de
--    auditoría siguen aplicando igual que a cualquier otra cita.
create or replace function public.crear_reserva_publica(p_cita jsonb, p_clienta jsonb)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_clienta_id text;
  v_tel_norm text;
  v_ini text;
begin
  if coalesce(p_cita->>'id','') = '' or coalesce(p_cita->>'h','') = ''
     or coalesce(p_cita->>'fecha','') = '' or coalesce(p_cita->>'est','') = '' then
    raise exception 'Faltan datos de la cita';
  end if;
  if coalesce(p_clienta->>'nombre','') = '' then
    raise exception 'Falta el nombre de la clienta';
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
grant execute on function public.crear_reserva_publica(jsonb, jsonb) to anon;

-- 3) Consultar el estado de UN pago propio por su referencia (el id de la
--    cita, que solo conoce quien la creó) — nunca una lista completa de
--    pagos_online.
create or replace function public.consultar_estado_pago_publico(p_referencia text)
returns jsonb
language sql security definer stable
set search_path = public
as $$
  select jsonb_build_object('estado', estado, 'monto', monto)
  from pagos_online where external_reference = p_referencia
  order by actualizado_en desc limit 1
$$;
grant execute on function public.consultar_estado_pago_publico(text) to anon, authenticated;

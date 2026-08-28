-- Espejo en el schema 'preview' de las migraciones 059 (pagos_online) y 060
-- (RPCs públicas de booking). El clon de esquema (057) fue una réplica de
-- una sola vez de las migraciones existentes hasta ese momento — cualquier
-- migración nueva contra 'public' (como 059 y 060) no se propaga sola.
-- Sin este espejo, /preview/booking llamaba a RPCs que solo existían en
-- 'public' (el cliente de preview apunta al schema 'preview'), y por eso
-- el paso 4 del wizard fallaba con "No se pudo agendar la cita" — la
-- función no existía del lado al que preview realmente pregunta.

create table preview.pagos_online (
  id uuid primary key default gen_random_uuid(),
  proveedor text not null default 'mercadopago',
  preference_id text unique,
  payment_id text unique,
  external_reference text not null,
  monto numeric(10,2) not null check (monto > 0),
  estado text not null default 'pendiente'
    check (estado in ('pendiente','aprobado','rechazado','en_proceso','cancelado')),
  raw_status text,
  detalle jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index idx_preview_pagos_online_external_ref on preview.pagos_online(external_reference);
create index idx_preview_pagos_online_estado on preview.pagos_online(estado);
alter table preview.pagos_online enable row level security;
create policy "pagos_online_select_gestion" on preview.pagos_online for select to authenticated
  using (preview.current_rol() in ('admin','gerente','recepcion'));
create trigger trg_audit_pagos_online after insert or update or delete on preview.pagos_online
  for each row execute function preview.fn_audit_log();

-- 1) Disponibilidad
create or replace function preview.disponibilidad_publica(p_fecha text, p_estilista_id text default null)
returns table(h text, dur int, est text)
language sql security definer stable
set search_path = preview
as $$
  select h, dur, est from citas
  where fecha = p_fecha
    and estado <> 'canc'
    and (p_estilista_id is null or est = p_estilista_id)
$$;
grant execute on function preview.disponibilidad_publica(text, text) to anon, authenticated;

-- 2) Crear la reserva
create or replace function preview.crear_reserva_publica(p_cita jsonb, p_clienta jsonb)
returns jsonb
language plpgsql security definer
set search_path = preview
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
grant execute on function preview.crear_reserva_publica(jsonb, jsonb) to anon;

-- 3) Consultar estado de pago
create or replace function preview.consultar_estado_pago_publico(p_referencia text)
returns jsonb
language sql security definer stable
set search_path = preview
as $$
  select jsonb_build_object('estado', estado, 'monto', monto)
  from pagos_online where external_reference = p_referencia
  order by actualizado_en desc limit 1
$$;
grant execute on function preview.consultar_estado_pago_publico(text) to anon, authenticated;

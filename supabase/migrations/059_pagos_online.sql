-- Registro de pagos en línea (anticipos de citas vía Mercado Pago).
-- No hay escritura directa de anon/authenticated aquí — todo pasa por las
-- Edge Functions (mp-crear-preferencia crea el pendiente, mp-webhook lo
-- actualiza con service role), igual que ya se hace con wa_mensajes.
create table pagos_online (
  id uuid primary key default gen_random_uuid(),
  proveedor text not null default 'mercadopago',
  preference_id text unique,
  payment_id text unique,
  -- referencia libre a lo que se está cobrando (id de cita/citaFutura por
  -- ahora) — texto, no FK: las citas públicas aún no tienen su tabla
  -- definitiva y esto no debe bloquear su evolución futura.
  external_reference text not null,
  monto numeric(10,2) not null check (monto > 0),
  estado text not null default 'pendiente'
    check (estado in ('pendiente','aprobado','rechazado','en_proceso','cancelado')),
  raw_status text,
  detalle jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index idx_pagos_online_external_ref on pagos_online(external_reference);
create index idx_pagos_online_estado on pagos_online(estado);

alter table pagos_online enable row level security;

-- Solo gestión interna puede consultar el estado de los pagos.
create policy "pagos_online_select_gestion" on pagos_online for select to authenticated
  using (current_rol() in ('admin','gerente','recepcion'));

-- fn_audit_log ya cubre citas/ventas/etc.; se agrega pagos_online a la
-- misma auditoría por ser dinero real.
create trigger trg_audit_pagos_online after insert or update or delete on pagos_online
  for each row execute function fn_audit_log();

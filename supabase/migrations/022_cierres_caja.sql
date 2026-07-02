create table cierres_caja (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  usuario_id text references usuarios(id),
  usuario_nombre text,
  total_efectivo numeric(10,2) not null default 0,
  total_transferencia numeric(10,2) not null default 0,
  total_tarjeta numeric(10,2) not null default 0,
  total_pendiente numeric(10,2) not null default 0,
  anticipos_cobrados numeric(10,2) not null default 0,
  saldos_cobrados numeric(10,2) not null default 0,
  ventas_total numeric(10,2) not null default 0,
  efectivo_contado numeric(10,2),
  diferencia numeric(10,2),
  notas text,
  cerrado_en timestamptz not null default now()
);
create index idx_cierres_caja_fecha on cierres_caja(fecha desc);

alter table cierres_caja enable row level security;

-- Es un libro de cierres: se puede crear y consultar, nunca editar ni borrar.
create policy "cierres_caja_select" on cierres_caja for select to authenticated
  using (public.current_rol() in ('admin','gerente','recepcion'));

create policy "cierres_caja_insert" on cierres_caja for insert to authenticated
  with check (public.current_rol() in ('admin','gerente','recepcion'));

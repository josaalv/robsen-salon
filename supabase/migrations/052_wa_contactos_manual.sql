-- "Contactado" manual compartido: reemplaza el localStorage por-navegador de
-- Seguimiento (WA_CONTACTADOS_KEY) por un registro real en la base, visible
-- para todo el equipo y con quién/cuándo lo marcó. item_id usa el mismo
-- identificador compuesto que ya arma el frontend por sección (p. ej.
-- "<clientaId>_pv", "<citaId>", "<ventaId>", "<clientaId>_r_mechas"...).
create table if not exists wa_contactos_manual (
  item_id         text primary key,
  contactado_por  text,
  contactado_at   timestamptz not null default now()
);

alter table wa_contactos_manual enable row level security;

create policy wa_contactos_manual_rw on wa_contactos_manual
  for all to authenticated
  using  (current_rol() = any (array['admin','gerente','recepcion']))
  with check (current_rol() = any (array['admin','gerente','recepcion']));

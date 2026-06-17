-- Robsen — Row Level Security (RLS) policies
-- Implementar después de conectar Supabase Auth

-- ================================================
-- HABILITAR RLS EN TODAS LAS TABLAS
-- ================================================
alter table estilistas      enable row level security;
alter table clientas        enable row level security;
alter table servicios       enable row level security;
alter table productos       enable row level security;
alter table citas           enable row level security;
alter table ventas          enable row level security;
alter table venta_lineas    enable row level security;
alter table movimientos_inv enable row level security;
alter table mensajes_wa     enable row level security;
alter table plantillas_wa   enable row level security;
alter table usuarios        enable row level security;

-- ================================================
-- HELPER: obtener el rol del usuario actual
-- ================================================
create or replace function get_user_role()
returns text as $$
  select rol from usuarios where email = auth.email()
$$ language sql security definer;

-- ================================================
-- POLÍTICAS POR TABLA
-- ================================================

-- ESTILISTAS: todos los roles autenticados pueden leer; solo admin/gerente pueden modificar
create policy "estilistas_read"   on estilistas for select using (auth.uid() is not null);
create policy "estilistas_write"  on estilistas for all    using (get_user_role() in ('admin','gerente'));

-- CLIENTAS: todos pueden leer; recepcion y superior pueden modificar
create policy "clientas_read"     on clientas for select using (auth.uid() is not null);
create policy "clientas_write"    on clientas for all    using (get_user_role() in ('admin','gerente','recepcion'));

-- SERVICIOS: todos pueden leer; admin/gerente pueden modificar
create policy "servicios_read"    on servicios for select using (auth.uid() is not null);
create policy "servicios_write"   on servicios for all   using (get_user_role() in ('admin','gerente'));

-- PRODUCTOS: todos pueden leer; admin/gerente/recepcion pueden modificar
create policy "productos_read"    on productos for select using (auth.uid() is not null);
create policy "productos_write"   on productos for all   using (get_user_role() in ('admin','gerente','recepcion'));

-- CITAS: todos pueden ver; recepcion y superior pueden modificar
create policy "citas_read"        on citas for select using (auth.uid() is not null);
create policy "citas_write"       on citas for all   using (get_user_role() in ('admin','gerente','recepcion'));

-- VENTAS: todos pueden ver; recepcion y superior pueden crear; solo admin/gerente eliminan
create policy "ventas_read"       on ventas for select using (auth.uid() is not null);
create policy "ventas_insert"     on ventas for insert with check (get_user_role() in ('admin','gerente','recepcion'));
create policy "ventas_update"     on ventas for update using (get_user_role() in ('admin','gerente','recepcion'));
create policy "ventas_delete"     on ventas for delete using (get_user_role() in ('admin','gerente'));

-- VENTA LINEAS: acceso ligado a ventas
create policy "venta_lineas_read"   on venta_lineas for select using (auth.uid() is not null);
create policy "venta_lineas_write"  on venta_lineas for all   using (get_user_role() in ('admin','gerente','recepcion'));

-- MOVIMIENTOS: solo lectura para todos; write via trigger
create policy "movimientos_read"    on movimientos_inv for select using (auth.uid() is not null);
create policy "movimientos_insert"  on movimientos_inv for insert with check (auth.uid() is not null);

-- MENSAJES WA: todos pueden leer y crear; solo admin/gerente eliminan
create policy "mensajes_read"       on mensajes_wa for select using (auth.uid() is not null);
create policy "mensajes_write"      on mensajes_wa for insert with check (auth.uid() is not null);
create policy "mensajes_update"     on mensajes_wa for update using (auth.uid() is not null);

-- PLANTILLAS WA: todos pueden leer; admin/gerente modifican
create policy "plantillas_read"     on plantillas_wa for select using (auth.uid() is not null);
create policy "plantillas_write"    on plantillas_wa for all   using (get_user_role() in ('admin','gerente'));

-- USUARIOS: solo admin puede gestionar usuarios; cada uno puede ver el propio
create policy "usuarios_self"       on usuarios for select using (email = auth.email());
create policy "usuarios_admin_read" on usuarios for select using (get_user_role() = 'admin');
create policy "usuarios_admin_write"on usuarios for all   using (get_user_role() = 'admin');

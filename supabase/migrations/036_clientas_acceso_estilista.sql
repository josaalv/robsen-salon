-- Cuando el administrador habilita el módulo de Clientas para el rol estilista,
-- este necesita acceso real: ver toda la base y dar de alta / editar. Antes RLS
-- solo dejaba al estilista ver las clientas de sus propias citas y nada de
-- escritura, así que el módulo aparecía pero no funcionaba.

-- Lectura: cualquier usuario activo puede ver la base de clientas (igual que
-- servicios/productos). El módulo se controla en la app por permisos de rol.
drop policy if exists clientas_select on clientas;
create policy clientas_select on clientas
  for select to authenticated
  using (is_active());

-- Escritura (alta / edición / borrado): se agrega estilista a los roles con
-- acceso completo, al mismo nivel que recepción.
drop policy if exists clientas_write_gestion on clientas;
create policy clientas_write_gestion on clientas
  for all to authenticated
  using  (current_rol() = any (array['admin','gerente','recepcion','estilista']))
  with check (current_rol() = any (array['admin','gerente','recepcion','estilista']));

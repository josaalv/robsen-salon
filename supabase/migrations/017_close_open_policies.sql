-- Cierra el hueco real: quita las políticas anon_all (USING true) que dejaban
-- todas las tablas abiertas a cualquiera con la anon key. Se agregan solo las
-- lecturas anónimas mínimas que la app necesita (picker de login y catálogo
-- público de servicios/estilistas/config).

drop policy if exists "anon_all" on bloqueos;
drop policy if exists "anon_all" on citas;
drop policy if exists "anon_all" on clientas;
drop policy if exists "anon_all" on config;
drop policy if exists "anon_all" on estilistas;
drop policy if exists "anon_all" on gastos;
drop policy if exists "anon_all" on lineas_venta;
drop policy if exists "anon_all" on movimientos;
drop policy if exists "anon_all" on plantillas;
drop policy if exists "anon_all" on productos;
drop policy if exists "anon_all" on servicios;
drop policy if exists "anon_all" on usuarios;
drop policy if exists "anon_all" on ventas;
drop policy if exists "reset_tokens_all" on reset_tokens;

-- Lecturas anónimas mínimas necesarias:
-- picker de login (sin contraseña, esa columna se elimina en la siguiente migración)
create policy "usuarios_select_anon_login" on usuarios for select to anon using (true);
-- catálogo público (sin datos de clientas ni cifras del negocio)
create policy "servicios_select_anon" on servicios for select to anon using (true);
create policy "estilistas_select_anon" on estilistas for select to anon using (true);
create policy "config_select_anon" on config for select to anon using (true);

-- Storage: solo lectura pública; escritura/edición/borrado exigen sesión real.
drop policy if exists "media_insert" on storage.objects;
drop policy if exists "media_update" on storage.objects;
drop policy if exists "media_delete" on storage.objects;

create policy "media_insert_authenticated" on storage.objects for insert to authenticated
  with check (bucket_id = 'media');
create policy "media_update_authenticated" on storage.objects for update to authenticated
  using (bucket_id = 'media') with check (bucket_id = 'media');
create policy "media_delete_authenticated" on storage.objects for delete to authenticated
  using (bucket_id = 'media');

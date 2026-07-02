-- Auditoría pre-release: cierra una filtración real de PII y endurece storage.
--
-- 1) El picker de login (anon, antes de autenticar) hacía select('*') sobre
--    usuarios, exponiendo tel/auth_user_id/estilista_id de todo el personal
--    (confirmado con curl real usando solo la anon key). Se reemplaza por una
--    vista con solo las columnas necesarias para elegir perfil + iniciar
--    sesión, y una función para buscar por correo/teléfono sin exponer la
--    tabla completa.
create view public.usuarios_publicos as
select id, nombre, rol, ini, color, avatar, activo, email
from public.usuarios
where auth_user_id is not null;

grant select on public.usuarios_publicos to anon;

drop policy if exists "usuarios_select_anon_login" on public.usuarios;

create or replace function public.buscar_usuario_login(q text)
returns table(id text, nombre text, rol text, ini text, color text, avatar text, activo boolean, email text)
language sql security definer stable
set search_path = public
as $$
  select u.id, u.nombre, u.rol, u.ini, u.color, u.avatar, u.activo, u.email
  from usuarios u
  where u.auth_user_id is not null
    and u.activo = true
    and (
      lower(u.email) = lower(q)
      or regexp_replace(coalesce(u.tel,''), '[^0-9]', '', 'g') = regexp_replace(q, '[^0-9]', '', 'g')
    )
  limit 1
$$;

grant execute on function public.buscar_usuario_login(text) to anon;

-- 2) Storage: el bucket "media" es público (necesario para logo/avatares/
--    fotos de estilistas en la página pública de reservas), pero tenía una
--    política de SELECT abierta que permitía LISTAR todo su contenido, no
--    solo obtener un archivo por URL conocida (el fetch por URL pública no
--    depende de esta política, es una propiedad del bucket). Se elimina esa
--    política de listado; nada en el frontend depende de listar el bucket.
drop policy if exists "media_select" on storage.objects;

-- 3) Fotos antes/después de clientas: no deben vivir en un bucket público.
--    Se crea un bucket privado nuevo para eso (no había ninguna foto subida
--    todavía, así que no hay nada que migrar). El código del frontend se
--    actualiza en el mismo cambio para subir/leer desde aquí con URLs
--    firmadas en vez de URLs públicas.
insert into storage.buckets (id, name, public)
values ('fotos-clientas', 'fotos-clientas', false)
on conflict (id) do nothing;

create policy "fotos_clientas_select_authenticated" on storage.objects for select to authenticated
  using (bucket_id = 'fotos-clientas');
create policy "fotos_clientas_insert_authenticated" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos-clientas');
create policy "fotos_clientas_update_authenticated" on storage.objects for update to authenticated
  using (bucket_id = 'fotos-clientas') with check (bucket_id = 'fotos-clientas');
create policy "fotos_clientas_delete_authenticated" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos-clientas');

-- 4) reset_tokens: sistema de recuperación por token propio, reemplazado por
--    Supabase Auth hace varias migraciones. Tenía RLS activo sin políticas
--    (nadie podía leerla vía API, no era explotable), pero es basura que ya
--    no debería seguir en el esquema de producción. El código que la
--    consumía ya se eliminó del frontend en esta misma sesión.
drop table if exists public.reset_tokens;

-- Nota deliberada: el advisor de seguridad también marca current_rol(),
-- current_estilista_id() e is_active() como SECURITY DEFINER ejecutables
-- vía RPC directo por anon/authenticated. NO se revoca ese EXECUTE: casi
-- todas las políticas RLS de authenticated dependen de current_rol(), y
-- revocar su ejecución directa rompería el acceso de TODA la app para
-- usuarios autenticados (la evaluación de políticas RLS sí requiere permiso
-- de EXECUTE sobre las funciones que referencia). El riesgo real para anon
-- es prácticamente nulo (auth.uid() es null sin sesión, así que devuelven
-- null/false, no filtran nada), así que se documenta como aceptado en vez
-- de arriesgar una regresión total por un beneficio marginal.

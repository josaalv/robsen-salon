-- El advisor de seguridad marca como ERROR cualquier vista que no declare
-- security_invoker, porque por defecto una vista corre con los privilegios
-- de quien la creó y puede saltarse el RLS de la tabla base sin que se note.
-- En este caso es intencional (anon ya no tiene ninguna política de SELECT
-- en `usuarios`, así que con security_invoker el picker de login quedaría
-- vacío) — pero el patrón que Supabase espera para "exponer una porción
-- curada de datos a anon" es una función SECURITY DEFINER, igual que ya se
-- usa en buscar_usuario_login(), no una vista. Se reemplaza la vista por una
-- función equivalente para que el lint quede limpio sin cambiar el resultado.

drop view if exists public.usuarios_publicos;

create or replace function public.listar_usuarios_publicos()
returns table(id text, nombre text, rol text, ini text, color text, avatar text, activo boolean, email text)
language sql security definer stable
set search_path = public
as $$
  select u.id, u.nombre, u.rol, u.ini, u.color, u.avatar, u.activo, u.email
  from usuarios u
  where u.auth_user_id is not null
$$;

grant execute on function public.listar_usuarios_publicos() to anon;

-- El picker de login mostraba todos los perfiles activos, aunque no tuvieran
-- cuenta de Supabase Auth vinculada todavía (ej. Recepción). Se limita a los
-- perfiles que sí pueden iniciar sesión de verdad.
drop policy if exists "usuarios_select_anon_login" on usuarios;

create policy "usuarios_select_anon_login" on usuarios for select to anon
  using (auth_user_id is not null);

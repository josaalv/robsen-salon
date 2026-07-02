-- Robsen — Fundamento para migrar a Supabase Auth con roles reales
-- Aditivo y seguro: no borra ni modifica datos existentes.

alter table usuarios add column if not exists auth_user_id uuid unique references auth.users(id);
alter table usuarios add column if not exists estilista_id text references estilistas(id);
alter table ventas   add column if not exists saldo_cobrado_en timestamptz;

-- ── Helpers de rol, usados por las políticas RLS reales (migración 016) ──
create or replace function public.current_rol()
returns text
language sql security definer stable
set search_path = public
as $$
  select rol from usuarios where auth_user_id = auth.uid() and activo = true
$$;

create or replace function public.current_estilista_id()
returns text
language sql security definer stable
set search_path = public
as $$
  select estilista_id from usuarios where auth_user_id = auth.uid() and activo = true
$$;

create or replace function public.is_active()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select coalesce((select activo from usuarios where auth_user_id = auth.uid()), false)
$$;

grant execute on function public.current_rol() to anon, authenticated;
grant execute on function public.current_estilista_id() to anon, authenticated;
grant execute on function public.is_active() to anon, authenticated;

-- Auditoría mínima: quién cambió qué, cuándo, y con qué valores.
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  usuario_id text references usuarios(id),
  usuario_nombre text,
  accion text not null check (accion in ('insert','update','delete')),
  tabla text not null,
  registro_id text not null,
  valores_antes jsonb,
  valores_despues jsonb,
  creado_en timestamptz not null default now()
);
create index idx_audit_logs_tabla_registro on audit_logs(tabla, registro_id);
create index idx_audit_logs_creado_en on audit_logs(creado_en desc);

alter table audit_logs enable row level security;

-- Solo admin/gerente pueden leer el historial. Nadie escribe directo:
-- solo el trigger (SECURITY DEFINER) inserta filas aquí.
create policy "audit_logs_select_gestion" on audit_logs for select to authenticated
  using (public.current_rol() in ('admin','gerente'));

create or replace function public.fn_audit_log()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_usuario_id text;
  v_usuario_nombre text;
  v_registro_id text;
begin
  select id, nombre into v_usuario_id, v_usuario_nombre from usuarios where auth_user_id = auth.uid();

  if tg_op = 'DELETE' then
    v_registro_id := old.id::text;
    insert into audit_logs (usuario_id, usuario_nombre, accion, tabla, registro_id, valores_antes, valores_despues)
    values (v_usuario_id, v_usuario_nombre, 'delete', tg_table_name, v_registro_id, to_jsonb(old), null);
    return old;
  elsif tg_op = 'UPDATE' then
    v_registro_id := new.id::text;
    insert into audit_logs (usuario_id, usuario_nombre, accion, tabla, registro_id, valores_antes, valores_despues)
    values (v_usuario_id, v_usuario_nombre, 'update', tg_table_name, v_registro_id, to_jsonb(old), to_jsonb(new));
    return new;
  else
    v_registro_id := new.id::text;
    insert into audit_logs (usuario_id, usuario_nombre, accion, tabla, registro_id, valores_antes, valores_despues)
    values (v_usuario_id, v_usuario_nombre, 'insert', tg_table_name, v_registro_id, null, to_jsonb(new));
    return new;
  end if;
end;
$$;

create trigger trg_audit_citas      after insert or update or delete on citas      for each row execute function public.fn_audit_log();
create trigger trg_audit_ventas     after insert or update or delete on ventas     for each row execute function public.fn_audit_log();
create trigger trg_audit_servicios  after insert or update or delete on servicios  for each row execute function public.fn_audit_log();
create trigger trg_audit_usuarios   after insert or update or delete on usuarios   for each row execute function public.fn_audit_log();
create trigger trg_audit_clientas   after insert or update or delete on clientas   for each row execute function public.fn_audit_log();

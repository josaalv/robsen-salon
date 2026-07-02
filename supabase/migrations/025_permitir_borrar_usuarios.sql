-- Permite borrar un usuario aunque tenga historial: el nombre queda
-- guardado como texto en audit_logs/cierres_caja (ya se captura al
-- momento del registro), solo se pierde la referencia al id.
alter table audit_logs drop constraint audit_logs_usuario_id_fkey;
alter table audit_logs add constraint audit_logs_usuario_id_fkey
  foreign key (usuario_id) references usuarios(id) on delete set null;

alter table cierres_caja drop constraint cierres_caja_usuario_id_fkey;
alter table cierres_caja add constraint cierres_caja_usuario_id_fkey
  foreign key (usuario_id) references usuarios(id) on delete set null;

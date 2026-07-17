-- Quita el permiso por defecto a PUBLIC (que incluye anon/authenticated) y deja
-- ejecutable solo lo necesario:
--  - wa_inbound: la invoca el webhook con service_role.
--  - wa_encolar: la invoca el cron (superusuario); no necesita rol público.
revoke all on function wa_inbound(text, text) from public;
revoke all on function wa_encolar() from public;
grant execute on function wa_inbound(text, text) to service_role;

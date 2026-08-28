-- H-12 de la auditoría: crear_reserva_publica era llamable directo con la
-- anon key (pública por diseño) sin ningún límite ni verificación humana —
-- cualquiera podía automatizar la creación de citas/clientas falsas.
--
-- Se cierra el acceso directo de anon/authenticated/PUBLIC y se deja solo
-- para service_role — de ahora en adelante únicamente se llama del lado
-- del servidor: por mp-webhook (pago confirmado, que ya es su propia
-- barrera de costo real) o por la nueva función booking-crear-reserva
-- (verifica reCAPTCHA antes de llamarla, para el camino sin anticipo).
-- Mismo patrón ya usado en fn_audit_log (024_endurecer_funciones.sql).

revoke execute on function public.crear_reserva_publica(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.crear_reserva_publica(jsonb, jsonb) to service_role;

revoke execute on function preview.crear_reserva_publica(jsonb, jsonb) from public, anon, authenticated;
grant execute on function preview.crear_reserva_publica(jsonb, jsonb) to service_role;

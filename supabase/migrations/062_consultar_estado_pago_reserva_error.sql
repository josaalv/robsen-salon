-- Si el pago se aprueba pero agendar la cita falla del lado del servidor
-- (ej. alguien más tomó ese horario mientras se pagaba), mp-webhook deja
-- constancia en detalle.reserva_error. Sin exponerlo aquí, la pantalla de
-- resumen le diría "¡Reserva confirmada!" a alguien que sí pagó pero cuya
-- cita nunca se creó — un caso raro, pero de dinero real, no se puede
-- quedar en silencio.
create or replace function public.consultar_estado_pago_publico(p_referencia text)
returns jsonb
language sql security definer stable
set search_path = public
as $$
  select jsonb_build_object('estado', estado, 'monto', monto, 'reserva_error', detalle->>'reserva_error')
  from pagos_online where external_reference = p_referencia
  order by actualizado_en desc limit 1
$$;

create or replace function preview.consultar_estado_pago_publico(p_referencia text)
returns jsonb
language sql security definer stable
set search_path = preview
as $$
  select jsonb_build_object('estado', estado, 'monto', monto, 'reserva_error', detalle->>'reserva_error')
  from pagos_online where external_reference = p_referencia
  order by actualizado_en desc limit 1
$$;

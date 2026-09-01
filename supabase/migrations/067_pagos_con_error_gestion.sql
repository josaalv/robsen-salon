-- H-15 de la auditoría: el caso borde de un pago aprobado pero la cita sin
-- poder agendarse (reserva_error en pagos_online.detalle) solo se podía ver
-- consultando la base a mano — pasó de verdad más de una vez esta sesión
-- (condición de carrera de webhooks duplicados, ya corregida en 066) y cada
-- vez alguien tuvo que acordarse de ir a revisar Supabase directamente.
--
-- Dos RPCs SECURITY INVOKER (corren con los permisos del usuario que
-- llama, no con privilegios elevados) — la política de SELECT que ya
-- existe (admin/gerente/recepcion) es suficiente para leer; se agrega la
-- de UPDATE para poder marcarlo resuelto.

create or replace function public.listar_pagos_con_error()
returns setof pagos_online
language sql
stable
security invoker
set search_path = 'public'
as $function$
  select * from pagos_online
  where detalle ? 'reserva_error'
    and coalesce((detalle->>'resuelto')::boolean, false) = false
  order by coalesce(actualizado_en, creado_en) desc;
$function$;

create or replace function public.marcar_pago_error_resuelto(p_id uuid)
returns void
language sql
security invoker
set search_path = 'public'
as $function$
  update pagos_online set detalle = detalle || jsonb_build_object('resuelto', true) where id = p_id;
$function$;

create policy pagos_online_update_gestion on public.pagos_online
  for update to authenticated
  using (current_rol() = any (array['admin','gerente','recepcion']))
  with check (current_rol() = any (array['admin','gerente','recepcion']));

create or replace function preview.listar_pagos_con_error()
returns setof preview.pagos_online
language sql
stable
security invoker
set search_path = 'preview'
as $function$
  select * from pagos_online
  where detalle ? 'reserva_error'
    and coalesce((detalle->>'resuelto')::boolean, false) = false
  order by coalesce(actualizado_en, creado_en) desc;
$function$;

create or replace function preview.marcar_pago_error_resuelto(p_id uuid)
returns void
language sql
security invoker
set search_path = 'preview'
as $function$
  update pagos_online set detalle = detalle || jsonb_build_object('resuelto', true) where id = p_id;
$function$;

create policy pagos_online_update_gestion on preview.pagos_online
  for update to authenticated
  using (current_rol() = any (array['admin','gerente','recepcion']))
  with check (current_rol() = any (array['admin','gerente','recepcion']));

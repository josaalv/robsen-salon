-- Resuelve el clic de un botón de respuesta rápida dentro de una PLANTILLA
-- aprobada (recordatorio_24h con botones Confirmar/Cancelar). A diferencia
-- del mensaje interactivo libre de la prueba (que llevaba el citaId embebido
-- en el id del botón), el payload de un botón de plantilla es fijo — el
-- mismo texto para cualquiera que la reciba — así que aquí se resuelve la
-- cita por teléfono + el recordatorio_24h más reciente que se le mandó.
create or replace function wa_resolver_boton_plantilla(p_from text, p_accion text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last10  text := right(regexp_replace(coalesce(p_from,''), '\D', '', 'g'), 10);
  v_cita_id text;
begin
  if v_last10 = '' or p_accion not in ('confirmar','cancelar') then
    return jsonb_build_object('actualizada', false);
  end if;

  select m.cita_id into v_cita_id
  from wa_mensajes m
  where m.flujo = 'recordatorio_24h'
    and m.estado in ('enviado','entregado','leido')
    and right(regexp_replace(coalesce(m.tel,''),'\D','','g'),10) = v_last10
    and m.cita_id is not null
  order by m.created_at desc
  limit 1;

  if v_cita_id is null then
    return jsonb_build_object('actualizada', false);
  end if;

  update citas set estado = case when p_accion = 'confirmar' then 'conf' else 'canc' end
  where id = v_cita_id;

  return jsonb_build_object('actualizada', true, 'cita_id', v_cita_id);
end $$;

revoke all on function wa_resolver_boton_plantilla(text, text) from public, anon, authenticated;

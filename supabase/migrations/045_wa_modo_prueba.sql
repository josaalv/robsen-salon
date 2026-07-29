-- Modo prueba para el envío real de WhatsApp: mientras esté activo, el
-- encolado automático (wa_encolar, cron diario) no genera mensajes para
-- teléfonos distintos de wa_test_tel, y wa-enviar (el único punto por el
-- que sale cualquier mensaje real a Meta) filtra por ese mismo teléfono
-- antes de enviar, sin importar cómo haya llegado el mensaje a la cola.
-- Arranca en true y con el teléfono del admin, para poder probar todo el
-- flujo end-to-end sin riesgo de que le llegue algo a una clienta real.
alter table config add column if not exists wa_modo_prueba boolean not null default true;
alter table config add column if not exists wa_test_tel text;

update config
  set wa_test_tel = (select tel from usuarios where rol = 'admin' and activo = true order by id limit 1)
  where id = 'main' and wa_test_tel is null;

-- wa_encolar(): mismo cuerpo que 039, con el filtro de modo prueba agregado
-- a los dos flujos automáticos (recordatorio_24h y cumpleaños). El match de
-- teléfono usa los últimos 10 dígitos, igual que wa_inbound (038).
create or replace function wa_encolar()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoy      date := (now() at time zone 'America/Mexico_City')::date;
  v_manana   text := to_char(v_hoy + 1, 'YYYY-MM-DD');
  v_meses    text[] := array['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  v_mes      text := v_meses[extract(month from v_hoy)::int];
  v_dia      int  := extract(day from v_hoy)::int;
  v_n        int  := 0;
  v_c        int  := 0;
  v_prueba   boolean;
  v_test10   text;
begin
  select wa_modo_prueba, right(regexp_replace(coalesce(wa_test_tel,''),'\D','','g'),10)
    into v_prueba, v_test10
    from config where id = 'main';

  -- Recordatorio 24h para las citas de mañana.
  insert into wa_mensajes (clienta_id, tel, flujo, plantilla, variables, cuerpo, estado, requiere_aprobacion, cita_id, creado_por)
  select cl.id,
         coalesce(nullif(ci.tel,''), cl.tel),
         'recordatorio_24h', 'recordatorio_24h',
         jsonb_build_object('1', split_part(coalesce(cl.nombre, ci.cl),' ',1),
                            '2', ci.srv, '3', ci.h,
                            '4', coalesce(split_part(e.nombre,' ',1),'tu estilista')),
         format('¡Hola %s! Te recordamos tu cita de %s mañana a las %s con %s. Responde CONFIRMO para confirmar tu asistencia. ✨',
                split_part(coalesce(cl.nombre, ci.cl),' ',1), ci.srv, ci.h, coalesce(split_part(e.nombre,' ',1),'tu estilista')),
         'aprobado', false, ci.id, 'cron'
  from citas ci
  left join clientas cl  on cl.id = ci.cliente_id
  left join estilistas e on e.id = ci.est
  where ci.fecha = v_manana
    and ci.estado in ('pend','conf')
    and coalesce(cl.wa_optin, true) = true
    and coalesce(nullif(ci.tel,''), cl.tel) is not null
    and (not v_prueba or right(regexp_replace(coalesce(nullif(ci.tel,''), cl.tel),'\D','','g'),10) = v_test10)
    and not exists (select 1 from wa_mensajes m
                    where m.flujo='recordatorio_24h' and m.cita_id = ci.id and m.estado <> 'cancelado');
  get diagnostics v_n = row_count;

  -- Cumpleaños de hoy.
  insert into wa_mensajes (clienta_id, tel, flujo, plantilla, variables, cuerpo, estado, requiere_aprobacion, creado_por)
  select cl.id, cl.tel, 'cumpleanos', 'cumpleanos',
         jsonb_build_object('1', split_part(cl.nombre,' ',1)),
         format('¡Feliz cumpleaños, %s! 🎂🎉 Todo el equipo de Robsen Salón & Spa te desea un día increíble. Ven a consentirte: tienes un regalo especial esperándote 🎁',
                split_part(cl.nombre,' ',1)),
         'aprobado', false, 'cron'
  from clientas cl
  where cl.tel is not null and cl.tel <> ''
    and coalesce(cl.wa_optin, true) = true
    and cl.cumple ~ '^[0-9]+ '
    and split_part(cl.cumple,' ',2) = v_mes
    and (split_part(cl.cumple,' ',1))::int = v_dia
    and (not v_prueba or right(regexp_replace(coalesce(cl.tel,''),'\D','','g'),10) = v_test10)
    and not exists (select 1 from wa_mensajes m
                    where m.flujo='cumpleanos' and m.clienta_id = cl.id
                      and (m.created_at at time zone 'America/Mexico_City')::date = v_hoy);
  get diagnostics v_c = row_count;

  return v_n + v_c;
end $$;

revoke all on function wa_encolar() from anon, authenticated;

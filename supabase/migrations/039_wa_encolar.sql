-- Encola automáticamente los mensajes rutinarios (recordatorio 24h y
-- cumpleaños) como 'aprobado', respetando el opt-in y evitando duplicados.
-- Los sensibles (reactivación) siguen encolándose desde la app con aprobación.
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
begin
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
    and not exists (select 1 from wa_mensajes m
                    where m.flujo='cumpleanos' and m.clienta_id = cl.id
                      and (m.created_at at time zone 'America/Mexico_City')::date = v_hoy);
  get diagnostics v_c = row_count;

  return v_n + v_c;
end $$;

revoke all on function wa_encolar() from anon, authenticated;

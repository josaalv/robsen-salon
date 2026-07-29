-- Extiende wa_encolar() para cubrir también reactivación (antes solo vivía en
-- el botón manual de JS "Generar cola de hoy", que además NO respetaba el
-- modo prueba). Se elimina esa duplicación del lado del frontend; el cron
-- diario es ahora la única vía de encolado automático para los 3 flujos
-- rutinarios (recordatorio_24h, cumpleaños, reactivación).
--
-- clientas.ultima es texto libre "D Mon YYYY" (ej. "24 Jul 2026"); 925
-- clientas lo tienen vacío ('') — la versión anterior en JS calculaba
-- "999 días" para esos casos (bug real: son los mensajes rotos que se ven
-- en la cola de pruebas, "Han pasado 999 días… tu próximo 0"). Esta versión
-- solo considera clientas con fecha real y parseable, evitando reproducir
-- ese bug en un flujo que ahora corre solo, todos los días.
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
  v_r        int  := 0;
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

  -- Reactivación de inactivas (antes solo vía botón manual). Requiere
  -- aprobación humana igual que antes (es MARKETING, no transaccional).
  with fechas as (
    select cl.*,
      make_date(
        split_part(cl.ultima,' ',3)::int,
        (case split_part(cl.ultima,' ',2)
          when 'Ene' then 1 when 'Feb' then 2 when 'Mar' then 3 when 'Abr' then 4
          when 'May' then 5 when 'Jun' then 6 when 'Jul' then 7 when 'Ago' then 8
          when 'Sep' then 9 when 'Oct' then 10 when 'Nov' then 11 when 'Dic' then 12
        end),
        split_part(cl.ultima,' ',1)::int
      ) as fecha_ultima
    from clientas cl
    where cl.ultima ~ '^[0-9]+ (Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic) [0-9]{4}$'
  )
  insert into wa_mensajes (clienta_id, tel, flujo, plantilla, variables, cuerpo, estado, requiere_aprobacion, creado_por)
  select f.id, f.tel, 'reactivacion', 'reactivacion',
         jsonb_build_object('1', split_part(f.nombre,' ',1), '2', (v_hoy - f.fecha_ultima)::text, '3', coalesce(nullif(f.fav,''),'servicio')),
         format('Te extrañamos, %s 💛 Han pasado %s días desde tu última visita. Regresa a Robsen con un 20%% en tu próximo %s. ¿Agendamos? ✨',
                split_part(f.nombre,' ',1), (v_hoy - f.fecha_ultima)::text, coalesce(nullif(f.fav,''),'servicio')),
         'pendiente_aprobacion', true, 'cron'
  from fechas f
  where (v_hoy - f.fecha_ultima) > coalesce(f.ciclo, 8) * 7 * 1.5
    and f.tel is not null and f.tel <> ''
    and coalesce(f.wa_optin, true) = true
    and (not v_prueba or right(regexp_replace(coalesce(f.tel,''),'\D','','g'),10) = v_test10)
    and not exists (select 1 from wa_mensajes m
                    where m.flujo='reactivacion' and m.clienta_id = f.id
                      and m.estado <> 'cancelado'
                      and m.created_at > now() - interval '21 days');
  get diagnostics v_r = row_count;

  return v_n + v_c + v_r;
end $$;

revoke all on function wa_encolar() from anon, authenticated;

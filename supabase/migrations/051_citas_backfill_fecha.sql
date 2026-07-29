-- Backfill: 8 citas tenían fecha = null porque Agenda.tsx omitía el campo
-- 'fecha' deliberadamente al guardar una cita "de hoy" (bug real, corregido
-- en el código de Agenda.tsx + db.ts en el mismo cambio). getCitas() trataba
-- cualquier fecha nula como "hoy" — así que esas citas (algunas ya 'done' de
-- días anteriores) se seguían mostrando como pendientes de hoy sin importar
-- cuánto tiempo pasara. Se reconstruye la fecha real a partir del timestamp
-- embebido en el id (formato 'a<millis>', ej. 'a1785258898979').
update citas
set fecha = (to_timestamp((regexp_replace(id,'\D','','g'))::bigint / 1000.0) at time zone 'America/Mexico_City')::date::text
where id ~ '^a[0-9]{10,}$'
  and (fecha is null or fecha = '');

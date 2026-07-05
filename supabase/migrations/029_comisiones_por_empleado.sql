-- Consolida la comisión: deja de existir "comisión del servicio" y la única
-- base real pasa a ser la comisión del empleado, con una excepción puntual
-- opcional por servicio (estilistas.comisiones).

-- Excepción puntual por servicio: { [servicio_id]: pct }. Mismo patrón que
-- ya usaba config.comisiones, ahora a nivel de cada estilista.
alter table estilistas add column if not exists comisiones jsonb not null default '{}'::jsonb;

-- Estos dos campos nunca afectaron el cálculo real de una venta (confirmado
-- revisando POS.tsx) — se eliminan a favor del modelo por empleado.
alter table servicios drop column if exists com_valor;
alter table servicios drop column if exists com_tipo;

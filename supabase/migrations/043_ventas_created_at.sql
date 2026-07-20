-- Fecha real de creación de la venta, para cortes por rango de fechas (el campo
-- 'fecha' es solo texto de despliegue, sin año). Default now() para las nuevas.
alter table ventas add column if not exists created_at timestamptz not null default now();

-- Respaldo de las ventas existentes desde el id (formato 'v' + epoch en ms).
update ventas
  set created_at = to_timestamp((substring(id from 2))::bigint / 1000.0)
  where id ~ '^v[0-9]{13}$';

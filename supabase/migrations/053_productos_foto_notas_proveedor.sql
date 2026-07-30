-- Nota de reconciliación: la tabla real ya no coincide 1:1 con
-- 001_initial_schema.sql (la columna min_stock se renombró a "min" y se
-- quitaron activo/created_at/updated_at en algún momento sin migración
-- versionada). Este archivo solo agrega columnas nuevas sobre el estado
-- real verificado en producción.
alter table productos add column if not exists foto text;
alter table productos add column if not exists notas text;
alter table productos add column if not exists proveedor text;

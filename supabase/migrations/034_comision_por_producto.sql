-- Comisión propia por producto (sobrescribe la comisión global de "Productos").
-- Puede ser un porcentaje o un monto fijo por unidad. Los nombres de columna
-- se mantienen en camelCase (entre comillas) para coincidir con las claves del
-- objeto Producto en el front, que hace upsert directo sin mapper.
alter table productos add column if not exists "comValor" numeric;
alter table productos add column if not exists "comTipo" text;

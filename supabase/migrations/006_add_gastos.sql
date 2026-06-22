-- Tabla de gastos operativos del salón
CREATE TABLE IF NOT EXISTS gastos (
  id        text PRIMARY KEY,
  concepto  text,
  monto     numeric,
  fecha     text,
  categoria text
);

ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON gastos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos(fecha);

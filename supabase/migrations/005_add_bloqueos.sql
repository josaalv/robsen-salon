-- Tabla de bloqueos de horario en agenda
CREATE TABLE IF NOT EXISTS bloqueos (
  id    text PRIMARY KEY,
  est   text,
  h     text,
  fin   text,
  nota  text,
  fecha text
);

ALTER TABLE bloqueos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON bloqueos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_bloqueos_est ON bloqueos(est);

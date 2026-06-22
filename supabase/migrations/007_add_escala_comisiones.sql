-- Escala progresiva de comisiones y columna email en clientas
ALTER TABLE config ADD COLUMN IF NOT EXISTS escala_comisiones jsonb DEFAULT '[]'::jsonb;
ALTER TABLE clientas ADD COLUMN IF NOT EXISTS email text;

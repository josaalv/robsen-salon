-- Columnas para imágenes: logo del salón, avatar de usuario, fotos antes/después de clientas
ALTER TABLE config    ADD COLUMN IF NOT EXISTS logo    text;
ALTER TABLE usuarios  ADD COLUMN IF NOT EXISTS avatar  text;
ALTER TABLE clientas  ADD COLUMN IF NOT EXISTS fotos   jsonb DEFAULT '[]'::jsonb;

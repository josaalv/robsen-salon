ALTER TABLE servicios
  ADD COLUMN IF NOT EXISTS descripcion text,
  ADD COLUMN IF NOT EXISTS precio_visible boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS precio_variable boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS domicilio boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS com_valor integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS com_tipo text DEFAULT 'porcentaje';

-- Soporte de múltiples servicios por cita. Las columnas existentes (srv, dur,
-- total, servicio_id) siguen guardando el resumen agregado para retro-
-- compatibilidad: srv = nombres unidos, dur = suma de duraciones, total = suma
-- de precios, servicio_id = primer servicio. El detalle por servicio vive aquí.
alter table citas add column if not exists servicios jsonb;

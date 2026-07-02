-- El frontend ya no lee ni escribe contraseñas (usa Supabase Auth).
-- Se elimina la columna que las guardaba en texto plano.
alter table usuarios drop column if exists pass;

-- El teléfono deja de ser único a nivel de base: el control de duplicados pasa a
-- ser un aviso con confirmación en la app (algunas clientas comparten teléfono,
-- p. ej. familiares). Se conserva la columna generada tel_normalizado y se
-- reemplaza el índice ÚNICO por uno normal, útil para búsqueda por teléfono.
drop index if exists idx_clientas_tel_unico;
create index if not exists idx_clientas_tel_norm on clientas (tel_normalizado) where tel_normalizado <> '';

-- Permisos de módulos configurables por rol (mapa { rolId: [moduloId, …] }).
-- El admin nunca se guarda aquí: siempre tiene acceso total en la app.
alter table config add column if not exists permisos jsonb not null default '{}'::jsonb;

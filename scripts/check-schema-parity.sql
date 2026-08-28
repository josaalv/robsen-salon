-- Compara funciones y tablas entre 'public' y 'preview'. Cualquier fila que
-- salga de esta consulta significa que una migración se aplicó a un schema
-- y se quedó sin espejear en el otro — exactamente el bug real del
-- hallazgo H-04 de la auditoría de agosto 2026 (las RPCs de booking
-- público solo existían en 'public'; el paso 4 del wizard fallaba en
-- preview porque el schema al que preguntaba nunca las tuvo).
--
-- Excluye a propósito lo que es unidireccional por diseño (ver
-- 057_clone_public_to_preview_schema.sql y 058_sync_public_to_preview_
-- triggers.sql):
--   - fn_sync_preview_*  el propio mecanismo de sincronización public→preview
--   - wa_* / tablas wa_* WhatsApp, fuera de alcance de preview
--
-- Uso: psql "$DATABASE_URL" -t -A -F' | ' -f scripts/check-schema-parity.sql
-- Sin filas de salida = todo en orden.

with pub_fn as (
  select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
    and p.proname not like 'fn\_sync\_preview\_%' and p.proname not like 'wa\_%'
),
preview_fn as (
  select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'preview' and p.prokind = 'f'
    and p.proname not like 'wa\_%'
),
pub_tbl as (
  select tablename from pg_tables where schemaname = 'public' and tablename not like 'wa\_%'
),
preview_tbl as (
  select tablename from pg_tables where schemaname = 'preview' and tablename not like 'wa\_%'
)
select 'función solo en public' as diferencia, sig as nombre from pub_fn where sig not in (select sig from preview_fn)
union all
select 'función solo en preview', sig from preview_fn where sig not in (select sig from pub_fn)
union all
select 'tabla solo en public', tablename from pub_tbl where tablename not in (select tablename from preview_tbl)
union all
select 'tabla solo en preview', tablename from preview_tbl where tablename not in (select tablename from pub_tbl)
order by 1, 2;

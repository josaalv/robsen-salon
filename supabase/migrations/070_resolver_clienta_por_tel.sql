-- Los triggers de BD (049, 069) ya ponen siempre clienta_id en wa_mensajes
-- porque disparan desde una fila de `citas`/`clientas` que ya trae el id.
-- Pero wa-webhook (mensajes entrantes de la clienta y, desde coexistence,
-- los que el personal manda a mano desde el celular) solo tiene el
-- teléfono — hasta ahora esas filas se quedaban con clienta_id en null,
-- rompiendo cualquier intento de armar "todas las interacciones de esta
-- clienta en un solo lugar" (perfil CRM + conversación) por esas filas.
--
-- RPC de solo lectura, mismo criterio de match que ya usan los triggers
-- (últimos 10 dígitos, sin importar lada/formato) — se llama desde
-- wa-webhook con service role antes de insertar cada wa_mensajes.
create or replace function public.resolver_clienta_por_tel(p_tel text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id from clientas
  where right(regexp_replace(coalesce(tel,''), '\D', '', 'g'), 10) = right(regexp_replace(coalesce(p_tel,''), '\D', '', 'g'), 10)
    and right(regexp_replace(coalesce(p_tel,''), '\D', '', 'g'), 10) <> ''
  limit 1;
$$;

revoke all on function public.resolver_clienta_por_tel(text) from public, anon, authenticated;

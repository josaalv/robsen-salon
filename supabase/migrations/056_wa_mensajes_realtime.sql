-- 056_wa_mensajes_realtime.sql
-- La bandeja de WhatsApp (Conversaciones + cola de Automatización) solo se
-- actualizaba con un timer de 45s o al recargar la página — un mensaje
-- entrante o un cambio de estado podía tardar hasta 45s en aparecer, o no
-- aparecer hasta que alguien recargara manualmente. Se agrega wa_mensajes a
-- la publicación de Realtime para que el frontend se suscriba a cambios
-- (INSERT/UPDATE/DELETE) y refresque al instante, en vez de solo sondear.
-- Realtime respeta la RLS existente de la tabla (wa_mensajes_rw:
-- admin/gerente/recepción) — no se abre nada que antes no se pudiera leer.
alter publication supabase_realtime add table wa_mensajes;

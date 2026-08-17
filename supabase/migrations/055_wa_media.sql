-- 055_wa_media.sql
-- Soporte de multimedia (fotos, audios, documentos) en la bandeja de
-- Conversaciones de WhatsApp: hoy wa_mensajes solo guarda texto. Se agrega
-- dónde vive el archivo (media_path, dentro del bucket privado nuevo
-- wa-media) y de qué tipo es, para poder mostrarlo/enviarlo.

alter table wa_mensajes add column if not exists media_path text;
alter table wa_mensajes add column if not exists media_tipo text; -- image | audio | video | document | sticker

-- Bucket privado (igual que fotos-clientas, migración 026): la media que
-- clientas mandan por WhatsApp puede ser tan sensible como una foto de
-- servicio — no debe vivir en el bucket público "media". Se sirve con URLs
-- firmadas que expiran, nunca con un link público permanente.
insert into storage.buckets (id, name, public)
values ('wa-media', 'wa-media', false)
on conflict (id) do nothing;

create policy "wa_media_select_authenticated" on storage.objects for select to authenticated
  using (bucket_id = 'wa-media');
create policy "wa_media_insert_authenticated" on storage.objects for insert to authenticated
  with check (bucket_id = 'wa-media');

-- Semilla versionada de wa_plantillas. Las 6 filas actuales se habían
-- insertado a mano fuera de git; esto asegura que un ambiente nuevo (o una
-- recuperación de desastre) no dependa de un insert manual. estado_meta
-- arranca en 'pendiente' — el estado real (aprobada/rechazada) lo pone
-- 'sync' (Edge Function wa-templates) contra Meta, no esta semilla.
insert into wa_plantillas (nombre, idioma, categoria, flujo, cuerpo, estado_meta, activa)
values
  ('confirmacion_cita', 'es_MX', 'utility',
   'confirmacion',
   'Hola {{1}} 💛 Confirmamos tu cita de {{2}} el {{3}} a las {{4}} con {{5}} en Robsen Salón & Spa. Responde CONFIRMO para apartar tu lugar.',
   'pendiente', true),
  ('recordatorio_24h', 'es_MX', 'utility',
   'recordatorio_24h',
   '¡Hola {{1}}! Te recordamos tu cita de {{2}} mañana a las {{3}} con {{4}}. Responde CONFIRMO para confirmar tu asistencia. ✨',
   'pendiente', true),
  ('post_visita', 'es_MX', 'utility',
   'post_visita',
   'Gracias por visitarnos, {{1}} ✨ Fue un placer consentirte con tu {{2}}. Nos encantará verte pronto en Robsen Salón & Spa 💛',
   'pendiente', true),
  ('cumpleanos', 'es_MX', 'marketing',
   'cumpleanos',
   '¡Feliz cumpleaños, {{1}}! 🎂🎉 Todo el equipo de Robsen Salón & Spa te desea un día increíble. Ven a consentirte: tienes un regalo especial esperándote 🎁',
   'pendiente', true),
  ('bienvenida', 'es_MX', 'marketing',
   'bienvenida',
   '¡Bienvenida a Robsen Salón & Spa, {{1}}! 💛 Gracias por tu confianza. Estamos para consentirte; cualquier duda, escríbenos por aquí. ✨',
   'pendiente', true),
  ('reactivacion', 'es_MX', 'marketing',
   'reactivacion',
   'Te extrañamos, {{1}} 💛 Han pasado {{2}} días desde tu última visita. Regresa a Robsen con un 20% en tu próximo {{3}}. ¿Agendamos? ✨',
   'pendiente', true)
on conflict (nombre, idioma) do nothing;

-- Agenda el CRM de WhatsApp: encolado diario + envío periódico.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Encolado diario (9:00 CDMX = 15:00 UTC): recordatorios de mañana + cumpleaños.
select cron.schedule(
  'wa_encolar_diario',
  '0 15 * * *',
  $$select wa_encolar()$$
);

-- Envío periódico (cada 30 min): dispara el conector para mandar los 'aprobado'.
-- La Authorization usa la anon key (pública) del proyecto. Ver Supabase → API.
select cron.schedule(
  'wa_enviar_periodico',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/wa-enviar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);

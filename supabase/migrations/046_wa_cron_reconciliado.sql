-- Reconcilia el cron real (aplicado a mano en algún punto, fuera del
-- historial de migraciones) con lo versionado. 040_wa_cron.sql traía
-- <PROJECT_REF>/<ANON_KEY> como plantilla; esto la reemplaza por los valores
-- reales (el anon key ya es público — se embebe en cada build del frontend,
-- así que versionarlo aquí no expone nada nuevo) para que el repo coincida
-- con lo que realmente corre en producción.
select cron.unschedule('wa_enviar_periodico');

select cron.schedule(
  'wa_enviar_periodico',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://pkpwrifwrntjztprwcwp.supabase.co/functions/v1/wa-enviar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrcHdyaWZ3cm50anp0cHJ3Y3dwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3ODcyNTUsImV4cCI6MjA5NzM2MzI1NX0.hIjHAHlUybNE8jWkswonv6W9CzBnqnQquukcMUHNWUc'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Andamiaje del CRM automatizado con WhatsApp Business (Cloud API).
-- Solo estructura de datos; el envío real (Edge Functions + cron) se conecta
-- después. El conector y el webhook corren con service role (bypass RLS).

-- ── Consentimiento (opt-in) de WhatsApp en la ficha de clienta ──
-- Por ahora se asume consentimiento (default true). Cuando exista el
-- agendamiento web con casilla explícita, las nuevas clientas nacerán en false
-- hasta que acepten. wa_optout_at marca cuándo respondieron BAJA.
alter table clientas add column if not exists wa_optin boolean not null default true;
alter table clientas add column if not exists wa_optout_at timestamptz;

-- ── Registro de plantillas de WhatsApp (las que aprueba Meta) ──
create table if not exists wa_plantillas (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,                     -- nombre exacto registrado en Meta
  idioma       text not null default 'es_MX',
  categoria    text not null default 'utility',   -- utility | marketing | authentication
  flujo        text,                              -- confirmacion | recordatorio_24h | post_visita | cumpleanos | bienvenida | reactivacion | inactiva | manual
  cuerpo       text not null default '',          -- texto con variables, para previsualizar
  estado_meta  text not null default 'borrador',  -- borrador | pendiente | aprobada | rechazada
  activa       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (nombre, idioma)
);

-- ── Cola de mensajes de WhatsApp ──
create table if not exists wa_mensajes (
  id                  uuid primary key default gen_random_uuid(),
  clienta_id          text references clientas(id) on delete set null,
  tel                 text not null,
  flujo               text not null,
  plantilla           text,                       -- nombre de plantilla de Meta
  variables           jsonb not null default '{}'::jsonb,
  cuerpo              text not null default '',    -- mensaje renderizado (preview / aprobación)
  estado              text not null default 'pendiente_aprobacion',
  requiere_aprobacion boolean not null default true,
  programado_para     timestamptz,
  enviado_at          timestamptz,
  wa_message_id       text,                        -- id que devuelve Meta al enviar
  error               text,
  cita_id             text,
  creado_por          text not null default 'sistema',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint wa_mensajes_estado_chk check (estado in
    ('borrador','pendiente_aprobacion','aprobado','enviando','enviado','entregado','leido','respondido','fallido','cancelado'))
);
create index if not exists wa_mensajes_estado_idx  on wa_mensajes (estado);
create index if not exists wa_mensajes_clienta_idx on wa_mensajes (clienta_id);
create index if not exists wa_mensajes_prog_idx    on wa_mensajes (programado_para);

-- ── RLS: el módulo Seguimiento es de gestión (admin/gerente/recepción) ──
alter table wa_plantillas enable row level security;
alter table wa_mensajes  enable row level security;

create policy wa_plantillas_rw on wa_plantillas
  for all to authenticated
  using  (current_rol() = any (array['admin','gerente','recepcion']))
  with check (current_rol() = any (array['admin','gerente','recepcion']));

create policy wa_mensajes_rw on wa_mensajes
  for all to authenticated
  using  (current_rol() = any (array['admin','gerente','recepcion']))
  with check (current_rol() = any (array['admin','gerente','recepcion']));

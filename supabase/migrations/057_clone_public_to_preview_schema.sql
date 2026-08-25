-- Clon de esquema 'preview' a partir de las migraciones reales de 'public'.
-- Excluye a propósito:
--  - Migraciones de WhatsApp incrementales (037-041,045-050,052,055-056): fuera de
--    alcance de preview, y 040/046 tocan pg_cron (estado global del proyecto).
--  - Políticas/buckets de storage.objects / storage.buckets (010 completa; bloques
--    puntuales de 017 y 026): storage es global al proyecto, no por schema — ya
--    existen de la corrida original contra 'public', re-crearlas fallaría por
--    duplicado. El build de preview usa los mismos buckets/políticas que producción.
create schema if not exists preview;
set search_path to preview, extensions, pg_catalog;

-- ===== 001_initial_schema.sql =====
-- Robsen Salón & Spa — Esquema inicial de base de datos
-- Ejecutar en Supabase SQL Editor

-- ================================================
-- EXTENSIONES
-- ================================================
create extension if not exists "uuid-ossp";

-- ================================================
-- TABLAS PRINCIPALES
-- ================================================

-- Estilistas / Empleados
create table estilistas (
  id text primary key default 'e' || extract(epoch from now())::text,
  nombre text not null,
  rol text not null,
  color text default '#C8A14A',
  ini text not null,
  com_pct numeric(5,2) default 30,
  activo boolean default true,
  horarios jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Clientas
create table clientas (
  id text primary key default 'c' || extract(epoch from now())::text,
  nombre text not null,
  tel text,
  email text,
  estado text check (estado in ('VIP','Frecuente','Activa','Nueva','Inactiva')) default 'Nueva',
  ultima date,
  ticket numeric(10,2) default 0,
  fav text,
  est_id text references estilistas(id),
  visitas integer default 0,
  gasto numeric(10,2) default 0,
  ini text not null,
  cumple text,
  ciclo integer default 8,
  notas text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Servicios
create table servicios (
  id text primary key default 's' || extract(epoch from now())::text,
  nombre text not null,
  cat text not null,
  precio numeric(10,2) not null,
  dur integer not null, -- minutos
  anticipo boolean default false,
  anticipo_pct numeric(5,2) default 35,
  online boolean default true,
  activo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Relación servicio ↔ estilista (N:N)
create table servicio_estilista (
  servicio_id text references servicios(id) on delete cascade,
  estilista_id text references estilistas(id) on delete cascade,
  primary key (servicio_id, estilista_id)
);

-- Productos / Inventario
create table productos (
  id text primary key default 'pr' || extract(epoch from now())::text,
  sku text,
  nombre text not null,
  marca text,
  cat text,
  uso text check (uso in ('retail','interno')) default 'retail',
  costo numeric(10,2) default 0,
  precio numeric(10,2) default 0,
  stock integer default 0,
  min_stock integer default 0,
  vendidos integer default 0,
  activo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Citas
create table citas (
  id text primary key default 'a' || extract(epoch from now())::text,
  clienta_id text references clientas(id),
  clienta_nombre text not null,
  servicio_id text references servicios(id),
  servicio_nombre text not null,
  estilista_id text references estilistas(id),
  fecha date not null default current_date,
  hora time not null,
  dur integer not null default 60,
  estado text check (estado in ('pend','conf','pay','done','canc')) default 'pend',
  total numeric(10,2) default 0,
  anticipo numeric(10,2) default 0,
  notas text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ventas / Tickets POS
create table ventas (
  id text primary key default 'v' || extract(epoch from now())::text,
  ticket text unique,
  clienta_id text references clientas(id),
  clienta_nombre text,
  fecha timestamptz default now(),
  pago text check (pago in ('Tarjeta','Efectivo','Transferencia','Pendiente')) default 'Efectivo',
  estado text check (estado in ('pagada','parcial','pendiente')) default 'pendiente',
  descuento numeric(10,2) default 0,
  anticipo numeric(10,2) default 0,
  subtotal numeric(10,2) generated always as (0) stored,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Líneas de venta
create table venta_lineas (
  id uuid default uuid_generate_v4() primary key,
  venta_id text references ventas(id) on delete cascade,
  tipo text check (tipo in ('servicio','producto','adicional')) not null,
  ref_id text, -- id del servicio, producto o adicional
  nombre text not null,
  estilista_id text references estilistas(id),
  cantidad integer default 1,
  precio_unitario numeric(10,2) not null,
  com_pct numeric(5,2) default 0,
  created_at timestamptz default now()
);

-- Movimientos de inventario (Kardex)
create table movimientos_inv (
  id uuid default uuid_generate_v4() primary key,
  producto_id text references productos(id),
  producto_nombre text not null,
  tipo text check (tipo in ('entrada','salida','consumo')) not null,
  cantidad integer not null,
  motivo text,
  ref_id text,
  fecha timestamptz default now()
);

-- Mensajes WhatsApp
create table mensajes_wa (
  id uuid default uuid_generate_v4() primary key,
  clienta_id text references clientas(id),
  clienta_nombre text,
  estilista_id text references estilistas(id),
  tipo text, -- Confirmación, Recordatorio, Reactivación, Agradecimiento
  estado text check (estado in ('enviado','entregado','respondido')) default 'enviado',
  texto text not null,
  sin_leer boolean default true,
  fecha timestamptz default now()
);

-- Plantillas WhatsApp
create table plantillas_wa (
  id uuid default uuid_generate_v4() primary key,
  nombre text not null,
  icon text,
  texto text not null,
  activo boolean default true,
  created_at timestamptz default now()
);

-- Usuarios del sistema
create table usuarios (
  id uuid default uuid_generate_v4() primary key,
  nombre text not null,
  email text unique not null,
  tel text,
  rol text check (rol in ('admin','gerente','recepcion','estilista')) default 'recepcion',
  ini text not null,
  color text,
  activo boolean default true,
  ultimo_acceso timestamptz,
  created_at timestamptz default now()
);

-- Adicionales (extras que no son servicio ni producto de inventario)
create table adicionales (
  id text primary key,
  nombre text not null,
  precio numeric(10,2) default 0,
  cat text,
  activo boolean default true
);

-- ================================================
-- TRIGGERS: updated_at automático
-- ================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_estilistas_updated before update on estilistas for each row execute function update_updated_at();
create trigger trg_clientas_updated   before update on clientas   for each row execute function update_updated_at();
create trigger trg_servicios_updated  before update on servicios  for each row execute function update_updated_at();
create trigger trg_productos_updated  before update on productos  for each row execute function update_updated_at();
create trigger trg_citas_updated      before update on citas      for each row execute function update_updated_at();
create trigger trg_ventas_updated     before update on ventas     for each row execute function update_updated_at();

-- ================================================
-- TRIGGER: descontar stock al registrar venta de producto
-- ================================================
create or replace function after_venta_linea_insert()
returns trigger as $$
begin
  if new.tipo = 'producto' and new.ref_id is not null then
    update productos
      set stock    = stock - new.cantidad,
          vendidos = vendidos + new.cantidad,
          updated_at = now()
      where id = new.ref_id and stock >= new.cantidad;

    insert into movimientos_inv (producto_id, producto_nombre, tipo, cantidad, motivo, ref_id)
    values (
      new.ref_id,
      new.nombre,
      'salida',
      new.cantidad,
      'Venta · ' || (select ticket from ventas where id = new.venta_id),
      new.venta_id
    );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_venta_linea_insert
  after insert on venta_lineas
  for each row execute function after_venta_linea_insert();

-- ================================================
-- ÍNDICES
-- ================================================
create index idx_citas_fecha        on citas(fecha);
create index idx_citas_estilista    on citas(estilista_id);
create index idx_citas_clienta      on citas(clienta_id);
create index idx_ventas_fecha       on ventas(fecha);
create index idx_ventas_clienta     on ventas(clienta_id);
create index idx_venta_lineas_venta on venta_lineas(venta_id);
create index idx_movimientos_prod   on movimientos_inv(producto_id);
create index idx_mensajes_clienta   on mensajes_wa(clienta_id);

-- ===== 002_rls_policies.sql =====
-- Robsen — Row Level Security (RLS) policies
-- Implementar después de conectar Supabase Auth

-- ================================================
-- HABILITAR RLS EN TODAS LAS TABLAS
-- ================================================
alter table estilistas      enable row level security;
alter table clientas        enable row level security;
alter table servicios       enable row level security;
alter table productos       enable row level security;
alter table citas           enable row level security;
alter table ventas          enable row level security;
alter table venta_lineas    enable row level security;
alter table movimientos_inv enable row level security;
alter table mensajes_wa     enable row level security;
alter table plantillas_wa   enable row level security;
alter table usuarios        enable row level security;

-- ================================================
-- HELPER: obtener el rol del usuario actual
-- ================================================
create or replace function get_user_role()
returns text as $$
  select rol from usuarios where email = auth.email()
$$ language sql security definer;

-- ================================================
-- POLÍTICAS POR TABLA
-- ================================================

-- ESTILISTAS: todos los roles autenticados pueden leer; solo admin/gerente pueden modificar
create policy "estilistas_read"   on estilistas for select using (auth.uid() is not null);
create policy "estilistas_write"  on estilistas for all    using (get_user_role() in ('admin','gerente'));

-- CLIENTAS: todos pueden leer; recepcion y superior pueden modificar
create policy "clientas_read"     on clientas for select using (auth.uid() is not null);
create policy "clientas_write"    on clientas for all    using (get_user_role() in ('admin','gerente','recepcion'));

-- SERVICIOS: todos pueden leer; admin/gerente pueden modificar
create policy "servicios_read"    on servicios for select using (auth.uid() is not null);
create policy "servicios_write"   on servicios for all   using (get_user_role() in ('admin','gerente'));

-- PRODUCTOS: todos pueden leer; admin/gerente/recepcion pueden modificar
create policy "productos_read"    on productos for select using (auth.uid() is not null);
create policy "productos_write"   on productos for all   using (get_user_role() in ('admin','gerente','recepcion'));

-- CITAS: todos pueden ver; recepcion y superior pueden modificar
create policy "citas_read"        on citas for select using (auth.uid() is not null);
create policy "citas_write"       on citas for all   using (get_user_role() in ('admin','gerente','recepcion'));

-- VENTAS: todos pueden ver; recepcion y superior pueden crear; solo admin/gerente eliminan
create policy "ventas_read"       on ventas for select using (auth.uid() is not null);
create policy "ventas_insert"     on ventas for insert with check (get_user_role() in ('admin','gerente','recepcion'));
create policy "ventas_update"     on ventas for update using (get_user_role() in ('admin','gerente','recepcion'));
create policy "ventas_delete"     on ventas for delete using (get_user_role() in ('admin','gerente'));

-- VENTA LINEAS: acceso ligado a ventas
create policy "venta_lineas_read"   on venta_lineas for select using (auth.uid() is not null);
create policy "venta_lineas_write"  on venta_lineas for all   using (get_user_role() in ('admin','gerente','recepcion'));

-- MOVIMIENTOS: solo lectura para todos; write via trigger
create policy "movimientos_read"    on movimientos_inv for select using (auth.uid() is not null);
create policy "movimientos_insert"  on movimientos_inv for insert with check (auth.uid() is not null);

-- MENSAJES WA: todos pueden leer y crear; solo admin/gerente eliminan
create policy "mensajes_read"       on mensajes_wa for select using (auth.uid() is not null);
create policy "mensajes_write"      on mensajes_wa for insert with check (auth.uid() is not null);
create policy "mensajes_update"     on mensajes_wa for update using (auth.uid() is not null);

-- PLANTILLAS WA: todos pueden leer; admin/gerente modifican
create policy "plantillas_read"     on plantillas_wa for select using (auth.uid() is not null);
create policy "plantillas_write"    on plantillas_wa for all   using (get_user_role() in ('admin','gerente'));

-- USUARIOS: solo admin puede gestionar usuarios; cada uno puede ver el propio
create policy "usuarios_self"       on usuarios for select using (email = auth.email());
create policy "usuarios_admin_read" on usuarios for select using (get_user_role() = 'admin');
create policy "usuarios_admin_write"on usuarios for all   using (get_user_role() = 'admin');

-- ===== 003_seed_data.sql =====
-- Robsen — Datos de demostración iniciales
-- Ejecutar después de 001 y 002

-- Estilistas
insert into estilistas (id, nombre, rol, color, ini, com_pct) values
('e1', 'Valeria Mendoza',  'Color & Balayage', '#C8A14A', 'VM', 35),
('e2', 'Renata Ochoa',     'Estilista Senior', '#93B58C', 'RO', 30),
('e3', 'Mariana Salgado',  'Tratamientos',     '#6FA6B8', 'MS', 32),
('e4', 'Daniela Cortés',   'Uñas & Spa',       '#C77B7B', 'DC', 25),
('e5', 'Paola Rivas',      'Maquillaje',       '#B08AC7', 'PR', 30);

-- Servicios
insert into servicios (id, nombre, cat, precio, dur, anticipo, online) values
('s1',  'Balayage Premium',         'Mechas',       2800, 180, true,  true),
('s2',  'Colorimetría completa',    'Colorimetría', 1950, 150, true,  true),
('s3',  'Retoque de raíz',          'Colorimetría', 950,  90,  false, true),
('s4',  'Corte & Peinado',          'Cortes',       680,  60,  false, true),
('s5',  'Tratamiento de Keratina',  'Tratamientos', 2400, 150, true,  true),
('s6',  'Botox Capilar',            'Tratamientos', 1600, 120, true,  true),
('s7',  'Manicure Ruso',            'Uñas',         550,  75,  false, true),
('s8',  'Pedicure Spa',             'Pedicure',     620,  75,  false, true),
('s9',  'Maquillaje Social',        'Maquillaje',   1200, 75,  true,  true),
('s10', 'Maquillaje de Novia',      'Maquillaje',   3500, 120, true,  false),
('s11', 'Extensiones de Cabello',   'Extensiones',  5400, 240, true,  false),
('s12', 'Depilación con cera',      'Depilación',   480,  45,  false, true),
('s13', 'Paquete Novia Total',      'Paquetes',     6800, 300, true,  false),
('s14', 'Paquete Glow Mensual',     'Paquetes',     2900, 180, true,  true);

-- Relación servicio ↔ estilista
insert into servicio_estilista values
('s1','e1'),('s2','e1'),('s2','e2'),('s3','e1'),('s3','e2'),
('s4','e2'),('s5','e3'),('s6','e3'),('s7','e4'),('s8','e4'),
('s9','e5'),('s10','e5'),('s11','e1'),('s12','e4'),
('s13','e5'),('s13','e1'),('s14','e2'),('s14','e3');

-- Productos
insert into productos (id, sku, nombre, marca, cat, uso, costo, precio, stock, min_stock, vendidos) values
('pr1',  'OLA-N3',   'Olaplex N°3 Hair Perfector',  'Olaplex',     'Cuidado',    'retail',  380, 720,  18, 6,  42),
('pr2',  'OLA-N0',   'Olaplex N°0 Bond Building',   'Olaplex',     'Tratamiento','interno', 520, 0,    5,  4,  0),
('pr3',  'KER-NUT',  'Kérastase Nutritive Mask',    'Kérastase',   'Cuidado',    'retail',  640, 1180, 11, 5,  23),
('pr4',  'KER-BAIN', 'Bain Satin Shampoo 250ml',    'Kérastase',   'Shampoo',    'retail',  420, 760,  3,  6,  31),
('pr5',  'LOR-MAJ7', 'Majirel Tinte 7.1 60ml',      'L''Oréal Pro','Color',      'interno', 155, 0,    24, 12, 0),
('pr6',  'LOR-OXY',  'Oxidante 20 vol 1L',          'L''Oréal Pro','Color',      'interno', 180, 0,    2,  5,  0),
('pr7',  'WEL-BLON', 'Blondor Polvo Decolorante',   'Wella',       'Color',      'interno', 640, 0,    7,  4,  0),
('pr8',  'MOR-OIL',  'Moroccanoil Treatment 100ml', 'Moroccanoil', 'Aceite',     'retail',  680, 1240, 14, 5,  38),
('pr9',  'OPI-RED',  'OPI Esmalte Big Apple Red',   'OPI',         'Uñas',       'retail',  120, 260,  22, 8,  54),
('pr10', 'OPI-BASE', 'OPI Base Coat 15ml',          'OPI',         'Uñas',       'interno', 140, 0,    9,  4,  0),
('pr11', 'RBS-TOTE', 'Robsen Tote Bag Edición',     'Robsen',      'Boutique',   'retail',  90,  320,  0,  5,  27),
('pr12', 'RBS-CAND', 'Robsen Vela Aromática',       'Robsen',      'Boutique',   'retail',  110, 290,  16, 6,  19);

-- Usuarios (email/pass se gestionan desde Supabase Auth)
insert into usuarios (nombre, email, tel, rol, ini, color, activo) values
('Roberto Benítez',  'roberto@robsen.com.mx',    '33 3826 0774', 'admin',     'RB', null,      true),
('Lucía Fuentes',    'lucia@robsen.com.mx',      '33 1188 2204', 'gerente',   'LF', '#B08AC7', true),
('Daniela Cortés',   'recepcion@robsen.com.mx',  '33 2200 7781', 'recepcion', 'DC', '#C77B7B', true),
('Valeria Mendoza',  'valeria@robsen.com.mx',    '33 3341 9920', 'estilista', 'VM', '#C8A14A', true),
('Renata Ochoa',     'renata@robsen.com.mx',     '33 4419 0087', 'estilista', 'RO', '#93B58C', false);

-- Plantillas WhatsApp
insert into plantillas_wa (nombre, icon, texto) values
('Confirmación de cita', 'calendar-check', 'Hola {nombre} 💛 Confirmamos tu cita de {servicio} el {fecha} a las {hora} con {estilista}. Te esperamos en Robsen Salón & Spa.'),
('Recordatorio 24h',     'bell',           '¡Hola {nombre}! Te recordamos tu cita de {servicio} mañana a las {hora}. Responde CONFIRMO para apartar tu lugar ✨'),
('Reactivación',         'sparkle',        'Te extrañamos en Robsen, {nombre} 💛 Han pasado {dias} días. Regresa con 20% en tu próximo servicio. ¿Agendamos?'),
('Agradecimiento',       'heart',          'Gracias por visitarnos, {nombre} ✨ Fue un placer consentirte. Nos encantará verte pronto en Robsen.');

-- Adicionales
insert into adicionales (id, nombre, precio, cat) values
('ad1', 'Lavado y secado express',   180, 'Extra'),
('ad2', 'Ampolleta de tratamiento',  240, 'Extra'),
('ad3', 'Peinado adicional',         350, 'Extra'),
('ad4', 'Aplicación de tinte extra', 280, 'Extra'),
('ad5', 'Propina sugerida 10%',      0,   'Propina'),
('ad6', 'Cargo por domicilio',       300, 'Extra');

-- ===== 004_correct_schema.sql =====
-- ============================================================
-- MIGRACIÓN 004 — Schema correcto que coincide con db.ts
-- Ejecutar en Supabase SQL Editor
-- ADVERTENCIA: elimina tablas del schema anterior y crea las correctas
-- ============================================================

-- ── 1. LIMPIAR SCHEMA ANTERIOR ──────────────────────────────
DROP TABLE IF EXISTS mensajes_wa        CASCADE;
DROP TABLE IF EXISTS venta_lineas       CASCADE;
DROP TABLE IF EXISTS movimientos_inv    CASCADE;
DROP TABLE IF EXISTS plantillas_wa      CASCADE;
DROP TABLE IF EXISTS adicionales        CASCADE;
DROP TABLE IF EXISTS servicio_estilista CASCADE;
DROP TABLE IF EXISTS ventas             CASCADE;
DROP TABLE IF EXISTS citas              CASCADE;
DROP TABLE IF EXISTS clientas           CASCADE;
DROP TABLE IF EXISTS servicios          CASCADE;
DROP TABLE IF EXISTS productos          CASCADE;
DROP TABLE IF EXISTS estilistas         CASCADE;
DROP TABLE IF EXISTS usuarios           CASCADE;
DROP TABLE IF EXISTS config             CASCADE;

-- ── 2. TABLAS CORRECTAS ──────────────────────────────────────

-- Configuración del salón (una sola fila)
CREATE TABLE config (
  id              text PRIMARY KEY DEFAULT 'main',
  agenda_start    integer     DEFAULT 9,
  agenda_end      integer     DEFAULT 20,
  slot_min        integer     DEFAULT 15,
  dias_abiertos   jsonb       DEFAULT '[true,true,true,true,true,true,false]',
  nombre          text        DEFAULT 'Robsen Salón & Spa',
  direccion       text,
  tel             text,
  whatsapp        text,
  anticipo_pct    numeric     DEFAULT 35,
  requerir_anticipo boolean   DEFAULT true,
  iva             integer     DEFAULT 0,
  metodospago     jsonb       DEFAULT '{"efectivo":true,"tarjeta":true,"transferencia":true,"credito":false}',
  acento          text        DEFAULT '#C8A14A',
  comisiones      jsonb       DEFAULT '{}',
  notifs          jsonb       DEFAULT '{"citas":true,"recordatorios":true,"anticipos":true,"stock":true,"inactivas":false,"cumples":true}'
);

-- Estilistas
CREATE TABLE estilistas (
  id       text PRIMARY KEY,
  nombre   text NOT NULL,
  rol      text,
  color    text DEFAULT '#C8A14A',
  ini      text,
  com      numeric DEFAULT 30,
  horarios jsonb   DEFAULT '[true,true,true,true,true,true,false]'
);

-- Servicios
CREATE TABLE servicios (
  id       text PRIMARY KEY,
  nombre   text NOT NULL,
  cat      text,
  precio   numeric DEFAULT 0,
  dur      integer DEFAULT 60,
  anticipo boolean DEFAULT false,
  online   boolean DEFAULT true,
  prof     jsonb   DEFAULT '[]'
);

-- Clientas
CREATE TABLE clientas (
  id      text PRIMARY KEY,
  nombre  text NOT NULL,
  tel     text,
  estado  text DEFAULT 'Nueva',
  ultima  text,
  ticket  numeric DEFAULT 0,
  fav     text,
  est     text,
  visitas integer DEFAULT 0,
  gasto   numeric DEFAULT 0,
  ini     text,
  cumple  text,
  ciclo   integer DEFAULT 8,
  notas   text,
  formulas jsonb DEFAULT '[]'
);

-- Citas (hoy y futuras, diferenciadas por campo `fecha`)
CREATE TABLE citas (
  id         text PRIMARY KEY,
  h          text NOT NULL,
  dur        integer DEFAULT 60,
  cl         text NOT NULL,
  cliente_id text,
  tel        text,
  email      text,
  srv        text NOT NULL,
  servicio_id text,
  est        text,
  estado     text DEFAULT 'pend',
  total      numeric DEFAULT 0,
  ant        numeric DEFAULT 0,
  notas      text,
  fecha      text         -- 'YYYY-MM-DD' o NULL para citas de hoy
);

-- Ventas / Tickets
CREATE TABLE ventas (
  id         text PRIMARY KEY,
  ticket     text,
  fecha      text,
  cliente    text,
  cliente_id text,
  pago       text DEFAULT 'Efectivo',
  estado     text DEFAULT 'pendiente',
  descuento  numeric DEFAULT 0,
  anticipo   numeric DEFAULT 0
);

-- Líneas de venta
CREATE TABLE lineas_venta (
  id       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  venta_id text REFERENCES ventas(id) ON DELETE CASCADE,
  tipo     text,
  nombre   text,
  est      text,
  cant     integer DEFAULT 1,
  precio   numeric DEFAULT 0,
  com      numeric DEFAULT 0
);

-- Productos / Inventario
CREATE TABLE productos (
  id       text PRIMARY KEY,
  sku      text,
  nombre   text NOT NULL,
  marca    text,
  cat      text,
  uso      text DEFAULT 'retail',
  costo    numeric DEFAULT 0,
  precio   numeric DEFAULT 0,
  stock    integer DEFAULT 0,
  min      integer DEFAULT 0,
  vendidos integer DEFAULT 0
);

-- Movimientos de inventario
CREATE TABLE movimientos (
  id     text PRIMARY KEY,
  fecha  text,
  prod   text,
  tipo   text,
  cant   integer,
  motivo text,
  ref    text
);

-- Plantillas de WhatsApp
CREATE TABLE plantillas (
  id     text PRIMARY KEY,
  nombre text,
  icon   text,
  txt    text
);

-- Usuarios del sistema (con contraseña propia, sin usar Supabase Auth)
CREATE TABLE usuarios (
  id     text PRIMARY KEY,
  nombre text NOT NULL,
  rol    text DEFAULT 'recepcion',
  ini    text,
  color  text,
  email  text UNIQUE,
  tel    text,
  activo boolean DEFAULT true,
  ultimo text,
  pass   text
);

-- ── 3. RLS — ACCESO ANON (app usa auth propia, no Supabase Auth) ──

ALTER TABLE config       ENABLE ROW LEVEL SECURITY;
ALTER TABLE estilistas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicios    ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE citas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineas_venta ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE plantillas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios     ENABLE ROW LEVEL SECURITY;

-- Permitir acceso completo con anon key (la app gestiona auth internamente)
CREATE POLICY "anon_all" ON config       FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON estilistas   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON servicios    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON clientas     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON citas        FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON ventas       FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON lineas_venta FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON productos    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON movimientos  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON plantillas   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON usuarios     FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── 4. ÍNDICES ───────────────────────────────────────────────
CREATE INDEX idx_citas_fecha    ON citas(fecha);
CREATE INDEX idx_citas_est      ON citas(est);
CREATE INDEX idx_ventas_fecha   ON ventas(fecha);
CREATE INDEX idx_lineas_venta   ON lineas_venta(venta_id);
CREATE INDEX idx_movimientos    ON movimientos(ref);

-- ===== 005_add_bloqueos.sql =====
-- Tabla de bloqueos de horario en agenda
CREATE TABLE IF NOT EXISTS bloqueos (
  id    text PRIMARY KEY,
  est   text,
  h     text,
  fin   text,
  nota  text,
  fecha text
);

ALTER TABLE bloqueos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON bloqueos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_bloqueos_est ON bloqueos(est);

-- ===== 006_add_gastos.sql =====
-- Tabla de gastos operativos del salón
CREATE TABLE IF NOT EXISTS gastos (
  id        text PRIMARY KEY,
  concepto  text,
  monto     numeric,
  fecha     text,
  categoria text
);

ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON gastos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos(fecha);

-- ===== 007_add_escala_comisiones.sql =====
-- Escala progresiva de comisiones y columna email en clientas
ALTER TABLE config ADD COLUMN IF NOT EXISTS escala_comisiones jsonb DEFAULT '[]'::jsonb;
ALTER TABLE clientas ADD COLUMN IF NOT EXISTS email text;

-- ===== 008_add_media_columns.sql =====
-- Columnas para imágenes: logo del salón, avatar de usuario, fotos antes/después de clientas
ALTER TABLE config    ADD COLUMN IF NOT EXISTS logo    text;
ALTER TABLE usuarios  ADD COLUMN IF NOT EXISTS avatar  text;
ALTER TABLE clientas  ADD COLUMN IF NOT EXISTS fotos   jsonb DEFAULT '[]'::jsonb;

-- ===== 009_add_avatar_to_usuarios.sql =====
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avatar text;

-- ===== 011_create_reset_tokens.sql =====
CREATE TABLE IF NOT EXISTS reset_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id text NOT NULL,
  token      text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  used       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Solo lectura/escritura pública (el token es el secreto)
ALTER TABLE reset_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reset_tokens_all" ON reset_tokens FOR ALL TO public USING (true) WITH CHECK (true);

-- ===== 012_add_cita_id_to_ventas.sql =====
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS cita_id text;

-- ===== 013_add_foto_bio_to_estilistas.sql =====
ALTER TABLE estilistas ADD COLUMN IF NOT EXISTS foto text;
ALTER TABLE estilistas ADD COLUMN IF NOT EXISTS bio text;

-- ===== 014_add_service_fields_from_excel.sql =====
ALTER TABLE servicios
  ADD COLUMN IF NOT EXISTS descripcion text,
  ADD COLUMN IF NOT EXISTS precio_visible boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS precio_variable boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS domicilio boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS com_valor integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS com_tipo text DEFAULT 'porcentaje';

-- ===== 015_auth_foundation.sql =====
-- Robsen — Fundamento para migrar a Supabase Auth con roles reales
-- Aditivo y seguro: no borra ni modifica datos existentes.

alter table usuarios add column if not exists auth_user_id uuid unique references auth.users(id);
alter table usuarios add column if not exists estilista_id text references estilistas(id);
alter table ventas   add column if not exists saldo_cobrado_en timestamptz;

-- ── Helpers de rol, usados por las políticas RLS reales (migración 016) ──
create or replace function preview.current_rol()
returns text
language sql security definer stable
set search_path = preview
as $$
  select rol from usuarios where auth_user_id = auth.uid() and activo = true
$$;

create or replace function preview.current_estilista_id()
returns text
language sql security definer stable
set search_path = preview
as $$
  select estilista_id from usuarios where auth_user_id = auth.uid() and activo = true
$$;

create or replace function preview.is_active()
returns boolean
language sql security definer stable
set search_path = preview
as $$
  select coalesce((select activo from usuarios where auth_user_id = auth.uid()), false)
$$;

grant execute on function preview.current_rol() to anon, authenticated;
grant execute on function preview.current_estilista_id() to anon, authenticated;
grant execute on function preview.is_active() to anon, authenticated;

-- ===== 016_authenticated_rls_policies.sql =====
-- Políticas reales por rol para `authenticated` (Supabase Auth).
-- Aditivo: la política anon_all existente NO se toca aquí todavía.
-- Se retira en una migración posterior, una vez verificado que el
-- nuevo frontend con Supabase Auth funciona en producción.

-- ============ USUARIOS ============
create policy "usuarios_select_self_or_gestion" on usuarios for select to authenticated
  using (auth_user_id = auth.uid() or preview.current_rol() in ('admin','gerente'));

create policy "usuarios_update_self" on usuarios for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

create policy "usuarios_admin_write" on usuarios for all to authenticated
  using (preview.current_rol() = 'admin')
  with check (preview.current_rol() = 'admin');

-- ============ CLIENTAS ============
create policy "clientas_select" on clientas for select to authenticated
  using (
    preview.current_rol() in ('admin','gerente','recepcion')
    or (preview.current_rol() = 'estilista' and id in (
      select cliente_id from citas where est = preview.current_estilista_id() and cliente_id is not null
    ))
  );

create policy "clientas_write_gestion" on clientas for all to authenticated
  using (preview.current_rol() in ('admin','gerente','recepcion'))
  with check (preview.current_rol() in ('admin','gerente','recepcion'));

-- ============ CITAS ============
create policy "citas_select" on citas for select to authenticated
  using (
    preview.current_rol() in ('admin','gerente','recepcion')
    or (preview.current_rol() = 'estilista' and est = preview.current_estilista_id())
  );

create policy "citas_write_gestion" on citas for all to authenticated
  using (preview.current_rol() in ('admin','gerente','recepcion'))
  with check (preview.current_rol() in ('admin','gerente','recepcion'));

create policy "citas_update_propia_estilista" on citas for update to authenticated
  using (preview.current_rol() = 'estilista' and est = preview.current_estilista_id())
  with check (preview.current_rol() = 'estilista' and est = preview.current_estilista_id());

-- ============ VENTAS ============
create policy "ventas_select" on ventas for select to authenticated
  using (
    preview.current_rol() in ('admin','gerente','recepcion')
    or (preview.current_rol() = 'estilista' and exists (
      select 1 from lineas_venta lv where lv.venta_id = ventas.id and lv.est = preview.current_estilista_id()
    ))
  );

create policy "ventas_write_gestion" on ventas for all to authenticated
  using (preview.current_rol() in ('admin','gerente','recepcion'))
  with check (preview.current_rol() in ('admin','gerente','recepcion'));

create policy "ventas_insert_estilista" on ventas for insert to authenticated
  with check (preview.current_rol() = 'estilista');

-- Sin política de delete para estilista: queda bloqueado por defecto (deny-by-default).

-- ============ LINEAS_VENTA ============
create policy "lineas_venta_select" on lineas_venta for select to authenticated
  using (
    preview.current_rol() in ('admin','gerente','recepcion')
    or (preview.current_rol() = 'estilista' and est = preview.current_estilista_id())
  );

create policy "lineas_venta_write_gestion" on lineas_venta for all to authenticated
  using (preview.current_rol() in ('admin','gerente','recepcion'))
  with check (preview.current_rol() in ('admin','gerente','recepcion'));

create policy "lineas_venta_insert_estilista" on lineas_venta for insert to authenticated
  with check (preview.current_rol() = 'estilista' and (est = preview.current_estilista_id() or est is null));

-- ============ SERVICIOS ============
create policy "servicios_select_authenticated" on servicios for select to authenticated
  using (preview.is_active());

create policy "servicios_write_admin_gerente" on servicios for all to authenticated
  using (preview.current_rol() in ('admin','gerente'))
  with check (preview.current_rol() in ('admin','gerente'));

-- ============ PRODUCTOS ============
create policy "productos_select_authenticated" on productos for select to authenticated
  using (preview.is_active());

create policy "productos_write_admin_gerente" on productos for all to authenticated
  using (preview.current_rol() in ('admin','gerente'))
  with check (preview.current_rol() in ('admin','gerente'));

-- recepcion/estilista solo pueden mover stock/vendidos (POS), nunca precio/costo.
create policy "productos_update_stock_operativo" on productos for update to authenticated
  using (preview.current_rol() in ('recepcion','estilista'))
  with check (
    preview.current_rol() in ('recepcion','estilista')
    and precio = (select p2.precio from productos p2 where p2.id = productos.id)
    and costo  = (select p2.costo  from productos p2 where p2.id = productos.id)
  );

-- ============ ESTILISTAS ============
create policy "estilistas_select_authenticated" on estilistas for select to authenticated
  using (preview.is_active());

create policy "estilistas_write_admin_gerente" on estilistas for all to authenticated
  using (preview.current_rol() in ('admin','gerente'))
  with check (preview.current_rol() in ('admin','gerente'));

-- ============ CONFIG ============
create policy "config_select_authenticated" on config for select to authenticated
  using (preview.is_active());

create policy "config_write_admin_gerente" on config for all to authenticated
  using (preview.current_rol() in ('admin','gerente'))
  with check (preview.current_rol() in ('admin','gerente'));

-- ============ BLOQUEOS ============
create policy "bloqueos_select_authenticated" on bloqueos for select to authenticated
  using (preview.is_active());

create policy "bloqueos_write_gestion" on bloqueos for all to authenticated
  using (preview.current_rol() in ('admin','gerente','recepcion'))
  with check (preview.current_rol() in ('admin','gerente','recepcion'));

create policy "bloqueos_write_propio_estilista" on bloqueos for all to authenticated
  using (preview.current_rol() = 'estilista' and est = preview.current_estilista_id())
  with check (preview.current_rol() = 'estilista' and est = preview.current_estilista_id());

-- ============ GASTOS ============
create policy "gastos_admin_gerente" on gastos for all to authenticated
  using (preview.current_rol() in ('admin','gerente'))
  with check (preview.current_rol() in ('admin','gerente'));

-- ============ MOVIMIENTOS ============
create policy "movimientos_select" on movimientos for select to authenticated
  using (preview.current_rol() in ('admin','gerente','recepcion'));

create policy "movimientos_insert" on movimientos for insert to authenticated
  with check (preview.current_rol() in ('admin','gerente','recepcion','estilista'));

-- ============ PLANTILLAS ============
create policy "plantillas_select_authenticated" on plantillas for select to authenticated
  using (preview.is_active());

create policy "plantillas_write_gestion" on plantillas for all to authenticated
  using (preview.current_rol() in ('admin','gerente','recepcion'))
  with check (preview.current_rol() in ('admin','gerente','recepcion'));

-- ===== 017_close_open_policies.sql =====
-- Cierra el hueco real: quita las políticas anon_all (USING true) que dejaban
-- todas las tablas abiertas a cualquiera con la anon key. Se agregan solo las
-- lecturas anónimas mínimas que la app necesita (picker de login y catálogo
-- público de servicios/estilistas/config).

drop policy if exists "anon_all" on bloqueos;
drop policy if exists "anon_all" on citas;
drop policy if exists "anon_all" on clientas;
drop policy if exists "anon_all" on config;
drop policy if exists "anon_all" on estilistas;
drop policy if exists "anon_all" on gastos;
drop policy if exists "anon_all" on lineas_venta;
drop policy if exists "anon_all" on movimientos;
drop policy if exists "anon_all" on plantillas;
drop policy if exists "anon_all" on productos;
drop policy if exists "anon_all" on servicios;
drop policy if exists "anon_all" on usuarios;
drop policy if exists "anon_all" on ventas;
drop policy if exists "reset_tokens_all" on reset_tokens;

-- Lecturas anónimas mínimas necesarias:
-- picker de login (sin contraseña, esa columna se elimina en la siguiente migración)
create policy "usuarios_select_anon_login" on usuarios for select to anon using (true);
-- catálogo público (sin datos de clientas ni cifras del negocio)
create policy "servicios_select_anon" on servicios for select to anon using (true);
create policy "estilistas_select_anon" on estilistas for select to anon using (true);
create policy "config_select_anon" on config for select to anon using (true);

-- ===== 018_drop_plaintext_password.sql =====
-- El frontend ya no lee ni escribe contraseñas (usa Supabase Auth).
-- Se elimina la columna que las guardaba en texto plano.
alter table usuarios drop column if exists pass;

-- ===== 019_login_picker_solo_cuentas_reales.sql =====
-- El picker de login mostraba todos los perfiles activos, aunque no tuvieran
-- cuenta de Supabase Auth vinculada todavía (ej. Recepción). Se limita a los
-- perfiles que sí pueden iniciar sesión de verdad.
drop policy if exists "usuarios_select_anon_login" on usuarios;

create policy "usuarios_select_anon_login" on usuarios for select to anon
  using (auth_user_id is not null);

-- ===== 020_audit_logs.sql =====
-- Auditoría mínima: quién cambió qué, cuándo, y con qué valores.
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  usuario_id text references usuarios(id),
  usuario_nombre text,
  accion text not null check (accion in ('insert','update','delete')),
  tabla text not null,
  registro_id text not null,
  valores_antes jsonb,
  valores_despues jsonb,
  creado_en timestamptz not null default now()
);
create index idx_audit_logs_tabla_registro on audit_logs(tabla, registro_id);
create index idx_audit_logs_creado_en on audit_logs(creado_en desc);

alter table audit_logs enable row level security;

-- Solo admin/gerente pueden leer el historial. Nadie escribe directo:
-- solo el trigger (SECURITY DEFINER) inserta filas aquí.
create policy "audit_logs_select_gestion" on audit_logs for select to authenticated
  using (preview.current_rol() in ('admin','gerente'));

create or replace function preview.fn_audit_log()
returns trigger
language plpgsql security definer
set search_path = preview
as $$
declare
  v_usuario_id text;
  v_usuario_nombre text;
  v_registro_id text;
begin
  select id, nombre into v_usuario_id, v_usuario_nombre from usuarios where auth_user_id = auth.uid();

  if tg_op = 'DELETE' then
    v_registro_id := old.id::text;
    insert into audit_logs (usuario_id, usuario_nombre, accion, tabla, registro_id, valores_antes, valores_despues)
    values (v_usuario_id, v_usuario_nombre, 'delete', tg_table_name, v_registro_id, to_jsonb(old), null);
    return old;
  elsif tg_op = 'UPDATE' then
    v_registro_id := new.id::text;
    insert into audit_logs (usuario_id, usuario_nombre, accion, tabla, registro_id, valores_antes, valores_despues)
    values (v_usuario_id, v_usuario_nombre, 'update', tg_table_name, v_registro_id, to_jsonb(old), to_jsonb(new));
    return new;
  else
    v_registro_id := new.id::text;
    insert into audit_logs (usuario_id, usuario_nombre, accion, tabla, registro_id, valores_antes, valores_despues)
    values (v_usuario_id, v_usuario_nombre, 'insert', tg_table_name, v_registro_id, null, to_jsonb(new));
    return new;
  end if;
end;
$$;

create trigger trg_audit_citas      after insert or update or delete on citas      for each row execute function preview.fn_audit_log();
create trigger trg_audit_ventas     after insert or update or delete on ventas     for each row execute function preview.fn_audit_log();
create trigger trg_audit_servicios  after insert or update or delete on servicios  for each row execute function preview.fn_audit_log();
create trigger trg_audit_usuarios   after insert or update or delete on usuarios   for each row execute function preview.fn_audit_log();
create trigger trg_audit_clientas   after insert or update or delete on clientas   for each row execute function preview.fn_audit_log();

-- ===== 021_servicios_activo_dedupe_validaciones.sql =====
-- Servicios desactivables sin borrar
alter table servicios add column if not exists activo boolean not null default true;

-- Protección real contra clientas duplicadas por teléfono (bloqueo exacto en BD)
alter table clientas add column if not exists tel_normalizado text
  generated always as (regexp_replace(coalesce(tel,''), '[^0-9]', '', 'g')) stored;
create unique index if not exists idx_clientas_tel_unico
  on clientas(tel_normalizado) where tel_normalizado <> '';

-- Estado "no_asistio" para citas, distinto de "cancelada"
alter table citas add constraint citas_estado_valido
  check (estado in ('pend','conf','pay','done','canc','no_asistio'));

-- Validaciones mínimas en base de datos (no solo en el frontend)
alter table citas add constraint citas_total_no_negativo check (total >= 0);
alter table citas add constraint citas_anticipo_no_negativo check (ant >= 0);
alter table citas add constraint citas_anticipo_no_mayor_total check (ant <= total);
alter table ventas add constraint ventas_descuento_no_negativo check (descuento >= 0);
alter table ventas add constraint ventas_anticipo_no_negativo check (anticipo >= 0);
alter table productos add constraint productos_precio_no_negativo check (precio >= 0);
alter table productos add constraint productos_stock_no_negativo check (stock >= 0);
alter table servicios add constraint servicios_precio_no_negativo check (precio >= 0);

-- Evita citas encimadas de la misma estilista a nivel de base de datos
-- (el frontend ya lo evita, esto es la red de seguridad real).
create or replace function preview.fn_check_cita_solapada()
returns trigger
language plpgsql
as $$
declare
  v_conflicto int;
  v_inicio int;
  v_fin int;
begin
  if new.estado = 'canc' or new.est is null then
    return new;
  end if;
  v_inicio := (split_part(new.h, ':', 1)::int * 60) + split_part(new.h, ':', 2)::int;
  v_fin := v_inicio + coalesce(new.dur, 60);

  select count(*) into v_conflicto
  from citas c
  where c.est = new.est
    and c.id <> new.id
    and c.estado <> 'canc'
    and coalesce(c.fecha, '') = coalesce(new.fecha, '')
    and (
      (split_part(c.h, ':', 1)::int * 60 + split_part(c.h, ':', 2)::int) < v_fin
      and
      (split_part(c.h, ':', 1)::int * 60 + split_part(c.h, ':', 2)::int + coalesce(c.dur, 60)) > v_inicio
    );

  if v_conflicto > 0 then
    raise exception 'Ya existe una cita para esa estilista en ese horario';
  end if;
  return new;
end;
$$;

create trigger trg_citas_no_solapar
  before insert or update on citas
  for each row execute function preview.fn_check_cita_solapada();

-- ===== 022_cierres_caja.sql =====
create table cierres_caja (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  usuario_id text references usuarios(id),
  usuario_nombre text,
  total_efectivo numeric(10,2) not null default 0,
  total_transferencia numeric(10,2) not null default 0,
  total_tarjeta numeric(10,2) not null default 0,
  total_pendiente numeric(10,2) not null default 0,
  anticipos_cobrados numeric(10,2) not null default 0,
  saldos_cobrados numeric(10,2) not null default 0,
  ventas_total numeric(10,2) not null default 0,
  efectivo_contado numeric(10,2),
  diferencia numeric(10,2),
  notas text,
  cerrado_en timestamptz not null default now()
);
create index idx_cierres_caja_fecha on cierres_caja(fecha desc);

alter table cierres_caja enable row level security;

-- Es un libro de cierres: se puede crear y consultar, nunca editar ni borrar.
create policy "cierres_caja_select" on cierres_caja for select to authenticated
  using (preview.current_rol() in ('admin','gerente','recepcion'));

create policy "cierres_caja_insert" on cierres_caja for insert to authenticated
  with check (preview.current_rol() in ('admin','gerente','recepcion'));

-- ===== 023_saldo_cobrado_monto.sql =====
-- Guarda el monto exacto que se cobró al liquidar un saldo, independiente
-- de que el campo `anticipo` se sobreescriba después. Sin esto, el corte
-- de caja no puede saber cuánto dinero entró realmente hoy por saldos
-- de citas que se crearon en otro día.
alter table ventas add column if not exists saldo_cobrado_monto numeric(10,2);

-- ===== 024_endurecer_funciones.sql =====
-- Fija el search_path (evita hijacking por search_path mutable)
create or replace function preview.fn_check_cita_solapada()
returns trigger
language plpgsql
set search_path = preview
as $$
declare
  v_conflicto int;
  v_inicio int;
  v_fin int;
begin
  if new.estado = 'canc' or new.est is null then
    return new;
  end if;
  v_inicio := (split_part(new.h, ':', 1)::int * 60) + split_part(new.h, ':', 2)::int;
  v_fin := v_inicio + coalesce(new.dur, 60);

  select count(*) into v_conflicto
  from citas c
  where c.est = new.est
    and c.id <> new.id
    and c.estado <> 'canc'
    and coalesce(c.fecha, '') = coalesce(new.fecha, '')
    and (
      (split_part(c.h, ':', 1)::int * 60 + split_part(c.h, ':', 2)::int) < v_fin
      and
      (split_part(c.h, ':', 1)::int * 60 + split_part(c.h, ':', 2)::int + coalesce(c.dur, 60)) > v_inicio
    );

  if v_conflicto > 0 then
    raise exception 'Ya existe una cita para esa estilista en ese horario';
  end if;
  return new;
end;
$$;

-- fn_audit_log solo debe correr como trigger, nunca invocarse directo vía RPC.
revoke execute on function preview.fn_audit_log() from public, anon, authenticated;

-- ===== 025_permitir_borrar_usuarios.sql =====
-- Permite borrar un usuario aunque tenga historial: el nombre queda
-- guardado como texto en audit_logs/cierres_caja (ya se captura al
-- momento del registro), solo se pierde la referencia al id.
alter table audit_logs drop constraint audit_logs_usuario_id_fkey;
alter table audit_logs add constraint audit_logs_usuario_id_fkey
  foreign key (usuario_id) references usuarios(id) on delete set null;

alter table cierres_caja drop constraint cierres_caja_usuario_id_fkey;
alter table cierres_caja add constraint cierres_caja_usuario_id_fkey
  foreign key (usuario_id) references usuarios(id) on delete set null;

-- ===== 026_hardening_seguridad_release_candidate.sql =====
-- Auditoría pre-release: cierra una filtración real de PII y endurece storage.
--
-- 1) El picker de login (anon, antes de autenticar) hacía select('*') sobre
--    usuarios, exponiendo tel/auth_user_id/estilista_id de todo el personal
--    (confirmado con curl real usando solo la anon key). Se reemplaza por una
--    vista con solo las columnas necesarias para elegir perfil + iniciar
--    sesión, y una función para buscar por correo/teléfono sin exponer la
--    tabla completa.
create view preview.usuarios_publicos as
select id, nombre, rol, ini, color, avatar, activo, email
from preview.usuarios
where auth_user_id is not null;

grant select on preview.usuarios_publicos to anon;

drop policy if exists "usuarios_select_anon_login" on preview.usuarios;

create or replace function preview.buscar_usuario_login(q text)
returns table(id text, nombre text, rol text, ini text, color text, avatar text, activo boolean, email text)
language sql security definer stable
set search_path = preview
as $$
  select u.id, u.nombre, u.rol, u.ini, u.color, u.avatar, u.activo, u.email
  from usuarios u
  where u.auth_user_id is not null
    and u.activo = true
    and (
      lower(u.email) = lower(q)
      or regexp_replace(coalesce(u.tel,''), '[^0-9]', '', 'g') = regexp_replace(q, '[^0-9]', '', 'g')
    )
  limit 1
$$;

grant execute on function preview.buscar_usuario_login(text) to anon;
-- 4) reset_tokens: sistema de recuperación por token propio, reemplazado por
--    Supabase Auth hace varias migraciones. Tenía RLS activo sin políticas
--    (nadie podía leerla vía API, no era explotable), pero es basura que ya
--    no debería seguir en el esquema de producción. El código que la
--    consumía ya se eliminó del frontend en esta misma sesión.
drop table if exists preview.reset_tokens;

-- Nota deliberada: el advisor de seguridad también marca current_rol(),
-- current_estilista_id() e is_active() como SECURITY DEFINER ejecutables
-- vía RPC directo por anon/authenticated. NO se revoca ese EXECUTE: casi
-- todas las políticas RLS de authenticated dependen de current_rol(), y
-- revocar su ejecución directa rompería el acceso de TODA la app para
-- usuarios autenticados (la evaluación de políticas RLS sí requiere permiso
-- de EXECUTE sobre las funciones que referencia). El riesgo real para anon
-- es prácticamente nulo (auth.uid() es null sin sesión, así que devuelven
-- null/false, no filtran nada), así que se documenta como aceptado en vez
-- de arriesgar una regresión total por un beneficio marginal.

-- ===== 027_usuarios_publicos_como_funcion.sql =====
-- El advisor de seguridad marca como ERROR cualquier vista que no declare
-- security_invoker, porque por defecto una vista corre con los privilegios
-- de quien la creó y puede saltarse el RLS de la tabla base sin que se note.
-- En este caso es intencional (anon ya no tiene ninguna política de SELECT
-- en `usuarios`, así que con security_invoker el picker de login quedaría
-- vacío) — pero el patrón que Supabase espera para "exponer una porción
-- curada de datos a anon" es una función SECURITY DEFINER, igual que ya se
-- usa en buscar_usuario_login(), no una vista. Se reemplaza la vista por una
-- función equivalente para que el lint quede limpio sin cambiar el resultado.

drop view if exists preview.usuarios_publicos;

create or replace function preview.listar_usuarios_publicos()
returns table(id text, nombre text, rol text, ini text, color text, avatar text, activo boolean, email text)
language sql security definer stable
set search_path = preview
as $$
  select u.id, u.nombre, u.rol, u.ini, u.color, u.avatar, u.activo, u.email
  from usuarios u
  where u.auth_user_id is not null
$$;

grant execute on function preview.listar_usuarios_publicos() to anon;

-- ===== 028_crear_venta_con_lineas.sql =====
-- Venta transaccional: crear_venta_con_lineas
-- Antes, db.addVenta hacía dos escrituras separadas (insert en `ventas`,
-- luego insert en `lineas_venta`) con una compensación manual en JS si la
-- segunda fallaba. Esta función mueve esa lógica a una sola transacción de
-- Postgres — si cualquier paso falla, todo se revierte automáticamente,
-- sin necesidad de borrar nada a mano después.

-- Columna nueva para identificar el producto de forma confiable (antes solo
-- se guardaba el nombre, frágil si el nombre cambia o se repite). Nullable
-- y aditiva: no rompe filas existentes, no se hace backfill histórico.
alter table lineas_venta add column if not exists producto_id text references productos(id);

create or replace function preview.crear_venta_con_lineas(p_venta jsonb, p_lineas jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = preview
as $$
declare
  v_linea jsonb;
  v_num_lineas int;
  v_total numeric := 0;
  v_cant int;
  v_precio numeric;
  v_filas_actualizadas int;
  v_result jsonb;
begin
  v_num_lineas := jsonb_array_length(coalesce(p_lineas, '[]'::jsonb));
  if v_num_lineas = 0 then
    raise exception 'Una venta debe tener al menos una línea';
  end if;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_cant := (v_linea->>'cant')::int;
    v_precio := (v_linea->>'precio')::numeric;
    if v_cant is null or v_cant <= 0 then
      raise exception 'Cada línea debe tener una cantidad mayor a cero';
    end if;
    if v_precio is null or v_precio < 0 then
      raise exception 'Cada línea debe tener un precio válido';
    end if;
    v_total := v_total + v_precio * v_cant;
  end loop;

  if v_total < 0 then
    raise exception 'El total de la venta no puede ser negativo';
  end if;

  insert into ventas (id, ticket, fecha, cliente, cliente_id, pago, estado, descuento, anticipo, cita_id)
  values (
    p_venta->>'id', p_venta->>'ticket', p_venta->>'fecha', p_venta->>'cliente',
    nullif(p_venta->>'cliente_id', ''), p_venta->>'pago', p_venta->>'estado',
    coalesce((p_venta->>'descuento')::numeric, 0), coalesce((p_venta->>'anticipo')::numeric, 0),
    nullif(p_venta->>'cita_id', '')
  );

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    insert into lineas_venta (venta_id, tipo, nombre, producto_id, est, cant, precio, com)
    values (
      p_venta->>'id',
      v_linea->>'tipo',
      v_linea->>'nombre',
      nullif(v_linea->>'producto_id', ''),
      nullif(v_linea->>'est', ''),
      (v_linea->>'cant')::int,
      (v_linea->>'precio')::numeric,
      coalesce((v_linea->>'com')::numeric, 0)
    );

    if v_linea->>'tipo' = 'producto' and nullif(v_linea->>'producto_id', '') is not null then
      update productos
        set stock = stock - (v_linea->>'cant')::int,
            vendidos = vendidos + (v_linea->>'cant')::int
        where id = v_linea->>'producto_id';
      get diagnostics v_filas_actualizadas = row_count;
      if v_filas_actualizadas = 0 then
        raise exception 'Producto % no encontrado', v_linea->>'producto_id';
      end if;

      insert into movimientos (id, fecha, prod, tipo, cant, motivo, ref)
      values (
        'mv' || replace(gen_random_uuid()::text, '-', ''),
        to_char(now(), 'DD Mon · HH24:MI'),
        v_linea->>'nombre',
        'salida',
        (v_linea->>'cant')::int,
        'Venta · ' || (p_venta->>'ticket'),
        p_venta->>'id'
      );
    end if;
  end loop;

  select jsonb_build_object(
    'venta', to_jsonb(v.*),
    'lineas', coalesce((select jsonb_agg(to_jsonb(l.*)) from lineas_venta l where l.venta_id = v.id), '[]'::jsonb)
  ) into v_result
  from ventas v where v.id = p_venta->>'id';

  return v_result;
end;
$$;

grant execute on function preview.crear_venta_con_lineas(jsonb, jsonb) to authenticated;

-- ===== 029_comisiones_por_empleado.sql =====
-- Consolida la comisión: deja de existir "comisión del servicio" y la única
-- base real pasa a ser la comisión del empleado, con una excepción puntual
-- opcional por servicio (estilistas.comisiones).

-- Excepción puntual por servicio: { [servicio_id]: pct }. Mismo patrón que
-- ya usaba config.comisiones, ahora a nivel de cada estilista.
alter table estilistas add column if not exists comisiones jsonb not null default '{}'::jsonb;

-- Estos dos campos nunca afectaron el cálculo real de una venta (confirmado
-- revisando POS.tsx) — se eliminan a favor del modelo por empleado.
alter table servicios drop column if exists com_valor;
alter table servicios drop column if exists com_tipo;

-- ===== 030_citas_multiservicio.sql =====
-- Soporte de múltiples servicios por cita. Las columnas existentes (srv, dur,
-- total, servicio_id) siguen guardando el resumen agregado para retro-
-- compatibilidad: srv = nombres unidos, dur = suma de duraciones, total = suma
-- de precios, servicio_id = primer servicio. El detalle por servicio vive aquí.
alter table citas add column if not exists servicios jsonb;

-- ===== 031_eliminar_venta.sql =====
-- Borrado transaccional de una venta. Al crear una venta con productos se
-- descuenta el stock, se incrementa `vendidos` y se registra un movimiento de
-- salida (ver crear_venta_con_lineas). Borrar la venta debe revertir todo eso,
-- si no el inventario queda corrupto. Se hace en una sola transacción; si algo
-- falla, no se borra nada.
create or replace function preview.eliminar_venta(p_venta_id text)
returns void
language plpgsql
security invoker
set search_path = preview
as $$
declare
  v_linea record;
  v_ticket text;
begin
  select ticket into v_ticket from ventas where id = p_venta_id;
  if v_ticket is null then
    raise exception 'Venta % no encontrada', p_venta_id;
  end if;

  -- Reponer el stock de cada producto vendido y registrar el movimiento inverso.
  for v_linea in
    select producto_id, nombre, cant
    from lineas_venta
    where venta_id = p_venta_id and tipo = 'producto' and producto_id is not null
  loop
    update productos
      set stock = stock + v_linea.cant,
          vendidos = greatest(0, vendidos - v_linea.cant)
      where id = v_linea.producto_id;

    insert into movimientos (id, fecha, prod, tipo, cant, motivo, ref)
    values (
      'mv' || replace(gen_random_uuid()::text, '-', ''),
      to_char(now(), 'DD Mon · HH24:MI'),
      v_linea.nombre, 'entrada', v_linea.cant,
      'Cancelación · ' || v_ticket, p_venta_id
    );
  end loop;

  -- lineas_venta cae por ON DELETE CASCADE.
  delete from ventas where id = p_venta_id;
end;
$$;

grant execute on function preview.eliminar_venta(text) to authenticated;

-- ===== 032_solapamiento_por_servicio.sql =====
-- La validación de traslape de citas debe operar por servicio, no por el
-- agregado de la cita. Antes usaba new.est + new.dur (suma), lo que reservaba
-- toda la duración de una cita multi-servicio en un solo empleado. Ahora cada
-- servicio puede tener su propio empleado (est) y hora (h) en el jsonb
-- `servicios`; se expanden en bloques y se compara bloque contra bloque del
-- mismo empleado y día. Retrocompatible: una cita sin est/h por servicio se
-- trata como un único bloque con el est/h/dur de la cita.
create or replace function preview.fn_check_cita_solapada()
returns trigger
language plpgsql
as $$
declare
  v_new_blocks jsonb;
  v_nb jsonb;
  v_ob jsonb;
  v_other record;
  v_est text;
  v_ns int; v_ne int;
  v_os int; v_oe int;
begin
  if new.estado = 'canc' then
    return new;
  end if;

  if new.servicios is not null and jsonb_array_length(new.servicios) > 0
     and exists (select 1 from jsonb_array_elements(new.servicios) s
                 where s->>'est' is not null or s->>'h' is not null) then
    select jsonb_agg(jsonb_build_object(
             'est', coalesce(s->>'est', new.est),
             'h',   coalesce(s->>'h', new.h),
             'dur', coalesce((s->>'dur')::int, new.dur, 60)))
      into v_new_blocks
      from jsonb_array_elements(new.servicios) s;
  else
    v_new_blocks := jsonb_build_array(
      jsonb_build_object('est', new.est, 'h', new.h, 'dur', coalesce(new.dur, 60)));
  end if;

  for v_nb in select * from jsonb_array_elements(v_new_blocks) loop
    v_est := v_nb->>'est';
    if v_est is null then continue; end if;
    v_ns := (split_part(v_nb->>'h', ':', 1)::int * 60) + split_part(v_nb->>'h', ':', 2)::int;
    v_ne := v_ns + coalesce((v_nb->>'dur')::int, 60);

    for v_other in
      select c.id, c.est, c.h, c.dur, c.servicios
      from citas c
      where c.id <> new.id
        and c.estado <> 'canc'
        and coalesce(c.fecha, '') = coalesce(new.fecha, '')
    loop
      if v_other.servicios is not null and jsonb_array_length(v_other.servicios) > 0
         and exists (select 1 from jsonb_array_elements(v_other.servicios) s
                     where s->>'est' is not null or s->>'h' is not null) then
        for v_ob in select * from jsonb_array_elements(v_other.servicios) loop
          if coalesce(v_ob->>'est', v_other.est) = v_est then
            v_os := (split_part(coalesce(v_ob->>'h', v_other.h), ':', 1)::int * 60)
                    + split_part(coalesce(v_ob->>'h', v_other.h), ':', 2)::int;
            v_oe := v_os + coalesce((v_ob->>'dur')::int, v_other.dur, 60);
            if v_os < v_ne and v_oe > v_ns then
              raise exception 'Ya existe una cita para esa estilista en ese horario';
            end if;
          end if;
        end loop;
      elsif v_other.est = v_est then
        v_os := (split_part(v_other.h, ':', 1)::int * 60) + split_part(v_other.h, ':', 2)::int;
        v_oe := v_os + coalesce(v_other.dur, 60);
        if v_os < v_ne and v_oe > v_ns then
          raise exception 'Ya existe una cita para esa estilista en ese horario';
        end if;
      end if;
    end loop;
  end loop;

  return new;
end;
$$;

-- ===== 033_comision_monto_fijo.sql =====
-- Comisión de monto fijo por servicio. Hasta ahora la comisión de cada línea
-- era solo un porcentaje (col `com`). Se agrega `com_monto`: cuando está
-- presente, el empleado gana ese monto fijo por unidad de esa línea, sin
-- importar el precio ni el descuento. Si es null, se usa el porcentaje.
alter table lineas_venta add column if not exists com_monto numeric;

-- El RPC de venta debe persistir com_monto por línea.
create or replace function preview.crear_venta_con_lineas(p_venta jsonb, p_lineas jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = preview
as $$
declare
  v_linea jsonb;
  v_num_lineas int;
  v_total numeric := 0;
  v_cant int;
  v_precio numeric;
  v_filas_actualizadas int;
  v_result jsonb;
begin
  v_num_lineas := jsonb_array_length(coalesce(p_lineas, '[]'::jsonb));
  if v_num_lineas = 0 then
    raise exception 'Una venta debe tener al menos una línea';
  end if;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_cant := (v_linea->>'cant')::int;
    v_precio := (v_linea->>'precio')::numeric;
    if v_cant is null or v_cant <= 0 then
      raise exception 'Cada línea debe tener una cantidad mayor a cero';
    end if;
    if v_precio is null or v_precio < 0 then
      raise exception 'Cada línea debe tener un precio válido';
    end if;
    v_total := v_total + v_precio * v_cant;
  end loop;

  if v_total < 0 then
    raise exception 'El total de la venta no puede ser negativo';
  end if;

  insert into ventas (id, ticket, fecha, cliente, cliente_id, pago, estado, descuento, anticipo, cita_id)
  values (
    p_venta->>'id', p_venta->>'ticket', p_venta->>'fecha', p_venta->>'cliente',
    nullif(p_venta->>'cliente_id', ''), p_venta->>'pago', p_venta->>'estado',
    coalesce((p_venta->>'descuento')::numeric, 0), coalesce((p_venta->>'anticipo')::numeric, 0),
    nullif(p_venta->>'cita_id', '')
  );

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    insert into lineas_venta (venta_id, tipo, nombre, producto_id, est, cant, precio, com, com_monto)
    values (
      p_venta->>'id',
      v_linea->>'tipo',
      v_linea->>'nombre',
      nullif(v_linea->>'producto_id', ''),
      nullif(v_linea->>'est', ''),
      (v_linea->>'cant')::int,
      (v_linea->>'precio')::numeric,
      coalesce((v_linea->>'com')::numeric, 0),
      nullif(v_linea->>'com_monto', '')::numeric
    );

    if v_linea->>'tipo' = 'producto' and nullif(v_linea->>'producto_id', '') is not null then
      update productos
        set stock = stock - (v_linea->>'cant')::int,
            vendidos = vendidos + (v_linea->>'cant')::int
        where id = v_linea->>'producto_id';
      get diagnostics v_filas_actualizadas = row_count;
      if v_filas_actualizadas = 0 then
        raise exception 'Producto % no encontrado', v_linea->>'producto_id';
      end if;

      insert into movimientos (id, fecha, prod, tipo, cant, motivo, ref)
      values (
        'mv' || replace(gen_random_uuid()::text, '-', ''),
        to_char(now(), 'DD Mon · HH24:MI'),
        v_linea->>'nombre',
        'salida',
        (v_linea->>'cant')::int,
        'Venta · ' || (p_venta->>'ticket'),
        p_venta->>'id'
      );
    end if;
  end loop;

  select jsonb_build_object(
    'venta', to_jsonb(v.*),
    'lineas', coalesce((select jsonb_agg(to_jsonb(l.*)) from lineas_venta l where l.venta_id = v.id), '[]'::jsonb)
  ) into v_result
  from ventas v where v.id = p_venta->>'id';

  return v_result;
end;
$$;

grant execute on function preview.crear_venta_con_lineas(jsonb, jsonb) to authenticated;

-- ===== 034_comision_por_producto.sql =====
-- Comisión propia por producto (sobrescribe la comisión global de "Productos").
-- Puede ser un porcentaje o un monto fijo por unidad. Los nombres de columna
-- se mantienen en camelCase (entre comillas) para coincidir con las claves del
-- objeto Producto en el front, que hace upsert directo sin mapper.
alter table productos add column if not exists "comValor" numeric;
alter table productos add column if not exists "comTipo" text;

-- ===== 035_config_permisos_por_rol.sql =====
-- Permisos de módulos configurables por rol (mapa { rolId: [moduloId, …] }).
-- El admin nunca se guarda aquí: siempre tiene acceso total en la app.
alter table config add column if not exists permisos jsonb not null default '{}'::jsonb;

-- ===== 036_clientas_acceso_estilista.sql =====
-- Cuando el administrador habilita el módulo de Clientas para el rol estilista,
-- este necesita acceso real: ver toda la base y dar de alta / editar. Antes RLS
-- solo dejaba al estilista ver las clientas de sus propias citas y nada de
-- escritura, así que el módulo aparecía pero no funcionaba.

-- Lectura: cualquier usuario activo puede ver la base de clientas (igual que
-- servicios/productos). El módulo se controla en la app por permisos de rol.
drop policy if exists clientas_select on clientas;
create policy clientas_select on clientas
  for select to authenticated
  using (is_active());

-- Escritura (alta / edición / borrado): se agrega estilista a los roles con
-- acceso completo, al mismo nivel que recepción.
drop policy if exists clientas_write_gestion on clientas;
create policy clientas_write_gestion on clientas
  for all to authenticated
  using  (current_rol() = any (array['admin','gerente','recepcion','estilista']))
  with check (current_rol() = any (array['admin','gerente','recepcion','estilista']));

-- ===== 042_clientas_tel_no_unico.sql =====
-- El teléfono deja de ser único a nivel de base: el control de duplicados pasa a
-- ser un aviso con confirmación en la app (algunas clientas comparten teléfono,
-- p. ej. familiares). Se conserva la columna generada tel_normalizado y se
-- reemplaza el índice ÚNICO por uno normal, útil para búsqueda por teléfono.
drop index if exists idx_clientas_tel_unico;
create index if not exists idx_clientas_tel_norm on clientas (tel_normalizado) where tel_normalizado <> '';

-- ===== 043_ventas_created_at.sql =====
-- Fecha real de creación de la venta, para cortes por rango de fechas (el campo
-- 'fecha' es solo texto de despliegue, sin año). Default now() para las nuevas.
alter table ventas add column if not exists created_at timestamptz not null default now();

-- Respaldo de las ventas existentes desde el id (formato 'v' + epoch en ms).
update ventas
  set created_at = to_timestamp((substring(id from 2))::bigint / 1000.0)
  where id ~ '^v[0-9]{13}$';

-- ===== 044_ventas_pago_mixto.sql =====
-- 044_ventas_pago_mixto.sql
-- Pago mixto: una venta puede cobrarse repartida entre varios métodos
-- (efectivo + tarjeta, etc.). Se guarda el desglose en `ventas.pagos` como un
-- arreglo jsonb [{ "metodo": "...", "monto": n }]. Cuando el cobro es de un solo
-- método, `pagos` queda en null y se usa el campo `pago` de siempre.

alter table ventas add column if not exists pagos jsonb;

-- Se redefine el RPC transaccional de creación de venta para persistir `pagos`.
-- Idéntico al anterior salvo por la columna `pagos` en el insert de ventas.
create or replace function preview.crear_venta_con_lineas(p_venta jsonb, p_lineas jsonb)
returns jsonb
language plpgsql
set search_path to 'preview'
as $function$
declare
  v_linea jsonb;
  v_num_lineas int;
  v_total numeric := 0;
  v_cant int;
  v_precio numeric;
  v_filas_actualizadas int;
  v_result jsonb;
begin
  v_num_lineas := jsonb_array_length(coalesce(p_lineas, '[]'::jsonb));
  if v_num_lineas = 0 then
    raise exception 'Una venta debe tener al menos una línea';
  end if;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_cant := (v_linea->>'cant')::int;
    v_precio := (v_linea->>'precio')::numeric;
    if v_cant is null or v_cant <= 0 then
      raise exception 'Cada línea debe tener una cantidad mayor a cero';
    end if;
    if v_precio is null or v_precio < 0 then
      raise exception 'Cada línea debe tener un precio válido';
    end if;
    v_total := v_total + v_precio * v_cant;
  end loop;

  if v_total < 0 then
    raise exception 'El total de la venta no puede ser negativo';
  end if;

  insert into ventas (id, ticket, fecha, cliente, cliente_id, pago, estado, descuento, anticipo, cita_id, pagos)
  values (
    p_venta->>'id', p_venta->>'ticket', p_venta->>'fecha', p_venta->>'cliente',
    nullif(p_venta->>'cliente_id', ''), p_venta->>'pago', p_venta->>'estado',
    coalesce((p_venta->>'descuento')::numeric, 0), coalesce((p_venta->>'anticipo')::numeric, 0),
    nullif(p_venta->>'cita_id', ''),
    case when jsonb_typeof(p_venta->'pagos') = 'array' then p_venta->'pagos' else null end
  );

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    insert into lineas_venta (venta_id, tipo, nombre, producto_id, est, cant, precio, com, com_monto)
    values (
      p_venta->>'id',
      v_linea->>'tipo',
      v_linea->>'nombre',
      nullif(v_linea->>'producto_id', ''),
      nullif(v_linea->>'est', ''),
      (v_linea->>'cant')::int,
      (v_linea->>'precio')::numeric,
      coalesce((v_linea->>'com')::numeric, 0),
      nullif(v_linea->>'com_monto', '')::numeric
    );

    if v_linea->>'tipo' = 'producto' and nullif(v_linea->>'producto_id', '') is not null then
      update productos
        set stock = stock - (v_linea->>'cant')::int,
            vendidos = vendidos + (v_linea->>'cant')::int
        where id = v_linea->>'producto_id';
      get diagnostics v_filas_actualizadas = row_count;
      if v_filas_actualizadas = 0 then
        raise exception 'Producto % no encontrado', v_linea->>'producto_id';
      end if;

      insert into movimientos (id, fecha, prod, tipo, cant, motivo, ref)
      values (
        'mv' || replace(gen_random_uuid()::text, '-', ''),
        to_char(now(), 'DD Mon · HH24:MI'),
        v_linea->>'nombre',
        'salida',
        (v_linea->>'cant')::int,
        'Venta · ' || (p_venta->>'ticket'),
        p_venta->>'id'
      );
    end if;
  end loop;

  select jsonb_build_object(
    'venta', to_jsonb(v.*),
    'lineas', coalesce((select jsonb_agg(to_jsonb(l.*)) from lineas_venta l where l.venta_id = v.id), '[]'::jsonb)
  ) into v_result
  from ventas v where v.id = p_venta->>'id';

  return v_result;
end;
$function$;

-- ===== 051_citas_backfill_fecha.sql =====
-- Backfill: 8 citas tenían fecha = null porque Agenda.tsx omitía el campo
-- 'fecha' deliberadamente al guardar una cita "de hoy" (bug real, corregido
-- en el código de Agenda.tsx + db.ts en el mismo cambio). getCitas() trataba
-- cualquier fecha nula como "hoy" — así que esas citas (algunas ya 'done' de
-- días anteriores) se seguían mostrando como pendientes de hoy sin importar
-- cuánto tiempo pasara. Se reconstruye la fecha real a partir del timestamp
-- embebido en el id (formato 'a<millis>', ej. 'a1785258898979').
update citas
set fecha = (to_timestamp((regexp_replace(id,'\D','','g'))::bigint / 1000.0) at time zone 'America/Mexico_City')::date::text
where id ~ '^a[0-9]{10,}$'
  and (fecha is null or fecha = '');

-- ===== 053_productos_foto_notas_proveedor.sql =====
-- Nota de reconciliación: la tabla real ya no coincide 1:1 con
-- 001_initial_schema.sql (la columna min_stock se renombró a "min" y se
-- quitaron activo/created_at/updated_at en algún momento sin migración
-- versionada). Este archivo solo agrega columnas nuevas sobre el estado
-- real verificado en producción.
alter table productos add column if not exists foto text;
alter table productos add column if not exists notas text;
alter table productos add column if not exists proveedor text;

-- ===== 054_ventas_ticket_secuencia.sql =====
-- 054_ventas_ticket_secuencia.sql
-- El número de ticket se calculaba en el cliente como '#' + (1000 + N + 1),
-- en 3 lugares ligeramente distintos, y ventas.ticket no tiene ninguna
-- restricción unique en la base (se perdió al recrear el esquema en
-- 004_correct_schema.sql). Dos dispositivos offline generarían el mismo
-- ticket y Postgres lo aceptaría sin quejarse — duplicado silencioso, el
-- peor tipo de conflicto para un sistema que ahora puede crear ventas sin
-- conexión en varios dispositivos a la vez.
--
-- Se agrega una secuencia y se asigna el ticket AQUÍ, del lado del servidor,
-- ignorando cualquier valor que mande el cliente (que ahora solo manda un
-- placeholder "Pendiente" mientras la venta no se ha sincronizado — ver
-- TICKET_PENDIENTE en src/data/store.ts).

-- Arranca en 1200: el ticket "#NNNN" más alto ya emitido por el esquema
-- anterior (client-side) es #1169 (confirmado contra la base real) — se deja
-- margen para no generar un número que se vea como retroceso.
create sequence if not exists ventas_ticket_seq start 1200;

create or replace function preview.crear_venta_con_lineas(p_venta jsonb, p_lineas jsonb)
returns jsonb
language plpgsql
set search_path to 'preview'
as $function$
declare
  v_linea jsonb;
  v_num_lineas int;
  v_total numeric := 0;
  v_cant int;
  v_precio numeric;
  v_filas_actualizadas int;
  v_result jsonb;
  v_ticket text;
begin
  v_num_lineas := jsonb_array_length(coalesce(p_lineas, '[]'::jsonb));
  if v_num_lineas = 0 then
    raise exception 'Una venta debe tener al menos una línea';
  end if;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_cant := (v_linea->>'cant')::int;
    v_precio := (v_linea->>'precio')::numeric;
    if v_cant is null or v_cant <= 0 then
      raise exception 'Cada línea debe tener una cantidad mayor a cero';
    end if;
    if v_precio is null or v_precio < 0 then
      raise exception 'Cada línea debe tener un precio válido';
    end if;
    v_total := v_total + v_precio * v_cant;
  end loop;

  if v_total < 0 then
    raise exception 'El total de la venta no puede ser negativo';
  end if;

  -- El ticket SIEMPRE se asigna aquí, nunca con el valor que venga del
  -- cliente — así dos dispositivos offline nunca pueden generar el mismo.
  v_ticket := '#' || nextval('ventas_ticket_seq');

  insert into ventas (id, ticket, fecha, cliente, cliente_id, pago, estado, descuento, anticipo, cita_id, pagos)
  values (
    p_venta->>'id', v_ticket, p_venta->>'fecha', p_venta->>'cliente',
    nullif(p_venta->>'cliente_id', ''), p_venta->>'pago', p_venta->>'estado',
    coalesce((p_venta->>'descuento')::numeric, 0), coalesce((p_venta->>'anticipo')::numeric, 0),
    nullif(p_venta->>'cita_id', ''),
    case when jsonb_typeof(p_venta->'pagos') = 'array' then p_venta->'pagos' else null end
  );

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    insert into lineas_venta (venta_id, tipo, nombre, producto_id, est, cant, precio, com, com_monto)
    values (
      p_venta->>'id',
      v_linea->>'tipo',
      v_linea->>'nombre',
      nullif(v_linea->>'producto_id', ''),
      nullif(v_linea->>'est', ''),
      (v_linea->>'cant')::int,
      (v_linea->>'precio')::numeric,
      coalesce((v_linea->>'com')::numeric, 0),
      nullif(v_linea->>'com_monto', '')::numeric
    );

    if v_linea->>'tipo' = 'producto' and nullif(v_linea->>'producto_id', '') is not null then
      update productos
        set stock = stock - (v_linea->>'cant')::int,
            vendidos = vendidos + (v_linea->>'cant')::int
        where id = v_linea->>'producto_id';
      get diagnostics v_filas_actualizadas = row_count;
      if v_filas_actualizadas = 0 then
        raise exception 'Producto % no encontrado', v_linea->>'producto_id';
      end if;

      insert into movimientos (id, fecha, prod, tipo, cant, motivo, ref)
      values (
        'mv' || replace(gen_random_uuid()::text, '-', ''),
        to_char(now(), 'DD Mon · HH24:MI'),
        v_linea->>'nombre',
        'salida',
        (v_linea->>'cant')::int,
        'Venta · ' || v_ticket,
        p_venta->>'id'
      );
    end if;
  end loop;

  select jsonb_build_object(
    'venta', to_jsonb(v.*),
    'lineas', coalesce((select jsonb_agg(to_jsonb(l.*)) from lineas_venta l where l.venta_id = v.id), '[]'::jsonb)
  ) into v_result
  from ventas v where v.id = p_venta->>'id';

  return v_result;
end;
$function$;


-- ===== Bootstrap de privilegios (Supabase lo hace automático para 'public'
-- al crear el proyecto; un schema nuevo creado a mano no lo hereda) =====
grant usage on schema preview to anon, authenticated, service_role;
grant all on all tables in schema preview to anon, authenticated, service_role;
grant all on all sequences in schema preview to anon, authenticated, service_role;
alter default privileges in schema preview grant all on tables to anon, authenticated, service_role;
alter default privileges in schema preview grant all on sequences to anon, authenticated, service_role;

-- Expone 'preview' a PostgREST (por defecto solo expone 'public').
alter role authenticator set pgrst.db_schemas = 'public, preview';
notify pgrst, 'reload config';

-- Semilla inicial: copia de los datos reales actuales de 'public' a
-- 'preview' (una sola vez, al crear el schema) — desde aquí en adelante
-- la sincronización queda a cargo de los triggers de
-- 058_sync_public_to_preview_triggers.sql, no de este archivo.
insert into preview.config (id, agenda_start, agenda_end, slot_min, dias_abiertos, nombre, direccion, tel, whatsapp, anticipo_pct, requerir_anticipo, iva, metodospago, acento, comisiones, notifs, escala_comisiones, logo, permisos)
  select id, agenda_start, agenda_end, slot_min, dias_abiertos, nombre, direccion, tel, whatsapp, anticipo_pct, requerir_anticipo, iva, metodospago, acento, comisiones, notifs, escala_comisiones, logo, permisos
  from public.config;

insert into preview.estilistas select * from public.estilistas;
insert into preview.servicios select * from public.servicios;
insert into preview.productos select * from public.productos;
insert into preview.usuarios select * from public.usuarios;

insert into preview.clientas (id, nombre, tel, estado, ultima, ticket, fav, est, visitas, gasto, ini, cumple, ciclo, notas, formulas, email, fotos)
  select id, nombre, tel, estado, ultima, ticket, fav, est, visitas, gasto, ini, cumple, ciclo, notas, formulas, email, fotos
  from public.clientas;

insert into preview.bloqueos select * from public.bloqueos;
insert into preview.gastos select * from public.gastos;
insert into preview.citas select * from public.citas;
insert into preview.ventas select * from public.ventas;
insert into preview.lineas_venta select * from public.lineas_venta;
insert into preview.cierres_caja select * from public.cierres_caja;
truncate preview.audit_logs;

-- Funciones orgánicas huérfanas de 001/002, ya limpiadas en 'public' fuera
-- de migración versionada en algún momento — se limpian también en el clon.
drop function if exists preview.update_updated_at() cascade;
drop function if exists preview.after_venta_linea_insert() cascade;
drop function if exists preview.get_user_role() cascade;

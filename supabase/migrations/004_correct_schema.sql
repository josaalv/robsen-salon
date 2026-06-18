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

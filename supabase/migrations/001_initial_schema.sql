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

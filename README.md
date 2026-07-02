# Robsen Salón & Spa — Sistema interno

CRM/ERP interno para la operación diaria del salón: agenda, clientas, punto de venta, corte de caja, inventario, comisiones y seguimiento por WhatsApp.

## Stack

- **Frontend:** React 18 + TypeScript + Vite, estado con Zustand (`src/data/store.ts`).
- **Backend:** Supabase (Postgres + Auth + Storage). No hay servidor propio — el frontend habla directo con Supabase usando RLS (Row Level Security) para aplicar permisos por rol.
- **Autenticación:** Supabase Auth (`supabase.auth`). Los roles del sistema (`admin`, `gerente`, `recepcion`, `estilista`) viven en la tabla `usuarios`, vinculada a `auth.users` por `auth_user_id`.
- **Deploy:** GitHub Actions construye el proyecto y lo sube por FTP a Hostinger en cada push a `main` (ver `.github/workflows/deploy.yml`). El sitio es estático — no requiere Node en el hosting.

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev
```

`npm run build` genera el sitio estático en `dist/`.

## Estructura

```
src/
  lib/         cliente de Supabase, capa de datos (db.ts), sesión (auth.tsx)
  data/        store de Zustand y datos de ejemplo (mockData.ts, solo fallback local)
  screens/     una pantalla por archivo (Agenda, CRM, Ventas, Servicios, Ajustes…)
  components/  UI compartida (botones, badges, modales, iconos)
  types/       tipos compartidos entre frontend y base de datos
supabase/migrations/   historial de migraciones SQL, en orden
```

## Base de datos y seguridad

- Todas las tablas tienen RLS habilitado con políticas reales por rol (no hay acceso abierto con la anon key).
- Los cambios a `citas`, `ventas`, `servicios`, `usuarios` y `clientas` quedan registrados en `audit_logs`.
- Las migraciones en `supabase/migrations/` documentan el esquema en orden; se aplican vía el SQL Editor de Supabase o el MCP de Supabase, no hay un pipeline de migración automático todavía.

## Carpetas fuera de la app

`_archive/design-handoff/` contiene el material del handoff de diseño original (prototipos HTML/JS y transcripciones de chat) que dio origen a este proyecto. No es parte de la aplicación real — se conserva solo como referencia histórica.

# Robsen — Guía de despliegue y stack

Guía para llevar el prototipo a producción. Incluye recomendaciones específicas para **Hostinger** (el hosting que ya tiene el cliente).

---

## 1. Qué tipo de aplicación es (esto define el hosting)

Robsen **no es un sitio estático**. Es una **app web multiusuario** que necesita:
- **Base de datos** compartida (varios dispositivos del salón ven los mismos datos en tiempo real).
- **Autenticación** con roles y permisos (Admin / Gerente / Recepción / Estilista).
- **Servidor** que reciba **webhooks** (WhatsApp Business API, confirmaciones de pago).
- **Almacenamiento** de archivos (logo, fotos antes/después).

Por eso, un hosting de solo archivos estáticos **no basta** para todo: sirve para el frontend, pero el backend necesita una capa con servidor + base de datos.

---

## 2. Stack recomendado

### Frontend
- **React + Vite + TypeScript**, recreando los diseños HTML 1:1.
- **Tailwind CSS** (o CSS Modules) usando los tokens de `README.md §7`. Definir los colores Robsen como variables de tema.
- **TanStack Query (React Query)** para datos del servidor; **Zustand** para estado de UI si hace falta.
- Iconos: `@phosphor-icons/react`. Fuentes: `@fontsource/playfair-display` y `@fontsource/montserrat`.

### Backend + Base de datos + Auth
**Opción A (recomendada, más rápida): Supabase**
- Postgres administrado + Auth + Storage + Realtime + Row Level Security (RLS).
- Los **roles** se implementan con RLS: cada política define qué puede ver/editar cada rol — exactamente la matriz de permisos de Ajustes.
- Capa gratuita generosa para arrancar; escala con planes de pago.

**Opción B (control total): Node propio**
- NestJS o Express + Postgres (o MySQL) + Prisma/Drizzle ORM + JWT/Passport para auth.
- Requiere un servidor que esté siempre encendido (VPS) — ver §4.

### Integraciones
- **WhatsApp:** Meta WhatsApp Cloud API (oficial) o Twilio. Necesita endpoint público para webhooks de estados (enviado/entregado/respondido) y plantillas aprobadas por Meta.
- **Pagos / anticipos:** Stripe o **Mercado Pago** (mejor para México). Webhook de confirmación.
- **Facturación (opcional):** si requieren CFDI, integrar un PAC mexicano (Facturama, SW Sapien, etc.).

---

## 3. Modelo de base de datos (esquema inicial)

Traducir las entidades de `README.md §5` a tablas Postgres:
```
salones (multi-sucursal opcional)
usuarios            → auth + rol + salon_id
estilistas          → id, nombre, rol, color, comision_pct, activo
clientas            → id, nombre, tel, estado, cumple, ciclo, est_habitual_id, ...
servicios           → id, nombre, cat, precio, dur, anticipo, online
servicio_estilista  → (servicio_id, estilista_id)  // relación N:N
productos           → id, sku, nombre, marca, cat, uso, costo, precio, stock, min
citas               → id, clienta_id, servicio_id, estilista_id, fecha, hora, dur, estado, total, anticipo
ventas              → id, ticket, clienta_id, fecha, pago, estado, desc, anticipo
venta_lineas        → id, venta_id, tipo, ref_id, nombre, estilista_id, cant, precio, comision_pct
movimientos_inv     → id, producto_id, tipo, cant, motivo, ref, fecha
mensajes_wa         → id, clienta_id, tipo, estado, texto, fecha
plantillas_wa       → id, nombre, texto, icon
```
**Triggers/lógica de negocio importante:** al insertar una `venta` con líneas de producto → descontar `productos.stock` y registrar `movimientos_inv` (replica `store.js → addVenta`). Calcular comisiones por estilista desde `venta_lineas`.

---

## 4. Opciones de hosting (con foco en Hostinger)

### ¿Sirve Hostinger? Depende del plan.

| Plan Hostinger | ¿Sirve para Robsen? | Cómo usarlo |
|---|---|---|
| **Hosting compartido** (Premium/Business) | Parcial | Solo para el **frontend estático** (el build de React) y el **dominio**. No corras el backend Node aquí. |
| **Cloud Hosting** | Sí | Frontend + puede alojar Node con algo de configuración. |
| **VPS** | Sí (completo) | Todo: Node + Postgres + Nginx + certificados + webhooks. La opción "todo en Hostinger". |

### Ruta recomendada A — Híbrida (la más práctica y barata)
1. **Frontend** → build de Vite subido a Hostinger (hosting compartido) en tu dominio `app.robsen.com.mx`. O usar Vercel/Netlify (deploy automático desde Git, gratis) y apuntar el dominio de Hostinger ahí vía DNS.
2. **Backend + DB + Auth** → **Supabase** (no requiere servidor propio). El frontend llama a Supabase directamente.
3. **Integraciones** → funciones serverless (Supabase Edge Functions o Vercel Functions) para webhooks de WhatsApp/pagos.
> Ventaja: aprovechas tu Hostinger para dominio/frontend y no peleas con configurar servidores.

### Ruta recomendada B — Todo en Hostinger VPS
1. Contratar/usar **VPS de Hostinger**.
2. Instalar Node + Postgres + Nginx (reverse proxy) + Certbot (HTTPS).
3. Desplegar frontend (build estático servido por Nginx) + backend (Node con PM2).
4. Webhooks entran directo al VPS (IP/dominio público con HTTPS).
> Ventaja: control total y todo bajo un proveedor. Desventaja: tú administras el servidor (actualizaciones, backups, seguridad).

### Recomendación final
- Si el plan actual es **compartido** y no quieres administrar servidores → **Ruta A** (Hostinger para dominio+frontend, **Supabase** para el backend). Es la vía más rápida a producción.
- Si ya tienes o no te importa subir a **VPS** y quieres todo en un lugar → **Ruta B**.

En ambos casos: **dominio y SSL** pueden quedarse en Hostinger.

---

## 5. Checklist de producción

- [ ] Reemplazar Babel-en-navegador por build real (Vite). **Nunca** usar `@babel/standalone` en producción.
- [ ] Reemplazar `store.js`/localStorage por API + base de datos.
- [ ] Auth real con roles (RLS o middleware) — la matriz de permisos de Ajustes es la fuente.
- [ ] HTTPS en todo (Hostinger lo provee; Supabase/Vercel también).
- [ ] Variables de entorno para llaves (WhatsApp, Stripe/Mercado Pago) — nunca en el cliente.
- [ ] Backups automáticos de la base de datos.
- [ ] Validación de formularios en servidor (no solo cliente).
- [ ] Plantillas de WhatsApp aprobadas por Meta antes de enviar.
- [ ] Self-host de fuentes e iconos (no depender de CDN).
- [ ] Zona horaria y moneda fijas a México (MXN, America/Mexico_City).

---

## 6. Nota sobre el prototipo

El prototipo guarda todo en **localStorage** (`rb_data_v1`, `rb_user`, `rb_logo`). Eso es **solo para demostración** — los datos viven en un navegador y no se comparten entre dispositivos. Toda esa capa (`store.js`) se reemplaza por la base de datos real. El resto del código (componentes, layouts, lógica de cálculo en `RBh` y `ventaCalc`) es excelente referencia para replicar comportamiento exacto.

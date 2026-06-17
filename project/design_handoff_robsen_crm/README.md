# Handoff: Robsen Salón & Spa — Sistema interno (CRM/ERP)

> Paquete de entrega para desarrollo en **Claude Code**. Documenta el prototipo de alta fidelidad para que un desarrollador lo lleve a producción.

---

## 1. Resumen

**Robsen** es un sistema interno tipo **CRM/ERP** para un salón de belleza premium. Sustituye software de agenda genérico (tipo AgendaPro) con mayor control: agenda, CRM de clientas, servicios, productos/inventario, punto de venta, empleados/comisiones, finanzas, seguimiento por WhatsApp, y una vista pública de auto-agendamiento.

El sistema es **multiusuario con roles** (Administrador, Gerente, Recepción, Estilista) y su identidad visual replica la marca Robsen: **negro profundo + oro metálico + blanco cálido**, tipografía serif elegante (Playfair Display) + sans (Montserrat).

---

## 2. Sobre los archivos de este paquete

⚠️ **Los archivos `.html`, `.jsx`, `.js` y `.css` de este bundle son REFERENCIAS DE DISEÑO**, no código de producción para copiar tal cual. Son un **prototipo construido en HTML + React (vía Babel en el navegador)** que muestra el aspecto y comportamiento deseados.

**La tarea es recrear estos diseños en un entorno de producción real**, usando un stack adecuado (ver §8). El prototipo:
- Usa React 18 transpilado en el navegador con Babel standalone (solo para prototipar — **no usar en producción**).
- Guarda datos en **localStorage** (capa `store.js`). En producción esto se reemplaza por una **base de datos real + API**.
- Simula integraciones (WhatsApp, pagos, exportes) con notificaciones "toast".

Todo lo que el cliente describió como comportamiento debe entenderse como **"recrear este diseño en la app real"**, no como desplegar el HTML directamente.

---

## 3. Fidelidad

**Alta fidelidad (hi-fi).** Colores, tipografía, espaciados, estados e interacciones son finales y deben recrearse con precisión usando las librerías y patrones del codebase destino. Los design tokens exactos están en §7 y en `styles.css`.

---

## 4. Arquitectura del prototipo (para entender la estructura)

```
index.html          → shell, carga fuentes (Google Fonts), iconos (Phosphor), y todos los scripts
styles.css          → design system completo (tokens, componentes, utilidades)
data.js             → datos demo (window.RB) + helpers (window.RBh): clientas, servicios,
                      productos, citas, ventas, finanzas, roles, usuarios, etc.
store.js            → capa de persistencia (window.RBStore): hidrata desde localStorage,
                      CRUD de cada colección, lógica de venta (descuenta inventario,
                      genera ticket + movimiento). ESTA ES LA CAPA QUE SE REEMPLAZA POR BACKEND.
components.jsx      → componentes compartidos (Ic, Avatar, badges, Stat, BarChart, Donut,
                      Seg, Switch), hook useStore(), ToastHost, helper toast(), ventaCalc.
app.jsx             → App shell: autenticación por rol, router por estado, sidebar filtrada
                      por permisos, topbar con popovers (agenda + notificaciones), logo cargable.
screen-*.jsx        → una pantalla por archivo (ver §6).
```

**Patrón de estado:** `window.RB` es la fuente de datos en memoria; `window.RBStore` la muta y persiste; los componentes se re-renderizan vía `useStore()` (suscripción a un set de listeners). En producción, sustituir por estado servidor (React Query/SWR + API) o un store real (Zustand/Redux) conectado a la base de datos.

---

## 5. Modelo de datos

Definido en `data.js`. Entidades y campos (los tipos son orientativos):

### Clienta (`clientas[]`)
```
id, nombre, tel, estado ('VIP'|'Frecuente'|'Activa'|'Nueva'|'Inactiva'),
ultima (fecha última visita), ticket (promedio), fav (servicio favorito),
est (id estilista habitual), visitas (int), gasto (acumulado), ini (iniciales avatar),
cumple ('14 Ago'), ciclo (semanas entre visitas, para recompra)
```

### Estilista / Empleado (`estilistas[]`)
```
id, nombre, rol (especialidad), color (hex, color en agenda), ini
// métricas (citas, ventas, comPct, rating, ocupación) viven en screen-empleados como demo;
// en producción se calculan de citas+ventas reales.
```

### Servicio (`servicios[]`)
```
id, nombre, cat (Colorimetría|Mechas|Cortes|Tratamientos|Uñas|Pedicure|Maquillaje|
Depilación|Extensiones|Paquetes), precio, dur (minutos), anticipo (bool, requiere anticipo),
online (bool, agendable en línea), prof ([ids de estilistas que lo realizan])
```

### Producto (`productos[]`)
```
id, sku, nombre, marca, cat, uso ('retail'=reventa | 'interno'=consumo en servicio),
costo (compra), precio (venta; 0 si interno), stock, min (punto de reorden), vendidos
```

### Cita (`hoy[]` — agenda del día)
```
id, h ('09:00'), dur (min), cl (nombre clienta), srv (nombre servicio),
est (id estilista), estado ('pend'|'conf'|'pay'|'done'|'canc'), total, ant (anticipo)
```

### Venta / Ticket POS (`ventas[]`)
```
id, ticket ('#1042'), fecha, cliente, clienteId, pago ('Tarjeta'|'Efectivo'|'Transferencia'),
estado ('pagada'|'parcial'|'pendiente'), desc (descuento), anticipo,
lineas: [{ tipo:'servicio'|'producto'|'adicional', nombre, est (id estilista), cant, precio, com (% comisión) }]
```

### Movimiento de inventario (`movimientos[]`)
```
id, fecha, prod (nombre), tipo ('entrada'|'salida'|'consumo'), cant, motivo, ref (id origen)
```

### Transacción de producto (`transacciones[]`)
```
id, ticket, fecha, cliente, est, items:[{n,q,p}], total, pago, tipo ('producto'|'mixto')
```

### Roles y usuarios (`roles{}`, `usuarios[]`, `modulos[]`)
```
roles: admin (allow:'*'), gerente, recepcion, estilista — cada uno con allow:[ids de módulos]
usuario: id, nombre, rol, ini, color, email, tel, activo, ultimo (último acceso)
modulos: lista de {id,label} para la matriz de permisos
```

### Mensajes y plantillas WhatsApp (`mensajes[]`, `plantillas[]`)
```
mensaje: id, cl, est, tipo, estado ('enviado'|'entregado'|'respondido'), prev, t, sin (sin responder)
plantilla: id, nombre, icon, txt (con variables {nombre} {servicio} {fecha} {hora} {estilista} {dias})
```

### Relaciones clave (conexiones entre módulos)
- Una **venta** con líneas de producto → **descuenta `stock`** del producto, genera **movimiento** ('salida') y **transacción**. (Ver `store.js` → `addVenta`).
- Una **venta** suma a **Finanzas** (ingresos servicio vs. producto) y a **comisiones** por estilista.
- Una **venta** queda ligada a la **clienta** y aparece en su historial (CRM).
- Las **citas** alimentan ocupación y rendimiento de **empleados**.
- **Recompra / riesgo de fuga / cumpleaños** (CRM Retención) se calculan de `ultima`, `ciclo` y `cumple` (ver `data.js` → `RBh.insights`).

---

## 6. Pantallas

Detalle pantalla por pantalla en **`SCREENS.md`** (este folder). Lista:

| # | Módulo | Archivo | Propósito |
|---|--------|---------|-----------|
| 1 | Dashboard | `screen-dashboard.jsx` | KPIs del salón, ventas, próximas citas, alertas |
| 2 | Agenda | `screen-agenda.jsx` | Vista día/semana/mes, columnas por estilista, crear/editar citas |
| 3 | Ventas (POS) | `screen-ventas.jsx`, `screen-pos.jsx` | Punto de venta: servicios + productos + adicionales en un ticket |
| 4 | CRM | `screen-crm.jsx` | Lista + retención + perfil de clienta con historial |
| 5 | Servicios | `screen-servicios.jsx` | Catálogo y editor de servicios/paquetes |
| 6 | Productos | `screen-productos.jsx` | Inventario, ventas de producto, movimientos (kardex) |
| 7 | Empleados | `screen-empleados.jsx` | Rendimiento, comisiones, horarios, editor |
| 8 | Finanzas | `screen-finanzas.jsx` | Ingresos, utilidad, comparativos, desglose servicio/producto |
| 9 | Seguimiento/WhatsApp | `screen-whatsapp.jsx` | Bandeja, chat, plantillas, estados de mensaje |
| 10 | Ajustes | `screen-ajustes.jsx` | Perfil, salón, usuarios/roles (matriz de permisos), logo, pagos |
| 11 | Login + Agendamiento público | `screen-login.jsx`, `screen-booking.jsx` | Acceso por rol + reserva de clienta (5 pasos) |

---

## 7. Design tokens

Fuente de verdad: **`styles.css`** (bloque `:root`). Resumen:

### Colores
```
Fondos:    --bg #0B0A09 · --bg-2 #100E0C · --panel #141110 · --surface #191512 · --surface-2 #211B16 · --surface-3 #2A231C
Oro:       --gold #C8A14A · --gold-soft #E8CE8A · --gold-deep #9A7A2E
           --gold-grad linear-gradient(135deg, #F0DCA0 0%, #C8A14A 48%, #9A7A2E 100%)
Texto:     --text #F3EDE2 · --text-2 #B9AF9D · --text-3 #837A6C · --text-4 #5C5547
Líneas:    --line rgba(200,161,74,0.16) · --line-soft rgba(255,255,255,0.07) · --line-strong rgba(200,161,74,0.34)
Estados de cita:
           pendiente --st-pend #D9A441 (ámbar)
           confirmada --st-conf #93B58C (verde sage)
           anticipo pagado --st-pay #CE9CB6 (ROSA)
           completada --st-done #6FA6B8 (azul)
           cancelada --st-canc #C77B7B (rojo apagado)
           frecuente --st-frec #C8A14A (oro)
Positivo/negativo: --pos #93B58C · --neg #C77B7B
```

### Tipografía
```
Serif (títulos): "Playfair Display", Georgia, serif — pesos 500/600/700, también itálica (logo)
Sans (UI/cuerpo): "Montserrat", system-ui, sans-serif — pesos 400/500/600/700
Escala: títulos de pantalla 26px serif 600; KPI value 31px serif; body 13.5px; labels 11–12px uppercase letterspacing
Eyebrow: 11px, letter-spacing .22em, uppercase, color oro
```

### Radios, sombras, layout
```
Radios: --r-sm 8px · --r 12px · --r-lg 18px · --r-xl 24px · pills/badges 30px
Sombras: --sh 0 12px 40px -16px rgba(0,0,0,.7) · --sh-lg 0 24px 70px -24px rgba(0,0,0,.85)
Sidebar: 256px · Topbar: 74px
Espaciado entre cards: 18px · padding de card: 20–24px
```

### Iconos
**Phosphor Icons** (`@phosphor-icons/web` 2.1.1), pesos regular/bold/fill. En producción usar el paquete npm `@phosphor-icons/react`.

---

## 8. Stack recomendado y despliegue

Ver **`DEPLOYMENT.md`** para la guía completa (incluye opciones con **Hostinger**). Resumen:

- **Frontend:** React (Vite) + TypeScript, recreando estos diseños 1:1. Tailwind o CSS-in-JS con los tokens de §7.
- **Backend + DB + Auth:** **Supabase** (Postgres + Auth + Row Level Security para los roles) es la vía más rápida. Alternativa: Node/Express o NestJS + Postgres propio.
- **Tiempo real:** Supabase Realtime o WebSockets para que agenda/ventas se sincronicen entre dispositivos.
- **Integraciones:** WhatsApp Business API (Meta Cloud API o Twilio), pasarela de pago (Stripe / Mercado Pago para MX), facturación (PAC mexicano si requieren CFDI).
- **Hosting:** ver `DEPLOYMENT.md` — cuándo conviene el Hostinger compartido vs. VPS vs. Supabase+Vercel.

---

## 9. Assets

- **Fuentes:** Google Fonts (Playfair Display, Montserrat) — en producción self-host o `@fontsource`.
- **Iconos:** Phosphor Icons.
- **Logo Robsen:** el sistema permite **subir un logo** (Ajustes › Salón) que reemplaza el wordmark del sidebar; se guarda como data URL en localStorage (`rb_logo`). En producción, subir a storage (Supabase Storage / S3).
- **Imágenes antes/después (CRM):** placeholders rayados con texto monoespaciado; reemplazar por uploads reales.
- **No hay imágenes raster propias** en el prototipo — todo es CSS + iconos de fuente.

---

## 10. Archivos de diseño incluidos

Todos en la subcarpeta `design_files/`:
```
index.html · styles.css · data.js · store.js · components.jsx · app.jsx
screen-dashboard.jsx · screen-agenda.jsx · screen-ventas.jsx · screen-pos.jsx
screen-crm.jsx · screen-servicios.jsx · screen-productos.jsx · screen-empleados.jsx
screen-finanzas.jsx · screen-whatsapp.jsx · screen-ajustes.jsx
screen-login.jsx · screen-booking.jsx
```

Para correr el prototipo: abrir `design_files/index.html` en un navegador (requiere internet para fuentes/iconos/React desde CDN).

---

## 11. Prioridades sugeridas de implementación

1. **Fundación:** modelo de datos en Postgres + Auth + roles (RLS). Recrear shell, login y navegación por permisos.
2. **Núcleo operativo:** Agenda (CRUD citas) + CRM (CRUD clientas) + Servicios + Productos/Inventario.
3. **Punto de venta:** ticket que mezcla servicio/producto/adicional, descuenta inventario, calcula comisiones, persiste y alimenta finanzas.
4. **Inteligencia:** Dashboard, Finanzas (reportes), CRM Retención (recompra/fuga/cumpleaños).
5. **Integraciones:** WhatsApp (plantillas, recordatorios automáticos, estados), pagos/anticipos, agendamiento público.
6. **Pulido:** exportes reales (PDF/Excel), notificaciones, multi-sucursal si aplica.

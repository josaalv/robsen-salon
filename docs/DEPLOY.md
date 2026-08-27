# Deploy

## Cómo funciona

Cada `push` a `main` dispara `.github/workflows/deploy.yml`:

1. `npm ci` (o `npm install`) instala dependencias.
2. `npm run build` compila el frontend (`tsc && vite build`), inyectando
   `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` desde los secrets del repo.
3. `lftp mirror --reverse` sube el contenido de `./dist/` por FTP a Hostinger,
   reemplazando lo que había.

**Nota histórica:** hasta julio de 2026 este paso usaba
`SamKirkland/FTP-Deploy-Action`. Tras rotar la contraseña FTP se detectó que
ese conector, con las mismas credenciales, reportaba deploys "exitosos" pero
aterrizaba en un directorio distinto al que realmente sirve el sitio (el
propio conector marcaba "Server Files: 0" en cada intento, y un archivo de
prueba subido por él nunca aparecía en producción). Un diagnóstico con
`lftp` usando las mismas credenciales sí conectó al directorio correcto —
por eso se reemplazó el conector por `lftp` directo.

No hay paso manual. Si el build pasa y el FTP no falla, en 1-2 minutos el
cambio está en `https://robseninterno.com`.

## Secrets requeridos (GitHub → Settings → Secrets and variables → Actions)

| Secret | Para qué |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto de Supabase, se inyecta al build |
| `VITE_SUPABASE_ANON_KEY` | Anon key pública de Supabase (nunca la service role) |
| `HOSTINGER_FTP_SERVER` | Host FTP de Hostinger |
| `HOSTINGER_FTP_USERNAME` | Usuario FTP (cuenta scoped a `public_html`) |
| `HOSTINGER_FTP_PASSWORD` | Contraseña FTP |
| `SUPABASE_DB_URL` | Solo para el workflow de backups (`backup-db.yml`), no para el deploy |

## Cómo hacer un deploy

No hay nada que "activar": basta con mergear o pushear a `main`. Para
verificar que salió bien:

1. GitHub → pestaña **Actions** → el run más reciente de "Deploy to
   Hostinger" debe quedar en verde.
2. Si falla en el paso de FTP con `Timeout (control socket)` o similar, casi
   siempre es un problema transitorio del lado de Hostinger, no del código —
   dale "Re-run failed jobs" una o dos veces antes de investigar más a fondo.
3. Entra a `https://robseninterno.com` y confirma que carga (revisa la
   consola del navegador si algo se ve raro — un error de CORS o 401 casi
   siempre es un problema de configuración de Supabase Auth, no del deploy).

## Rollback básico

No hay un botón de "rollback" automatizado. Si un deploy rompe algo:

1. `git revert <commit-que-rompió-todo>` (o `git revert` de un rango de
   commits) y push a `main` — esto dispara un nuevo deploy con el código de
   antes.
2. Si el problema es de datos (una migración de Supabase mal aplicada) el
   rollback de código no lo arregla — hay que revertir la migración a mano
   (ver `supabase/README.md`) o restaurar desde un backup
   (`docs/BACKUPS.md`).
3. Si necesitas congelar el sitio de inmediato mientras investigas (sin
   esperar un nuevo deploy), puedes subir manualmente una versión anterior
   de `dist/` por FTP directo desde Hostinger — es la única vía realmente
   inmediata, ya que GitHub Actions tarda 1-2 minutos.

## Qué revisar si GitHub Actions falla

- **Falla en `npm run build`**: casi siempre un error de TypeScript real —
  revisa el log completo, no solo el resumen. Si compila local
  (`npm run build`) pero falla en CI, revisa que no dependas de algo que
  solo existe en tu máquina (una variable de entorno local, un archivo no
  commiteado).
- **Falla en el paso de FTP**: revisa que los 3 secrets de Hostinger sigan
  vigentes (una contraseña de FTP rotada manualmente en el panel de
  Hostinger invalida el secret sin avisar). Si el error es de timeout de
  conexión y los secrets son correctos, es casi siempre transitorio —
  reintenta.
- **El build pasa y el deploy sube pero el sitio se ve viejo**: espera 1-2
  minutos (CDN/cache del navegador) antes de asumir que algo falló; compara
  el hash del bundle (`index-XXXXX.js`) que ves en el navegador contra el
  del build más reciente en Actions.

## Qué revisar si Supabase Auth redirige mal

Si los enlaces de invitación o recuperación de contraseña abren `localhost`
en vez de `https://robseninterno.com`:

1. Supabase Dashboard → **Authentication → URL Configuration**.
2. **Site URL** debe ser `https://robseninterno.com` (sin slash final).
3. **Redirect URLs** debe incluir `https://robseninterno.com/**`.
4. Esto es configuración del dashboard, no del código — ningún cambio en el
   repo lo arregla. Genera un enlace *nuevo* después de corregirlo; los
   enlaces ya enviados antes del cambio siguen apuntando a donde apuntaban
   cuando se generaron.

## Entorno de preview (`/preview/`)

Para probar cambios de diseño/practicidad sin tocar producción, existe un
segundo pipeline paralelo que despliega a `https://robseninterno.com/preview/`.

**Flujo de trabajo:**

1. Desarrolla y prueba tus cambios en la rama **`preview`** (push directo o
   PR desde una rama de trabajo hacia `preview` — como prefieras).
2. Cada `push` a `preview` dispara `.github/workflows/deploy-preview.yml`:
   mismo build, pero con `VITE_BASE_PATH=/preview/`,
   `VITE_SUPABASE_SCHEMA=preview` y `VITE_STORAGE_SUFFIX=_preview`, subido
   por FTP a la subcarpeta `./preview/` en vez de la raíz.
3. Cuando el cambio está listo, se aprueba y mergea `preview` → `main` (PR
   normal) para que llegue a producción — **nada llega a producción sin
   ese merge explícito**, ese es el "modelo de aprobación".

**Aislamiento de código:** deploy en una subcarpeta aparte, nunca pisa la
raíz del sitio ni la rama `main`. El `base` de Vite, el manifest del PWA y
el scope del service worker se derivan de `VITE_BASE_PATH`, así que preview
y producción nunca comparten caché de service worker aunque estén en el
mismo dominio.

**Aislamiento de datos:** en vez de un proyecto de Supabase aparte (el plan
free solo permite 2 proyectos activos), preview usa un **schema** distinto
(`preview`) dentro del mismo proyecto — mismas credenciales, mismo login
(Supabase Auth es a nivel de proyecto, no de schema), pero tablas,
políticas RLS y datos completamente separados de `public`. `VITE_STORAGE_SUFFIX`
además evita que localStorage/IndexedDB se compartan entre pestañas de
preview y producción abiertas en el mismo navegador.

**Sincronización automática de datos (`public` → `preview`, un solo
sentido):** cualquier alta/edición/borrado real en producción (operación
rutinaria del negocio: una venta, una cita, una clienta nueva, etc.) se
replica sola a `preview` vía triggers de base de datos
(`supabase/migrations/058_sync_public_to_preview_triggers.sql`) — así
preview nunca queda con datos viejos para probar. Regla de diseño no
negociable: si la réplica hacia `preview` falla por lo que sea, **nunca**
bloquea ni revierte la escritura real en producción (cada función de
sincronización atrapa su propia excepción y solo deja un `WARNING` en los
logs). Esto es soltar datos, no código — no pasa por ningún proceso de
aprobación, es automático e inmediato.

WhatsApp queda fuera del entorno de preview a propósito (depende de Edge
Functions, que son inherentemente de producción).

Ver `supabase/migrations/057_clone_public_to_preview_schema.sql` (creación
del schema + semilla inicial) y `058_sync_public_to_preview_triggers.sql`
(sincronización continua) para el detalle técnico completo.

## SPA routing al recargar

La app usa rutas tipo `/agenda`, `/ventas`, etc. reflejadas en la URL del
navegador (no hash-routing). Esto depende de `public/.htaccess`, que reescribe
cualquier ruta que no sea un archivo real hacia `index.html`:

```
Options -MultiViews
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ /index.html [L]
```

Si algún día una sección deja de funcionar al recargar (pantalla en blanco o
404 de Hostinger), lo primero a revisar es que ese `.htaccess` siga estando
en `dist/` después del build (Vite lo copia automáticamente desde `public/`)
y que Hostinger no lo esté ignorando.

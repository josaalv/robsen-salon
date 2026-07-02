# Deploy

## Cómo funciona

Cada `push` a `main` dispara `.github/workflows/deploy.yml`:

1. `npm ci` (o `npm install`) instala dependencias.
2. `npm run build` compila el frontend (`tsc && vite build`), inyectando
   `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` desde los secrets del repo.
3. `SamKirkland/FTP-Deploy-Action` sube el contenido de `./dist/` por FTP a
   Hostinger, reemplazando lo que había.

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
| `HOSTINGER_FTP_SERVER_DIR` (opcional) | Carpeta destino; por defecto `/` porque la cuenta FTP ya aterriza en `public_html` |
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

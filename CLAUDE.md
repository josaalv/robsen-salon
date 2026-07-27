# Robsen Salón & Spa — guía operativa para Claude

CRM/ERP interno del salón. Ver `README.md` para stack y estructura de carpetas.
Este archivo es memoria persistente: se lee automáticamente al abrir el repo.
Consulta siempre `docs/` antes de asumir cómo funciona algo — no adivines.

## Flujo de despliegue (deploy) — leer ANTES de tocar producción

**Fuente de verdad:** `docs/DEPLOY.md`. Resumen:

1. Cada `push` a `main` dispara `.github/workflows/deploy.yml`.
2. `npm install` → `npm run build` (inyecta `VITE_SUPABASE_URL` y
   `VITE_SUPABASE_ANON_KEY` desde secrets de GitHub).
3. **`lftp mirror --reverse`** sube `./dist/` por FTP a Hostinger. Site en
   producción: `https://robseninterno.com`.

**Secrets en GitHub → Settings → Secrets and variables → Actions:**
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `HOSTINGER_FTP_SERVER`,
`HOSTINGER_FTP_USERNAME`, `HOSTINGER_FTP_PASSWORD`. (`SUPABASE_DB_URL` es
solo para el workflow de backups, no para el deploy.)

### Incidente resuelto (julio 2026) — leer si el sitio no refleja cambios

Cuando el usuario rotó la contraseña FTP, el conector que se usaba entonces
(`SamKirkland/FTP-Deploy-Action`) empezó a reportar **"deploy exitoso" en
cada intento sin ningún error**, pero escribía los archivos en un
directorio vacío y paralelo — **no** en el que realmente sirve
`robseninterno.com`. Por eso el sitio seguía mostrando una versión vieja
pese a que GitHub Actions marcaba todo en verde.

**Por qué costó tanto diagnosticarlo:** el propio conector no daba señal
de error — "success" real, pero en el lugar equivocado. Los síntomas
engañosos que se descartaron uno por uno, en orden:
1. Credenciales — no era esto (el login funcionaba).
2. Ruta del `server-dir` — se probaron 3 rutas distintas
   (`public_html/`, `domains/<dominio>/public_html/`, `/`), todas
   fallaron igual.
3. Caché/CDN de Hostinger (`hcdn`) — descartado con una prueba
   irrefutable: subir un archivo de nombre **único** (nunca antes
   solicitado) y comprobar que ni siquiera ese aparecía — imposible que
   sea caché si la URL nunca existió antes.

**Cómo se diagnosticó de verdad:** un workflow temporal de GitHub Actions
que usa `lftp` directo (mismo servidor/usuario/password que el deploy
real) para hacer `ls`/`cat` crudos contra el FTP. Con esas credenciales,
`lftp` **sí** aterrizaba en el directorio correcto — se pudo listar el
historial real del sitio y confirmar que `index.html` coincidía byte a
byte con lo servido en producción. Esto probó que el problema no era
credenciales ni ruta, sino la librería del conector (`FTP-Deploy-Action`)
interpretando el `server-dir` de forma distinta a como lo hace un cliente
FTP estándar con esta cuenta específica de Hostinger.

**La solución:** se reemplazó el conector por `lftp mirror --reverse`
directo en `deploy.yml`, usando la conexión ya verificada.

**Playbook si vuelve a pasar algo similar** (deploy en verde pero el sitio
no cambia):
1. **No asumas que es caché.** Pruébalo con un archivo de nombre único
   (timestamp + random) commiteado a `public/`, deployado, y pedido
   directo por HTTP (`curl https://robseninterno.com/ese-archivo.txt`).
   Si no aparece, no es caché — es que el deploy no está escribiendo
   donde debe.
2. Compara `last-modified` del `index.html` servido contra la hora del
   último deploy. Si no coincide después de esperar 2-3 min, hay un
   problema real de destino, no de propagación.
3. Revisa el log completo del paso de FTP en Actions (no solo el
   resumen) — busca líneas tipo "Server Files: 0" o "first publish" en
   un deploy que NO debería ser el primero; es la señal de que está
   aterrizando en un directorio vacío/equivocado.
4. Si hace falta diagnosticar el árbol real del FTP, usa `lftp` con
   `set ssl:verify-certificate no; set ftp:ssl-allow no;` (certificados
   compartidos de hosting no válidos para IP directa) y comandos `cat`/
   `cls` puntuales — evita `find` recursivo si la cuenta tiene muchos
   archivos (esta tiene 36k+ inodes), se cuelga.
5. Si el conector actual (`lftp mirror`) alguna vez empieza a fallar,
   antes de cambiar de herramienta otra vez, repite el mismo diagnóstico
   con `lftp` manual para confirmar que el problema es real y no de la
   sintaxis del workflow.

## Base de datos (Supabase)

- RLS real en todas las tablas, sin acceso abierto por anon key.
- Migraciones en `supabase/migrations/`, en orden — aplicar vía MCP de
  Supabase o el SQL Editor, no hay pipeline automático.
- Antes de cualquier cambio de esquema, correr `get_advisors` (security)
  después de aplicar la migración para confirmar que no se rompió nada.

## Convenciones de este proyecto

- Todo el texto de UI está en español (México), tono cercano al equipo del
  salón.
- Cambios de código van por PR a `main` (nunca commits directos a main
  salvo casos de diagnóstico temporal ya limpiados después).
- Verificar en base real (Supabase) con transacciones de prueba
  (`BEGIN`/`ROLLBACK`) antes de dar un fix por bueno, no solo revisar el
  código.
- Tras cambios visuales/funcionales relevantes, recordar al usuario hacer
  Ctrl+Shift+R para saltar el caché del navegador.

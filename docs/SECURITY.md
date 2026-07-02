# Seguridad

## Autenticación (Auth)

El login usa Supabase Auth (email + contraseña) — no hay contraseñas en
texto plano en la base de datos, ni un sistema propio de tokens de
recuperación (el que existía se eliminó, ver `supabase/migrations/026_*.sql`
y `011_create_reset_tokens.sql`).

- **Invitar a alguien nuevo**: Ajustes → Usuarios y roles → Nuevo usuario.
  Al guardar, se le envía automáticamente un correo de invitación (vía la
  Edge Function `crear-acceso-usuario`) para que configure su propia
  contraseña. No hace falta entrar al dashboard de Supabase para esto.
- **Recuperar contraseña**: desde la pantalla de login, "¿Olvidaste tu
  contraseña?". Envía un correo con un enlace de un solo uso.
- **Eliminar acceso**: Ajustes → Usuarios y roles → abrir el usuario → botón
  "Eliminar usuario" (solo visible para admin). Borra el perfil y la cuenta
  de Auth. Para quitarle el acceso sin borrar su historial de forma
  permanente, usa el switch "Cuenta activa" en vez de eliminar — un usuario
  inactivo no puede iniciar sesión ni operar nada, pero su historial de
  ventas/citas queda intacto y se puede reactivar después.

### Pendiente manual: servicio de correo propio (SMTP)

Por defecto, Supabase envía los correos de invitación y recuperación de
contraseña con su propio servicio de prueba
(`noreply@mail.app.supabase.io`). Ese servicio **no es para producción**:
tiene un límite muy bajo de correos por hora (compartido entre todos los
tipos de correo — invitaciones, recuperación, etc.), y a veces cae en spam.
Ya lo confirmamos en la práctica: 3 solicitudes de recuperación en pocos
minutos fueron suficientes para agotar el límite (`error_code:
over_email_send_rate_limit`) — el frontend ahora avisa con un mensaje claro
cuando pasa esto, en vez de un error genérico, pero el límite en sí sigue
siendo el del servicio de prueba.

**Proveedor elegido: Resend** (ya es el que se va a usar para todas las
comunicaciones por correo del salón, no solo Auth). Pasos exactos:

1. **Cuenta y dominio en Resend** (resend.com, plan gratis alcanza de sobra
   para este volumen):
   - Crea la cuenta si no existe todavía.
   - **Domains → Add Domain** → `robseninterno.com` (o un subdominio como
     `mail.robseninterno.com` si prefieres separar el correo transaccional
     del sitio principal).
   - Resend te da 2-3 registros DNS (normalmente TXT/CNAME para SPF, DKIM y
     a veces DMARC). Esos registros se agregan en el panel de DNS de
     Hostinger, donde ya está apuntando el dominio — no es lo mismo que la
     configuración FTP de deploy.
   - Espera a que Resend marque el dominio como **Verified** (puede tardar
     de minutos a un par de horas según la propagación de DNS).
2. **API key**: Resend → **API Keys → Create API Key** (permiso de envío
   basta, no hace falta acceso total). Cópiala — es la única vez que se
   muestra completa.
3. **Conectar Resend a Supabase Auth**: Supabase Dashboard → **Project
   Settings → Authentication → SMTP Settings** → actívalo y llena:
   - Host: `smtp.resend.com`
   - Puerto: `465` (SSL) o `587` (TLS) — cualquiera funciona, 465 es el que
     Resend recomienda por defecto.
   - Usuario: `resend` (literal, no es tu correo)
   - Contraseña: la API key de Resend del paso 2
   - Correo remitente: algo del dominio ya verificado, ej.
     `no-reply@robseninterno.com`
   - Nombre del remitente: `Robsen Salón & Spa`
4. Guarda y **prueba enviando una invitación real** desde Ajustes →
   Usuarios y roles, o un "olvidé mi contraseña" — confirma que llega y que
   el remitente ya no es `noreply@mail.app.supabase.io`.
5. Efecto: los límites de envío pasan a ser los de tu plan de Resend (miles
   de correos/mes incluso en el plan gratis, muy por encima del límite del
   servicio de prueba de Supabase), y los correos llegan desde tu propio
   dominio en vez de uno genérico — mejor entregabilidad, menos riesgo de
   caer en spam.

No hay forma de hacer este último tramo (la API key de Resend, la
verificación del dominio) por código ni por MCP — la cuenta de Resend y el
panel de SMTP de Supabase son configuración de dashboard, y la API key es
un secreto que nunca debe pegarse en un chat ni en el repo.

### Pendiente manual: Leaked Password Protection

Supabase puede rechazar contraseñas que aparecen en filtraciones conocidas
(consulta contra HaveIBeenPwned sin exponer la contraseña real). Está
**desactivado** actualmente — no hay forma de activarlo por API/MCP, es
exclusivamente un toggle del dashboard:

1. Supabase Dashboard → **Authentication → Policies** (o **Auth → Providers
   → Email**, la ubicación exacta varía según la versión del dashboard) →
   busca "Leaked password protection" / "Password strength".
2. Actívalo.
3. Efecto: si alguien intenta poner una contraseña que aparece en una
   filtración pública conocida, Supabase la rechaza al momento de
   crearla/cambiarla. No afecta a nadie que ya tenga una contraseña
   configurada, solo aplica hacia adelante.
4. Para probarlo: intenta cambiar una contraseña a algo obvio como
   `password123` — debería rechazarla después de activar el toggle.

## Row Level Security (RLS)

Todas las tablas tienen RLS activo. Nadie —ni siquiera con la anon key
pública, que va incluida en el código del frontend por diseño— puede leer o
escribir datos que no le correspondan según su rol. Esto se verificó
directamente contra producción, no es una suposición:

- `anon` (visitante sin sesión) solo puede: ver el catálogo público de
  servicios/estilistas/config (para la página de reservas), y ver una lista
  mínima de perfiles para el selector de login (nombre, rol, avatar, correo —
  nunca teléfono ni el ID interno de Auth).
- `authenticated` (con sesión) solo ve/opera lo que su rol permite — ver
  `docs/ROLES.md` para el detalle exacto por rol.
- Un usuario desactivado (`activo = false`) pierde acceso a **todas** las
  tablas operativas de inmediato, aunque su sesión técnica siga vigente —
  las funciones `current_rol()`/`current_estilista_id()` filtran por
  `activo = true` internamente, así que cualquier política que dependa de
  ellas queda bloqueada automáticamente.

### Verificación rápida (para correr después de cualquier cambio futuro de RLS)

Con solo la anon key pública (no requiere sesión), confirmar que esto
devuelve vacío o error, nunca datos reales:

```bash
curl "https://<tu-proyecto>.supabase.co/rest/v1/usuarios?select=*" \
  -H "apikey: <tu-anon-key>"
# Debe devolver: []
```

Y que el selector de login siga funcionando con columnas seguras únicamente:

```bash
curl -X POST "https://<tu-proyecto>.supabase.co/rest/v1/rpc/listar_usuarios_publicos" \
  -H "apikey: <tu-anon-key>" -H "Content-Type: application/json" -d '{}'
# Debe devolver nombre/rol/avatar/email — nunca tel ni auth_user_id.
```

También puedes correr `get_advisors` desde el dashboard de Supabase
(**Database → Advisors → Security**) o pedirle a Claude que lo corra vía
MCP — cualquier advertencia nueva de nivel ERROR debe investigarse antes de
lanzar un cambio a producción.

## Storage

Hay dos buckets:

- **`media`** (público): logo del salón, avatares de usuarios, fotos de
  estilistas — contenido pensado para mostrarse en la página pública de
  reservas. No permite *listar* su contenido (se cerró esa política), solo
  acceder a un archivo si ya conoces su ruta exacta.
- **`fotos-clientas`** (privado): fotos antes/después de clientas. Requiere
  sesión (`authenticated`) para leer o escribir — se generan URLs firmadas
  con expiración al momento de mostrarlas en el CRM, nunca quedan como
  enlace público permanente.

## Qué NO debe compartirse nunca

- La **service role key** de Supabase: tiene acceso total, sin RLS. No
  existe en el frontend (verificado — solo `VITE_SUPABASE_ANON_KEY` está
  presente en el bundle) y solo se usa dentro de las Edge Functions
  (`crear-acceso-usuario`, `eliminar-usuario`), donde Supabase la inyecta
  automáticamente como variable de entorno del runtime — nunca se escribe a
  mano en ningún archivo del repo.
- La **connection string de la base de datos** (`SUPABASE_DB_URL`, usada
  solo para backups) — vive únicamente como secret de GitHub Actions.
- Cualquier **dump de backup** (`.dump`) — contiene todos los datos reales
  sin cifrar. Están en `.gitignore` a propósito.
- Contraseñas de cuentas de Auth reales, aunque sea "solo para pruebas".

## Por qué no se usa `service_role` en el frontend

La anon key es segura de exponer porque cada operación pasa por RLS —
el servidor de Postgres decide fila por fila qué puede ver o tocar cada
usuario según su rol real, sin importar qué pida el cliente. La
`service_role` key se salta RLS por completo: si estuviera en el frontend,
cualquiera con las herramientas de desarrollador del navegador tendría
acceso total a la base de datos, sin restricción alguna. Por eso toda acción
que necesita privilegios elevados (invitar usuarios, eliminarlos) pasa por
una Edge Function que corre en el servidor de Supabase, nunca en el
navegador del usuario.

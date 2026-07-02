# Roles y permisos

Esto describe lo que cada rol puede hacer **de verdad** — no solo lo que la
interfaz muestra u oculta, sino lo que el servidor (Supabase, vía Row Level
Security) permite o rechaza, incluso si alguien intentara saltarse la
interfaz y llamar a la base de datos directamente. Verificado leyendo las
políticas RLS reales aplicadas en producción, no de memoria.

## Administrador (`admin`)

Acceso total. Es el único rol que puede:

- Crear, editar, desactivar y **eliminar permanentemente** cuentas de
  usuario (incluida su cuenta de acceso de Supabase Auth).
- Todo lo que puede gerente, además de lo anterior.

## Gerente (`gerente`)

Mismo alcance operativo que admin, **excepto gestión de cuentas de
usuario**:

- Puede: crear/editar/cancelar citas, clientas, ventas, servicios,
  productos, estilistas, config del salón, bloqueos de agenda, gastos,
  plantillas, corte de caja, movimientos de inventario.
- Puede ver la lista de usuarios (Ajustes → Usuarios y roles), pero la
  pantalla es de solo lectura para este rol — no puede crear, editar,
  desactivar ni eliminar cuentas. Eso es exclusivo de admin, reforzado
  tanto en la interfaz como en el servidor.
- Puede ver `audit_logs` (auditoría) y los cortes de caja.

## Recepción (`recepcion`)

Enfocado en operación diaria de mostrador:

- Puede: crear/editar/cancelar citas, crear y editar clientas, registrar
  ventas y cobros, hacer cierre de caja, crear/editar plantillas de
  mensajes, crear bloqueos de agenda.
- Puede mover stock operativo de productos (vender/ajustar cantidad), pero
  **no puede cambiar precio ni costo** de un producto — el servidor lo
  bloquea aunque la petición incluya esos campos.
- No puede: gestionar usuarios, cambiar precios de servicios/productos,
  editar la configuración general del salón, ver `audit_logs`.

## Estilista (`estilista`)

Acceso acotado a lo propio:

- Ve **solo sus propias citas** (donde la cita está asignada a su
  `estilista_id`), no las de otros estilistas.
- Ve solo las clientas con las que tiene una cita asignada — no la base
  completa de clientas del salón.
- Puede reagendar/actualizar sus propias citas.
- Puede registrar ventas cuando él mismo es quien vende (insert), pero solo
  ve las ventas donde participó, no las ventas globales del salón.
- Puede mover stock operativo de productos igual que recepción (sin tocar
  precio/costo).
- **No puede**: ver ventas de otros estilistas, ver o modificar precios
  generales, gestionar usuarios, ver cortes de caja ni auditoría, borrar
  ventas (no existe política de DELETE para este rol en ventas — queda
  bloqueado por defecto).

## Usuario inactivo

Cualquier cuenta con `activo = false` (desde el switch "Cuenta activa" en su
perfil) pierde acceso a **todas** las tablas operativas de inmediato, sin
importar el rol que tenía. Esto está reforzado a nivel de base de datos, no
solo en la interfaz: las funciones internas que las políticas usan para
saber "¿quién es este usuario y qué rol tiene?" dejan de reconocerlo en
cuanto está inactivo, así que cualquier intento de leer o escribir datos
falla, aunque su sesión técnica del navegador siga sin cerrar.

## Visitante sin sesión (`anon`)

Sin iniciar sesión, solo se puede:

- Ver el catálogo público de servicios, estilistas y datos básicos del
  salón (para la página pública de reservas).
- Ver una lista mínima de perfiles para el selector de login (nombre, rol,
  avatar, correo) — nunca teléfono personal ni identificadores internos.
- Enviar una solicitud de cita desde el formulario público de reservas.

No puede leer clientas, ventas, citas ajenas, ni ningún dato del negocio.

## Cómo se verifica esto (no solo se documenta)

Las reglas de arriba viven como políticas de Row Level Security en
Postgres (`supabase/migrations/016_authenticated_rls_policies.sql` y
siguientes), no como validaciones que solo vivan en el código del
frontend. Eso significa que aunque alguien abriera las herramientas de
desarrollador del navegador e hiciera una llamada directa a la API de
Supabase saltándose la interfaz, el servidor seguiría aplicando las mismas
reglas — la UI oculta botones por comodidad, pero la seguridad real está en
la base de datos.

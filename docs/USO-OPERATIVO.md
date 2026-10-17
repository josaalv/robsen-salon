# Guía de uso — operación diaria del salón

Esta guía es para el equipo del salón, no para desarrolladores. Explica cómo
hacer las tareas del día a día en el sistema.

## Citas

**Crear una cita**: Agenda → elige el horario/estilista disponible → llena
los datos de la clienta y el servicio.

**Reagendar**: abre la cita → cambia horario o estilista → guardar. El
sistema no te deja poner dos citas encimadas para la misma estilista, avisa
si intentas hacerlo.

**Cancelar**: abre la cita → "Cancelar cita". Queda marcada como cancelada,
no desaparece del historial.

**Marcar "No asistió"**: abre la cita → "Marcar como no asistió". Úsalo
cuando la clienta simplemente no llegó, distinto de una cancelación
(cancelada = se avisó con anticipación; no asistió = no se presentó).

**Cobrar anticipo**: al crear o editar la cita, hay un campo "Anticipo
(MXN)" — lo que se cobre ahí queda registrado y se resta del total al cerrar
la cita.

**Cobrar el saldo restante**: abre la cita → botón "Cobrar saldo $XXX". Esto
marca la cita como pagada por completo.

## Clientas

**Crear clienta nueva**: CRM → "Nueva clienta". Solo el nombre es
obligatorio, pero conviene siempre poner el teléfono (con lada, 10 dígitos)
para poder contactarla.

**Evitar duplicados**: el sistema no permite guardar dos clientas con el
mismo número de teléfono — si intentas registrar una que ya existe, te
avisa y te deja ir directo a su perfil en vez de crear un duplicado.

**Fotos antes/después**: dentro del perfil de la clienta, pestaña
"Antes/Después" → "Nueva comparativa". Estas fotos son privadas, solo las ve
el personal con sesión iniciada, nunca son públicas.

## Ventas y caja

**Registrar una venta**: Ventas → "Nueva venta" → agrega servicios/productos
→ cobra.

**Cerrar caja del día**: Ventas → "Cerrar caja del día". Genera un corte con
los totales de efectivo, transferencia, tarjeta y pendientes del día. Una
vez cerrado, ese corte queda como registro permanente — no se puede editar
ni borrar (es una bitácora, como un libro contable).

## Servicios

**Desactivar un servicio** (en vez de borrarlo): Servicios → abre el
servicio → apaga el switch "Activo". Un servicio inactivo ya no aparece como
opción al crear una cita nueva, pero las citas viejas que ya lo usaban
conservan la información completa — no se rompe el historial.

## CRM y WhatsApp

El sistema manda WhatsApp automático en varios momentos de la agenda — no
hace falta hacer nada para que salgan, pero sí conviene saber cuándo pasa
cada uno:

- **Al agendar una cita**: se manda la confirmación en automático.
- **24h antes de la cita**: recordatorio automático, con botones de
  "Confirmar"/"Cancelar" que la clienta puede tocar directo.
- **Al cancelar una cita** (desde Agenda): se le avisa a la clienta sola,
  invitándola a reagendar si fue un error.
- **Al marcar "No asistió"**: mensaje automático preguntando si quiere
  reagendar.
- **Al cerrar una cita** (estado "Hecha"): mensaje de agradecimiento.
- **Cumpleaños y reactivación de clientas inactivas**: salen solos todos
  los días, pero reactivación siempre pide aprobación de alguien del
  equipo antes de mandarse (CRM → WhatsApp → Automatización) — es
  mensaje de marketing, no de confirmación de cita.

**Ver y contestar la conversación de una clienta**: entra a su perfil
(CRM → busca la clienta) → pestaña "WhatsApp". Ahí se ve todo lo que se
le ha mandado y lo que ha contestado, y se le puede responder directo si
escribió en las últimas 24 horas — pasado ese tiempo, WhatsApp ya no
permite texto libre y hay que usar una plantilla aprobada (ver más abajo).

**Bandeja general de conversaciones** (para ver todas las clientas que
han escrito, no solo una): CRM → pestaña "WhatsApp" → "Conversaciones".

**Mandar un mensaje a varias clientas a la vez** (ej. todas las que no
han venido en meses): CRM → pestaña "WhatsApp" → "Audiencias", elige la
sección, selecciona a quiénes, "Encolar envío". Si son 5 o más, el
sistema pide confirmar con el número exacto antes de mandarlo — revísalo
bien, no hay manera de deshacer un envío ya encolado salvo borrarlo a
mano en Automatización antes de que salga.

**Una clienta ya no quiere recibir mensajes**: si contesta "BAJA" se da
de baja sola automáticamente. También se puede quitar a mano desde su
perfil (editar clienta → apagar "Recibe mensajes por WhatsApp").

## Usuarios y accesos

**Dar de alta a alguien nuevo**: Ajustes → Usuarios y roles → "Nuevo
usuario" → llena nombre, correo, rol. Al guardar, le llega automáticamente
un correo de invitación para que configure su propia contraseña — no hace
falta hacer nada más de tu parte.

**Quitarle el acceso a alguien** (recomendado si deja el salón
temporalmente o hay dudas): abre su perfil → apaga "Cuenta activa". No puede
iniciar sesión mientras esté así, pero se puede reactivar después sin perder
nada de su historial.

**Eliminar una cuenta por completo** (irreversible, solo un administrador
puede hacerlo): abre el perfil del usuario → "Eliminar usuario". Su nombre
sigue apareciendo en reportes y auditoría viejos (para que esos registros
sigan siendo legibles), pero ya no puede volver a iniciar sesión con esa
cuenta nunca — si necesita volver a entrar, hay que crearle una cuenta
nueva.

## Si alguien no puede entrar

1. **"Correo o contraseña incorrectos"**: confirma que esté usando el correo
   exacto con el que se le dio de alta (no un alias ni una variación).
2. **No le llega el correo de invitación/recuperación**: revisa spam. Si
   sigue sin llegar después de varios minutos, un administrador puede volver
   a mandarle el acceso desde Ajustes → Usuarios y roles (editar su perfil
   y guardar de nuevo reenvía la invitación si todavía no tiene acceso
   configurado).
3. **"Este usuario no tiene acceso"** o simplemente no aparece en la
   pantalla de login: puede estar desactivado (`Cuenta activa` apagada) — un
   administrador lo reactiva desde su perfil en Ajustes.
4. Si nada de esto funciona, contacta al administrador del sistema (no hay
   forma de que alguien se auto-recupere el acceso sin pasar por alguien con
   permisos de admin).

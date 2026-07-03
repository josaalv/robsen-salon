# Checklist de pruebas antes de producción

No pude ejecutar nada de esto yo mismo: no tengo credenciales reales de
ningún usuario del sistema, y las pruebas de esta lista requieren una sesión
autenticada real en un navegador. Todo lo que sí pude verificar por mi
cuenta (políticas RLS directamente contra Supabase, `curl` con la anon key,
logs reales de Auth) está documentado en la entrega final, no aquí — esta
lista es específicamente lo que **falta que hagas tú**.

Marca cada casilla conforme la vayas probando. Si algo falla, anota
exactamente qué pasó (mensaje de error, pantalla, rol usado) para poder
diagnosticarlo.

## 1. Auth — flujos de acceso

- [ ] Login normal con una cuenta real funciona.
- [ ] Logout cierra la sesión de verdad (recargar no te deja adentro).
- [ ] Cerrar el navegador y volver a abrir la página mantiene la sesión
      (no pide login de nuevo) — sesión persistente.
- [ ] Un usuario con "Cuenta activa" apagada no puede iniciar sesión, o si
      ya tenía sesión abierta, pierde acceso a los datos de inmediato.
- [ ] Un usuario recién eliminado (Ajustes → Eliminar usuario) no puede
      volver a entrar con esas credenciales.
- [ ] "¿Olvidaste tu contraseña?" → llega el correo → el enlace abre
      `https://robseninterno.com` (no `localhost`) → permite poner una
      contraseña nueva → puedes entrar con la contraseña nueva.
- [ ] Invitar a un usuario nuevo desde Ajustes → le llega el correo → el
      enlace abre el dominio real → puede configurar su contraseña y entra
      correctamente a la app (no a una pantalla en blanco o de error).

## 2. Roles — probar desde la interfaz Y confirmar que el backend también bloquea

Para cada rol, inicia sesión con una cuenta de ese rol y confirma que la
interfaz solo te deja hacer lo que corresponde. Si tienes forma de abrir las
herramientas de desarrollador del navegador (F12 → pestaña Network) e
intentar una llamada directa a algo que no deberías poder hacer, mejor
— debe fallar con un error de permisos, no solo estar oculto en la UI.

**Admin**: puede ver/operar todo, crear y desactivar/eliminar usuarios,
editar precios, ver cierres de caja.

**Gerente**: puede operar ventas/citas/clientas/servicios/reportes; la
pantalla de Usuarios y roles debe verse de solo lectura (sin botón "Nuevo
usuario", sin poder abrir el formulario de edición de otro usuario).

**Recepción**: puede crear clientas, crear/reagendar/cancelar citas,
cobrar. No debe poder cambiar precios de productos/servicios ni tocar
usuarios.

**Estilista**: ve solo sus propias citas y las clientas asociadas a ellas
(no la base completa de clientas). No ve ventas de otros estilistas, no
puede borrar ventas, no puede cambiar precios generales.

**Usuario inactivo**: aunque tuviera sesión abierta antes de desactivarlo,
no debe poder seguir operando nada después.

**Sin sesión (anon, ventana de incógnito)**: no debe poder leer usuarios,
clientas ni ventas por la API directa (puedes probar con `curl` — ver
`docs/SECURITY.md`, sección "Verificación rápida" — o revisando la pestaña
Network del navegador mientras usas el formulario público de reservas).

## 3. Storage y privacidad de fotos

- [ ] Sube una foto antes/después de una clienta de prueba → se ve
      correctamente dentro del CRM.
- [ ] Copia el link de esa imagen (clic derecho → copiar dirección de
      imagen, o revisa la URL en Network) y ábrelo en una ventana de
      incógnito sin sesión — **debe fallar o pedir autenticación**, no
      mostrar la foto directamente.
- [ ] El logo del salón y las fotos de estilistas en la página pública de
      reservas sí deben verse sin sesión (eso es intencional, son públicas).

## 4. QA operativo — simular un día real del salón

1. [ ] Crear clienta nueva.
2. [ ] Intentar crear una clienta con el mismo teléfono que otra ya
       existente — debe avisar del duplicado.
3. [ ] Crear cita con un servicio activo.
4. [ ] Intentar crear una cita encimada con la misma estilista en el mismo
       horario — debe bloquearse.
5. [ ] Reagendar una cita.
6. [ ] Marcar una cita como confirmada.
7. [ ] Registrar un anticipo sobre una cita.
8. [ ] Liquidar el saldo restante de esa cita.
9. [ ] Crear una venta con un servicio más un producto/adicional.
10. [ ] Aplicar un descuento a una venta.
11. [ ] Marcar una cita como "No asistió".
12. [ ] Cancelar una cita.
13. [ ] Desactivar un servicio.
14. [ ] Confirmar que ese servicio inactivo ya NO aparece como opción al
        crear una cita nueva.
15. [ ] Confirmar que una cita vieja que ya usaba ese servicio sigue
        mostrando su información completa (no se rompe el historial).
16. [ ] Subir una foto antes/después.
17. [ ] Enviar un mensaje manual desde Seguimiento/WhatsApp.
18. [ ] Hacer el cierre de caja del día.
19. [ ] Intentar modificar un cierre de caja ya cerrado — no debe permitirlo
        (es una bitácora inmutable).
20. [ ] Revisar que las acciones anteriores queden en `audit_logs` (puedes
        pedirle a quien tenga acceso técnico que las consulte por SQL, no
        hay pantalla dedicada todavía).
21. [ ] Cerrar sesión.
22. [ ] Entrar con una cuenta de otro rol y confirmar que ve/puede hacer
        solo lo que le corresponde.
23. [ ] Probar la app desde un celular real o el modo responsive del
        navegador a 390px de ancho — que nada se corte ni se vea roto.

## 5. Venta transaccional, citas, vínculo estilista y RLS (fase 2 de integridad de datos)

Esta sección prueba específicamente lo que se corrigió en esta ronda:
venta atómica vía RPC, mensaje de error de citas empalmadas, y el vínculo
nuevo `usuarios.estilista_id`.

**Venta transaccional**

1. [ ] Crear una venta válida con al menos un producto de inventario (POS o
       Ventas → Nueva venta) → confirma que aparece de inmediato en el
       listado de **Ventas**.
2. [ ] Confirma que esa misma venta aparece en el resumen de **Caja** del
       día (Ventas → pestaña Caja/Cierre).
3. [ ] Confirma que el ingreso de esa venta se refleja en el **Dashboard**
       (ventas de hoy / ingresos del día).
4. [ ] Si la venta tenía una clienta asociada, entra a su perfil en **CRM**
       y confirma que aparece en su historial de compras/visitas.
5. [ ] Confirma que el **stock del producto** vendido bajó exactamente la
       cantidad vendida (Productos → el producto usado).
6. [ ] Forzar un error: por ejemplo, intenta vender más unidades de un
       producto de las que existen en stock, o desconecta tu internet a
       mitad de confirmar una venta y vuelve a conectar. Debe aparecer un
       mensaje de error visible (no un éxito falso) y **no debe quedar
       ninguna venta a medias** — revisa en Ventas que no aparezca un
       ticket nuevo sin líneas o con datos incompletos.

**Citas**

7. [ ] Crear una cita válida (Agenda → Nueva cita).
8. [ ] Intentar crear una segunda cita para la **misma estilista** en un
       horario que se encima con la anterior → debe rechazarse mostrando
       exactamente: *"No se pudo guardar la cita porque se empalma con
       otra cita o bloqueo."* — no un error genérico ni silencio.
9. [ ] Editar una cita existente (cambiar hora, servicio o estado) y
       confirmar que el cambio se guarda y se refleja al recargar la página.
10. [ ] Borrar una cita y confirmar que desaparece de la agenda y no
        reaparece al recargar.

**Vínculo usuario ↔ estilista**

11. [ ] Ajustes → Usuarios y roles → crear un usuario nuevo con rol
        **Estilista**, y en el campo "Vincular con estilista existente"
        selecciona un registro ya existente de la lista de Empleados (o usa
        el botón "Crear registro de estilista" si es alguien nuevo que
        todavía no está en Empleados). Confirma que el botón Guardar está
        bloqueado si no seleccionas ninguna estilista.
12. [ ] Cierra sesión e inicia sesión con las credenciales de ese estilista
        (usa "Olvidé mi contraseña" o la invitación por correo si es
        cuenta nueva).
13. [ ] Confirma que al entrar ve **su propia agenda** con sus citas.
14. [ ] Confirma que **no ve** citas, ventas ni comisiones de otras
        estilistas — ni en Agenda, ni en Ventas, ni en el reporte de
        Empleados (esto es lo que protege `current_estilista_id()` vía RLS,
        que ya existía; esta prueba confirma que con el vínculo puesto
        realmente funciona para una cuenta real).

**Configuración y sesión**

15. [ ] Guardar un cambio en Ajustes → Datos del salón (o cualquier otra
        subsección de Configuración) y confirmar que persiste al recargar.
16. [ ] Cerrar sesión y volver a entrar con la misma cuenta — confirma que
        los datos que ves son los reales de Supabase, no una versión vieja
        en caché.
17. [ ] Abre las herramientas de desarrollador del navegador (F12 →
        Application/Almacenamiento → Local Storage) y revisa la clave
        `rb_data_v3` — después de cerrar sesión y entrar con OTRA cuenta,
        confirma que no quedan datos de la sesión anterior visibles ahí
        que no correspondan a lo que esa nueva cuenta debería ver.

## Qué hacer si algo de esto falla

Anota exactamente: qué paso, con qué rol, qué esperabas que pasara y qué
pasó en realidad (incluye el mensaje de error si lo hay). Con eso puedo
diagnosticar y corregir en la siguiente sesión — sin ese detalle es mucho
más lento encontrar la causa.

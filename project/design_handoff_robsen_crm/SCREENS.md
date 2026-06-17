# Robsen — Detalle de pantallas

Documentación pantalla por pantalla. Layouts, componentes, contenido e interacciones. Los valores de color/tipografía referencian los tokens de `README.md` §7.

**Layout global:** sidebar fija 256px (izquierda) + área principal con topbar fija 74px y contenido con padding 30px 32px. La sidebar se filtra según los permisos del rol activo. La topbar tiene buscador, popover de agenda (icono calendario) y popover de notificaciones (campana con punto). El título de la topbar muestra el nombre del módulo; el logo del salón aparece arriba en la sidebar (cargable, reemplaza el wordmark "Robsen").

---

## 1. Dashboard (`screen-dashboard.jsx`)
**Propósito:** vista general al abrir sesión.
**Layout:** saludo + fecha (eyebrow oro) arriba con acciones "Exportar" / "Nueva cita". Luego:
- Fila de 4 **KPIs principales** (grid 4 col): Ventas de hoy / semana / mes / Ticket promedio. Cada uno con icono en cuadro oro translúcido, label uppercase, valor 31px serif, delta (verde ↑) y sparkline SVG.
- Fila de 4 **KPIs secundarios**: Citas confirmadas, Por confirmar, Anticipos recibidos, Clientas nuevas/recurrentes.
- Fila 2 columnas (1.55fr / 1fr): **Ventas de la semana** (bar chart, toggle Semana/Mes) + **Próximas citas de hoy** (lista con hora, clienta, servicio con punto de color del estilista, badge de estado).
- Fila 2 columnas: **Servicios más vendidos** (ranking con barras) + **Alertas importantes** (citas sin confirmar, pagos pendientes, clientas inactivas, reseñas — cada una con botón de acción).

**Interacciones:** "Nueva cita" → navega a Agenda y abre el modal de cita. Alertas "Ver" → navegan a Ventas/Reseñas. "Ver agenda completa" → Agenda. Exportar → toast.

---

## 2. Agenda (`screen-agenda.jsx`)
**Propósito:** gestión de citas del salón.
**Layout:** header con título + toggle **Día/Semana/Mes**, "Bloquear horario", "Nueva cita". Barra de filtro por estilista (chips con punto de color) + leyenda de estados. Grid principal:
- **Día:** columnas por estilista (header con avatar + rol), filas de hora 09–20h (60px/hora). Citas posicionadas absolutamente según hora y duración, coloreadas por estado (borde izquierdo + fondo translúcido). Bloques de descanso con patrón rayado. Panel lateral derecho (320px) con **detalle de cita** seleccionada.
- **Semana:** 7 columnas (Lun–Dom), citas apiladas por día, domingo "Cerrado".
- **Mes:** cuadrícula de 30 días, puntos de color por cita, hoy resaltado en oro.

**Detalle de cita (panel):** clienta, estado, servicio, horario, estilista, total/anticipo/saldo, notas. Botones: Cobrar saldo (marca 'done'), WhatsApp, Editar, Eliminar.

**Modal crear/editar cita (`CitaModal`):** clienta (con datalist de clientas existentes), servicio (select), estilista, hora (input time), estado, anticipo. Muestra total y saldo calculados. Persiste vía `RBStore.upsertCita`.

**Estados de cita (colores):** pendiente=ámbar, confirmada=verde sage, anticipo pagado=**rosa**, completada=azul, cancelada=rojo apagado.

---

## 3. Ventas / Punto de Venta (`screen-ventas.jsx` + `screen-pos.jsx`)
**Propósito:** registrar ventas que mezclan servicios, productos y adicionales.
**Layout (`screen-ventas`):** header "Nueva venta". 4 KPIs (ventas de hoy, tickets, ticket promedio, comisiones generadas). Filtros (Todas / Con producto / Solo servicio / Con saldo). Tabla de tickets: ticket #, fecha, clienta, detalle (resumen de líneas), atendió (avatares de estilistas), pago, total, estado (Pagada / Saldo / Pendiente).

**POS Builder (`screen-pos.jsx`, modal grande 980px):**
- Izquierda: catálogo con 3 tabs (Servicios / Productos / Adicionales) + búsqueda. Grid de tarjetas con icono, nombre, subtítulo (categoría/duración o marca/stock) y precio. Productos agotados deshabilitados.
- Derecha (380px): ticket en vivo. Selector de clienta arriba. Cada línea: nombre, precio unitario + % comisión, **selector de estilista por línea** ("Sin asignar" para servicio, "Vendido por…" para producto), cantidad ±, eliminar. Abajo: descuento, anticipo, forma de pago, subtotal, comisión del equipo, total/saldo grande, botón "Cobrar venta".

**Al cobrar:** `RBStore.addVenta` → descuenta inventario de productos, genera movimiento + transacción, marca 'pagada', persiste, alimenta finanzas/comisiones/CRM.

**Detalle de venta (`VentaDetalle`):** desglose de líneas con tipo (servicio/producto/adicional), estilista y comisión; subtotal, descuento, anticipo aplicado, total/saldo, comisión total. Botones Imprimir ticket / Enviar.

---

## 4. CRM de clientas (`screen-crm.jsx`)
**Propósito:** base de clientas, retención y perfiles.
**Layout:** header con toggle **Clientas / Retención**, Importar, Nueva clienta.

**Vista Clientas:** 5 mini-KPIs por estado (VIP/Frecuentes/Activas/Nuevas/Inactivas, clicables = filtran). Tabla con buscador + chips de filtro. Columnas **ordenables**: Clienta (avatar+nombre+visitas/gasto), Estado (badge), Teléfono, Última visita (con **punto de color**: al día=verde / le toca=ámbar / atrasada=rojo), Ticket promedio, Servicio favorito, Estilista. Click → perfil.

**Vista Retención:** 3 KPIs (Por reagendar / En riesgo de fuga / Cumpleaños 30d). Tabla "Le toca volver" (clienta, servicio+ciclo, última visita, fecha sugerida, estado, botón Reagendar→WhatsApp). Panel "Riesgo de fuga" (En riesgo/En fuga + días sin venir + campaña de reactivación). Panel "Próximos cumpleaños" (fecha, días restantes, botón Felicitar→WhatsApp).

**Perfil de clienta (`ClientaPerfil`):** botones Volver / Editar / Eliminar. Tarjeta izquierda (340px): avatar, nombre, badge de estado, Agendar/Mensaje, datos de contacto, **tarjeta de Retención** (salud de la clienta, próxima visita sugerida, cumpleaños), stats (visitas, gasto total, ticket prom, antigüedad). Derecha: tabs **Historial** (citas + ventas POS reales con ticket), **Fórmulas de color**, **Preferencias** (chips + notas), **Antes/Después** (placeholders de imagen).

**Modal clienta (`ClientaModal`):** nombre, teléfono, estado, estilista habitual, servicio favorito, cumpleaños, ciclo de recompra (semanas). Persiste vía `RBStore.upsertClienta`.

**Lógica de retención (`RBh.insights`):** calcula días desde última visita, recompra (al día / le toca / atrasada), riesgo (sana / riesgo / fuga), próxima visita sugerida (última + ciclo×7), días al cumpleaños.

---

## 5. Servicios y paquetes (`screen-servicios.jsx`)
**Propósito:** catálogo de servicios.
**Layout:** header "Nuevo servicio". Chips de categoría. Grid 3 col de tarjetas: badge categoría + badge En línea/Solo salón, nombre serif, duración + "requiere anticipo", avatares de estilistas que lo realizan, precio grande en oro.

**Editor (`ServicioEditor`):** nombre, categoría, duración, precio, anticipo sugerido (35%), chips de estilistas (toggle), switches "Requiere anticipo" y "Disponible en línea". Eliminar/Guardar. Persiste vía `RBStore.upsertServicio`.

---

## 6. Productos e inventario (`screen-productos.jsx`)
**Propósito:** inventario ligado a ventas.
**Layout:** header "Nuevo producto" / "Vender producto". 4 KPIs (valor del inventario, venta producto del mes, stock bajo, agotados). Alerta de reorden si hay stock bajo/agotado. Toggle **Inventario / Transacciones / Movimientos**.
- **Inventario:** chips de categoría + búsqueda. Tabla: producto (icono+nombre+marca/SKU), uso (Reventa/Uso interno), costo, precio, margen %, stock (con badge En stock/Bajo/Agotado), vendidos, acciones (Vender / editar).
- **Transacciones:** ventas de producto ligadas a finanzas (ticket, fecha, clienta, artículos, tipo Producto/Servicio+producto, pago, total).
- **Movimientos (kardex):** entradas (compras), salidas (ventas), consumos (en servicios), con cantidad y motivo.

**Editor (`ProductoEditor`):** nombre, marca, SKU, switch reventa/interno, costo, precio (deshabilitado si interno), stock, stock mínimo. Persiste vía `RBStore.upsertProducto`.

**Vender (`VenderModal`):** producto (select con stock), cantidad ±, forma de pago, clienta opcional, **vendido por** (estilista, para comisión), stock resultante, total. `RBStore.venderProducto` → crea ticket en Ventas + descuenta stock + movimiento.

---

## 7. Empleados y comisiones (`screen-empleados.jsx`)
**Propósito:** equipo, rendimiento y comisiones.
**Layout:** header "Horarios" / "Nueva estilista". Grid (1fr / 360px):
- **Tabla rendimiento:** profesional (avatar+rol), citas, ventas, ocupación (barra), comisión (oro), rating ★. Click selecciona.
- **Detalle estilista (panel):** avatar grande, nombre, rol, stats (citas atendidas, ventas, comisión %, rating), servicios que realiza (chips), disponibilidad (Lun-Vie / Sáb / Dom), botón "Editar perfil y comisión".

**Editor (`EstilistaEditor`):** nombre, especialidad/rol, comisión %, color de agenda (swatches). Persiste vía `RBStore.upsertEstilista`.
**Horarios (`HorariosModal`):** matriz estilistas × días (Lun-Dom) con celdas de disponibilidad.

---

## 8. Finanzas y reportes (`screen-finanzas.jsx`)
**Propósito:** salud financiera.
**Layout:** header con toggle Semana/Mes/Año + Exportar reporte. 
- Fila: **Utilidad aproximada** (valor 40px oro, delta, margen) + **Comparativo mensual** (bar chart 6 meses, último resaltado).
- 5 cards de desglose: ingresos servicios, ingresos producto, gastos, anticipos, comisiones.
- **Servicio vs. producto** (donut, en vivo desde tickets POS) + **Mezcla de ingresos por ticket** (barras servicios/productos/adicionales con %).
- **Ingresos por categoría** (donut) + **Ingresos por servicio** (tabla con participación %).
- **Anticipos del periodo** (recibidos/aplicados/pendientes/reembolsados) + **Resumen de utilidad** (ingresos − gastos − comisiones = utilidad neta).

---

## 9. Seguimiento y WhatsApp (`screen-whatsapp.jsx`)
**Propósito:** comunicación con clientas.
**Layout:** header "Envío masivo". 4 KPIs (pendientes, confirmaciones hoy, sin responder, inactivas 30/60/90). Grid 3 col (380px / 1fr / 300px):
- **Bandeja:** toggle Pendientes/Todos/Inactivas. Lista de conversaciones (avatar con punto si sin responder, nombre, hora, preview, tipo, estado de mensaje con ✓/✓✓).
- **Conversación:** header con avatar + "WhatsApp en línea" + Ver perfil. Burbujas (salientes oro-verde, entrantes gris). Input con adjuntar + enviar (Enter envía). Mensajes enviados aparecen como burbujas + toast.
- **Plantillas:** tarjetas (Confirmación, Recordatorio 24h, Reactivación, Agradecimiento) que al tocar **insertan el texto** con variables resueltas. Nueva plantilla.

**Estados de mensaje:** enviado (✓ gris), entregado (✓✓ gris), respondido (✓✓ verde).

---

## 10. Ajustes (`screen-ajustes.jsx`)
**Propósito:** configuración del sistema.
**Layout:** menú lateral (232px) con secciones + contenido. Secciones:
- **Mi perfil:** foto, nombre, rol (solo lectura), email, teléfono, seguridad (cambio de contraseña, 2FA por WhatsApp).
- **Salón:** **logo del salón** (sube imagen → reemplaza wordmark del sidebar, persiste en `rb_logo`), datos del negocio, horarios de atención por día (switches + horas).
- **Usuarios y roles:** tabla de usuarios (activar/desactivar) + **matriz de permisos** (módulos × roles, check/sin acceso). Invitar usuario.
- **Notificaciones:** toggles de automatizaciones (confirmación, recordatorios, reactivación, agradecimiento, alertas).
- **Anticipos y pagos:** % de anticipo, política de cancelación, métodos de pago, moneda/IVA.
- **Apariencia:** tema, color de acento, densidad, idioma, **restablecer datos demo**.

**Permisos:** secciones de gestión (Salón, Usuarios, Notificaciones, Pagos) solo visibles para Admin/Gerente.

---

## 11. Login + Agendamiento público

**Login (`screen-login.jsx`):** layout split. Izquierda (marca, negro→oro): wordmark Robsen, mensaje, features. Derecha: formulario (email, contraseña con ver/ocultar, recordarme) + **acceso rápido por rol** (4 tarjetas: Administrador/Gerente/Recepción/Estilista). Al entrar, carga el usuario de ese rol y filtra la navegación. Persiste sesión en localStorage (`rb_user`).

**Agendamiento de clienta (`screen-booking.jsx`):** vista pública premium, layout split. Izquierda: marca + stepper de 5 pasos. Derecha: flujo de 5 pasos:
1. **Servicio** (lista de servicios online con precio).
2. **Estilista** (los que realizan el servicio, o "Sin preferencia").
3. **Fecha y hora** (selector de día + slots, algunos ocupados).
4. **Datos** (nombre, WhatsApp, email, notas) + aviso de anticipo si aplica.
5. **Confirmación** ("¡Solicitud recibida! Tu cita será confirmada por nuestro equipo").
Resumen de la selección visible en pasos 1–4. Botón final "Pagar anticipo" o "Solicitar cita".

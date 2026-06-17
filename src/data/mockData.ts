import type { RBData, Estilista, Servicio, Clienta, Cita, Venta, Producto, Movimiento, Transaccion, Mensaje, Plantilla, Usuario, Modulo, Rol, Adicional } from '../types'

export const estilistas: Estilista[] = [
  { id: 'e1', nombre: 'Valeria Mendoza',  rol: 'Color & Balayage', color: '#C8A14A', ini: 'VM' },
  { id: 'e2', nombre: 'Renata Ochoa',     rol: 'Estilista Senior', color: '#93B58C', ini: 'RO' },
  { id: 'e3', nombre: 'Mariana Salgado',  rol: 'Tratamientos',     color: '#6FA6B8', ini: 'MS' },
  { id: 'e4', nombre: 'Daniela Cortés',   rol: 'Uñas & Spa',       color: '#C77B7B', ini: 'DC' },
  { id: 'e5', nombre: 'Paola Rivas',      rol: 'Maquillaje',       color: '#B08AC7', ini: 'PR' },
]

export const servicios: Servicio[] = [
  { id:'s1',  nombre:'Balayage Premium',         cat:'Mechas',       precio:2800, dur:180, anticipo:true,  online:true,  prof:['e1'] },
  { id:'s2',  nombre:'Colorimetría completa',    cat:'Colorimetría', precio:1950, dur:150, anticipo:true,  online:true,  prof:['e1','e2'] },
  { id:'s3',  nombre:'Retoque de raíz',          cat:'Colorimetría', precio:950,  dur:90,  anticipo:false, online:true,  prof:['e1','e2'] },
  { id:'s4',  nombre:'Corte & Peinado',          cat:'Cortes',       precio:680,  dur:60,  anticipo:false, online:true,  prof:['e2'] },
  { id:'s5',  nombre:'Tratamiento de Keratina',  cat:'Tratamientos', precio:2400, dur:150, anticipo:true,  online:true,  prof:['e3'] },
  { id:'s6',  nombre:'Botox Capilar',            cat:'Tratamientos', precio:1600, dur:120, anticipo:true,  online:true,  prof:['e3'] },
  { id:'s7',  nombre:'Manicure Ruso',            cat:'Uñas',         precio:550,  dur:75,  anticipo:false, online:true,  prof:['e4'] },
  { id:'s8',  nombre:'Pedicure Spa',             cat:'Pedicure',     precio:620,  dur:75,  anticipo:false, online:true,  prof:['e4'] },
  { id:'s9',  nombre:'Maquillaje Social',        cat:'Maquillaje',   precio:1200, dur:75,  anticipo:true,  online:true,  prof:['e5'] },
  { id:'s10', nombre:'Maquillaje de Novia',      cat:'Maquillaje',   precio:3500, dur:120, anticipo:true,  online:false, prof:['e5'] },
  { id:'s11', nombre:'Extensiones de Cabello',   cat:'Extensiones',  precio:5400, dur:240, anticipo:true,  online:false, prof:['e1'] },
  { id:'s12', nombre:'Depilación con cera',      cat:'Depilación',   precio:480,  dur:45,  anticipo:false, online:true,  prof:['e4'] },
  { id:'s13', nombre:'Paquete Novia Total',      cat:'Paquetes',     precio:6800, dur:300, anticipo:true,  online:false, prof:['e5','e1'] },
  { id:'s14', nombre:'Paquete Glow Mensual',     cat:'Paquetes',     precio:2900, dur:180, anticipo:true,  online:true,  prof:['e2','e3'] },
]

export const clientas: Clienta[] = [
  { id:'c1',  nombre:'Ana Sofía Beltrán',   tel:'33 1204 5589', estado:'VIP',       ultima:'08 Jun 2026', ticket:3120, fav:'Balayage Premium',        est:'e1', visitas:24, gasto:74880, ini:'AB', cumple:'14 Ago', ciclo:10 },
  { id:'c2',  nombre:'Regina Torres',       tel:'33 2298 1130', estado:'Frecuente', ultima:'06 May 2026', ticket:1480, fav:'Colorimetría completa',   est:'e2', visitas:16, gasto:23680, ini:'RT', cumple:'18 Jun', ciclo:5 },
  { id:'c3',  nombre:'Camila Núñez',        tel:'33 1567 9921', estado:'VIP',       ultima:'10 Jun 2026', ticket:2950, fav:'Extensiones de Cabello',  est:'e1', visitas:19, gasto:56050, ini:'CN', cumple:'02 Jul', ciclo:10 },
  { id:'c4',  nombre:'Fernanda Lozano',     tel:'33 3341 7708', estado:'Activa',    ultima:'01 May 2026', ticket:980,  fav:'Corte & Peinado',         est:'e2', visitas:7,  gasto:6860,  ini:'FL', cumple:'21 Nov', ciclo:6 },
  { id:'c5',  nombre:'Mariana del Río',     tel:'33 1190 4432', estado:'Frecuente', ultima:'06 Jun 2026', ticket:1720, fav:'Tratamiento de Keratina', est:'e3', visitas:13, gasto:22360, ini:'MR', cumple:'15 Jun', ciclo:12 },
  { id:'c6',  nombre:'Valentina Ríos',      tel:'33 2876 0091', estado:'Nueva',     ultima:'11 Jun 2026', ticket:550,  fav:'Manicure Ruso',           est:'e4', visitas:1,  gasto:550,   ini:'VR', cumple:'30 Sep', ciclo:3 },
  { id:'c7',  nombre:'Isabela Carmona',     tel:'33 4412 6655', estado:'Activa',    ultima:'29 May 2026', ticket:1340, fav:'Botox Capilar',           est:'e3', visitas:9,  gasto:12060, ini:'IC', cumple:'25 Jun', ciclo:8 },
  { id:'c8',  nombre:'Daniela Esquivel',    tel:'33 1023 8847', estado:'Inactiva',  ultima:'12 Feb 2026', ticket:2100, fav:'Balayage Premium',        est:'e1', visitas:6,  gasto:12600, ini:'DE', cumple:'08 Abr', ciclo:10 },
  { id:'c9',  nombre:'Paulina Cervantes',   tel:'33 3398 2214', estado:'VIP',       ultima:'09 Jun 2026', ticket:3400, fav:'Paquete Novia Total',     est:'e5', visitas:11, gasto:37400, ini:'PC', cumple:'11 Ene', ciclo:12 },
  { id:'c10', nombre:'Renata Villalobos',   tel:'33 2210 5566', estado:'Frecuente', ultima:'15 May 2026', ticket:1290, fav:'Pedicure Spa',            est:'e4', visitas:14, gasto:18060, ini:'RV', cumple:'05 Jul', ciclo:4 },
  { id:'c11', nombre:'Gabriela Mora',       tel:'33 1765 3390', estado:'Activa',    ultima:'31 May 2026', ticket:1100, fav:'Maquillaje Social',       est:'e5', visitas:5,  gasto:5500,  ini:'GM', cumple:'03 Dic', ciclo:12 },
  { id:'c12', nombre:'Sofía Carrillo',      tel:'33 4490 1182', estado:'Inactiva',  ultima:'18 Mar 2026', ticket:760,  fav:'Corte & Peinado',         est:'e2', visitas:4,  gasto:3040,  ini:'SC', cumple:'27 Feb', ciclo:6 },
]

export const hoy: Cita[] = [
  { id:'a1',  h:'09:00', dur:90,  cl:'Regina Torres',      srv:'Colorimetría completa',   est:'e2', estado:'conf', total:1950, ant:600 },
  { id:'a2',  h:'09:30', dur:75,  cl:'Valentina Ríos',     srv:'Manicure Ruso',           est:'e4', estado:'pay',  total:550,  ant:200 },
  { id:'a3',  h:'10:30', dur:180, cl:'Ana Sofía Beltrán',  srv:'Balayage Premium',        est:'e1', estado:'pay',  total:2800, ant:1000 },
  { id:'a4',  h:'11:00', dur:120, cl:'Isabela Carmona',    srv:'Botox Capilar',           est:'e3', estado:'pend', total:1600, ant:0 },
  { id:'a5',  h:'12:30', dur:60,  cl:'Fernanda Lozano',    srv:'Corte & Peinado',         est:'e2', estado:'conf', total:680,  ant:0 },
  { id:'a6',  h:'13:00', dur:75,  cl:'Mariana del Río',    srv:'Pedicure Spa',            est:'e4', estado:'conf', total:620,  ant:0 },
  { id:'a7',  h:'14:00', dur:150, cl:'Paulina Cervantes',  srv:'Tratamiento de Keratina', est:'e3', estado:'pend', total:2400, ant:800 },
  { id:'a8',  h:'16:00', dur:75,  cl:'Gabriela Mora',      srv:'Maquillaje Social',       est:'e5', estado:'conf', total:1200, ant:400 },
  { id:'a9',  h:'17:00', dur:240, cl:'Camila Núñez',       srv:'Extensiones de Cabello',  est:'e1', estado:'pay',  total:5400, ant:2000 },
  { id:'a10', h:'18:00', dur:90,  cl:'Mariana del Río',    srv:'Retoque de raíz',         est:'e2', estado:'pend', total:950,  ant:0 },
]

export const ventas: Venta[] = [
  { id:'v1', ticket:'#1042', fecha:'15 Jun · 11:20', cliente:'Ana Sofía Beltrán', clienteId:'c1', pago:'Tarjeta', estado:'pagada', desc:0, anticipo:1000,
    lineas:[ {tipo:'servicio',  nombre:'Balayage Premium',            est:'e1', cant:1, precio:2800, com:35},
             {tipo:'producto',  nombre:'Olaplex N°3 Hair Perfector',  est:'e1', cant:1, precio:720,  com:10} ] },
  { id:'v2', ticket:'#1041', fecha:'15 Jun · 10:55', cliente:'Camila Núñez', clienteId:'c3', pago:'Efectivo', estado:'pagada', desc:0, anticipo:2000,
    lineas:[ {tipo:'servicio',  nombre:'Extensiones de Cabello',      est:'e1', cant:1, precio:5400, com:35},
             {tipo:'producto',  nombre:'Moroccanoil Treatment 100ml', est:'e1', cant:1, precio:1240, com:10} ] },
  { id:'v3', ticket:'#1040', fecha:'15 Jun · 09:40', cliente:'Valentina Ríos', clienteId:'c6', pago:'Tarjeta', estado:'pagada', desc:55, anticipo:200,
    lineas:[ {tipo:'servicio',  nombre:'Manicure Ruso',               est:'e4', cant:1, precio:550,  com:25},
             {tipo:'producto',  nombre:'OPI Esmalte Big Apple Red',   est:'e4', cant:1, precio:260,  com:10},
             {tipo:'adicional', nombre:'Lavado y secado express',     est:null, cant:1, precio:180,  com:0} ] },
  { id:'v4', ticket:'#1039', fecha:'14 Jun · 19:05', cliente:'Regina Torres', clienteId:'c2', pago:'Tarjeta', estado:'pagada', desc:0, anticipo:600,
    lineas:[ {tipo:'servicio',  nombre:'Colorimetría completa',       est:'e2', cant:1, precio:1950, com:30},
             {tipo:'producto',  nombre:'Olaplex N°3 Hair Perfector',  est:'e2', cant:1, precio:720,  com:10} ] },
  { id:'v5', ticket:'#1037', fecha:'14 Jun · 14:30', cliente:'Paulina Cervantes', clienteId:'c9', pago:'Pendiente', estado:'parcial', desc:0, anticipo:800,
    lineas:[ {tipo:'servicio',  nombre:'Maquillaje de Novia',         est:'e5', cant:1, precio:3500, com:30},
             {tipo:'adicional', nombre:'Peinado adicional',           est:'e5', cant:1, precio:350,  com:30} ] },
  { id:'v6', ticket:'#1036', fecha:'14 Jun · 12:10', cliente:'Mariana del Río', clienteId:'c5', pago:'Transferencia', estado:'pagada', desc:0, anticipo:0,
    lineas:[ {tipo:'servicio',  nombre:'Tratamiento de Keratina',     est:'e3', cant:1, precio:2400, com:32},
             {tipo:'producto',  nombre:'Bain Satin Shampoo 250ml',    est:'e3', cant:1, precio:760,  com:10} ] },
]

export const productos: Producto[] = [
  { id:'pr1',  sku:'OLA-N3',   nombre:'Olaplex N°3 Hair Perfector',  marca:'Olaplex',     cat:'Cuidado',    uso:'retail',  costo:380, precio:720,  stock:18, min:6,  vendidos:42 },
  { id:'pr2',  sku:'OLA-N0',   nombre:'Olaplex N°0 Bond Building',   marca:'Olaplex',     cat:'Tratamiento',uso:'interno', costo:520, precio:0,    stock:5,  min:4,  vendidos:0 },
  { id:'pr3',  sku:'KER-NUT',  nombre:'Kérastase Nutritive Mask',    marca:'Kérastase',   cat:'Cuidado',    uso:'retail',  costo:640, precio:1180, stock:11, min:5,  vendidos:23 },
  { id:'pr4',  sku:'KER-BAIN', nombre:'Bain Satin Shampoo 250ml',    marca:'Kérastase',   cat:'Shampoo',    uso:'retail',  costo:420, precio:760,  stock:3,  min:6,  vendidos:31 },
  { id:'pr5',  sku:'LOR-MAJ7', nombre:'Majirel Tinte 7.1 60ml',      marca:"L'Oréal Pro", cat:'Color',      uso:'interno', costo:155, precio:0,    stock:24, min:12, vendidos:0 },
  { id:'pr6',  sku:'LOR-OXY',  nombre:'Oxidante 20 vol 1L',          marca:"L'Oréal Pro", cat:'Color',      uso:'interno', costo:180, precio:0,    stock:2,  min:5,  vendidos:0 },
  { id:'pr7',  sku:'WEL-BLON', nombre:'Blondor Polvo Decolorante',   marca:'Wella',       cat:'Color',      uso:'interno', costo:640, precio:0,    stock:7,  min:4,  vendidos:0 },
  { id:'pr8',  sku:'MOR-OIL',  nombre:'Moroccanoil Treatment 100ml', marca:'Moroccanoil', cat:'Aceite',     uso:'retail',  costo:680, precio:1240, stock:14, min:5,  vendidos:38 },
  { id:'pr9',  sku:'OPI-RED',  nombre:'OPI Esmalte Big Apple Red',   marca:'OPI',         cat:'Uñas',       uso:'retail',  costo:120, precio:260,  stock:22, min:8,  vendidos:54 },
  { id:'pr10', sku:'OPI-BASE', nombre:'OPI Base Coat 15ml',          marca:'OPI',         cat:'Uñas',       uso:'interno', costo:140, precio:0,    stock:9,  min:4,  vendidos:0 },
  { id:'pr11', sku:'RBS-TOTE', nombre:'Robsen Tote Bag Edición',     marca:'Robsen',      cat:'Boutique',   uso:'retail',  costo:90,  precio:320,  stock:0,  min:5,  vendidos:27 },
  { id:'pr12', sku:'RBS-CAND', nombre:'Robsen Vela Aromática',       marca:'Robsen',      cat:'Boutique',   uso:'retail',  costo:110, precio:290,  stock:16, min:6,  vendidos:19 },
]

export const movimientos: Movimiento[] = [
  { id:'mv1', fecha:'15 Jun · 11:20', prod:'Olaplex N°3 Hair Perfector',  tipo:'salida',  cant:1,  motivo:"Venta · Ticket #1042",          ref:'tx1' },
  { id:'mv2', fecha:'15 Jun · 10:55', prod:'Moroccanoil Treatment 100ml', tipo:'salida',  cant:1,  motivo:"Venta · Ticket #1041",          ref:'tx2' },
  { id:'mv3', fecha:'15 Jun · 10:30', prod:'Majirel Tinte 7.1 60ml',     tipo:'consumo', cant:1,  motivo:"Servicio · Balayage (Ana S.)",  ref:'a3' },
  { id:'mv4', fecha:'15 Jun · 09:40', prod:'OPI Esmalte Big Apple Red',  tipo:'salida',  cant:2,  motivo:"Venta · Ticket #1040",          ref:'tx3' },
  { id:'mv5', fecha:'14 Jun · 18:10', prod:'Kérastase Nutritive Mask',   tipo:'entrada', cant:12, motivo:"Compra · Proveedor L'Oréal",   ref:'oc88' },
  { id:'mv6', fecha:'14 Jun · 16:25', prod:'Bain Satin Shampoo 250ml',   tipo:'salida',  cant:1,  motivo:"Venta · Ticket #1038",          ref:'tx5' },
  { id:'mv7', fecha:'14 Jun · 12:00', prod:'Oxidante 20 vol 1L',         tipo:'consumo', cant:1,  motivo:"Servicio · Color (Regina T.)",  ref:'a1' },
]

export const transacciones: Transaccion[] = [
  { id:'tx1', ticket:'#1042', fecha:'15 Jun · 11:20', cliente:'Ana Sofía Beltrán', est:'e1', items:[{n:'Olaplex N°3 Hair Perfector',q:1,p:720}], total:720, pago:'Tarjeta', tipo:'producto' },
  { id:'tx2', ticket:'#1041', fecha:'15 Jun · 10:55', cliente:'Camila Núñez', est:'e1', items:[{n:'Moroccanoil Treatment 100ml',q:1,p:1240}], total:1240, pago:'Efectivo', tipo:'producto' },
  { id:'tx3', ticket:'#1040', fecha:'15 Jun · 09:40', cliente:'Valentina Ríos', est:'e4', items:[{n:'OPI Esmalte Big Apple Red',q:2,p:260}], total:520, pago:'Tarjeta', tipo:'producto' },
  { id:'tx4', ticket:'#1039', fecha:'14 Jun · 19:05', cliente:'Regina Torres', est:'e2', items:[{n:'Colorimetría completa',q:1,p:1950},{n:'Olaplex N°3 Hair Perfector',q:1,p:720}], total:2670, pago:'Tarjeta', tipo:'mixto' },
  { id:'tx5', ticket:'#1038', fecha:'14 Jun · 16:25', cliente:'Mariana del Río', est:'e4', items:[{n:'Bain Satin Shampoo 250ml',q:1,p:760}], total:760, pago:'Transferencia', tipo:'producto' },
]

export const mensajes: Mensaje[] = [
  { id:'m1', cl:'Isabela Carmona',   est:'e3', tipo:'Confirmación',  estado:'enviado',    prev:'Hola Isabela 💛 confirmamos tu cita de Botox Capilar…', t:'10:24', sin:true },
  { id:'m2', cl:'Paulina Cervantes', est:'e5', tipo:'Recordatorio',  estado:'respondido', prev:'¡Confirmado! Ahí estaré a las 2 ✨', t:'09:51', sin:false },
  { id:'m3', cl:'Daniela Esquivel',  est:'e1', tipo:'Reactivación',  estado:'entregado',  prev:'Te extrañamos en Robsen… 20% en tu regreso', t:'Ayer', sin:false },
  { id:'m4', cl:'Mariana del Río',   est:'e2', tipo:'Recordatorio',  estado:'entregado',  prev:'Recordatorio: Retoque de raíz mañana 6:00 pm', t:'Ayer', sin:true },
  { id:'m5', cl:'Sofía Carrillo',    est:'e2', tipo:'Reactivación',  estado:'enviado',    prev:'Hace tiempo no te vemos, ¿agendamos? 💇‍♀️', t:'Ayer', sin:true },
  { id:'m6', cl:'Ana Sofía Beltrán', est:'e1', tipo:'Agradecimiento',estado:'respondido', prev:'¡Mil gracias! Quedé fascinada con mi color 😍', t:'08 Jun', sin:false },
]

export const plantillas: Plantilla[] = [
  { id:'p1', nombre:'Confirmación de cita', icon:'calendar-check',  txt:'Hola {nombre} 💛 Confirmamos tu cita de {servicio} el {fecha} a las {hora} con {estilista}. Te esperamos en Robsen Salón & Spa.' },
  { id:'p2', nombre:'Recordatorio 24h',     icon:'bell',            txt:'¡Hola {nombre}! Te recordamos tu cita de {servicio} mañana a las {hora}. Responde CONFIRMO para apartar tu lugar ✨' },
  { id:'p3', nombre:'Reactivación',         icon:'sparkle',         txt:'Te extrañamos en Robsen, {nombre} 💛 Han pasado {dias} días. Regresa con 20% en tu próximo servicio. ¿Agendamos?' },
  { id:'p4', nombre:'Agradecimiento',       icon:'heart',           txt:'Gracias por visitarnos, {nombre} ✨ Fue un placer consentirte. Nos encantará verte pronto en Robsen.' },
]

export const modulos: Modulo[] = [
  { id:'dashboard', label:'Dashboard' },
  { id:'agenda',    label:'Agenda' },
  { id:'ventas',    label:'Ventas (POS)' },
  { id:'crm',       label:'Clientas (CRM)' },
  { id:'servicios', label:'Servicios' },
  { id:'productos', label:'Productos / Inventario' },
  { id:'empleados', label:'Empleados' },
  { id:'finanzas',  label:'Finanzas' },
  { id:'whatsapp',  label:'Seguimiento' },
  { id:'booking',   label:'Agendamiento' },
  { id:'ajustes',   label:'Ajustes' },
]

export const roles: Record<string, Rol> = {
  admin:     { id:'admin',     nombre:'Administrador', desc:'Acceso total al sistema',         allow:'*' },
  gerente:   { id:'gerente',   nombre:'Gerente',       desc:'Operación, finanzas y equipo',     allow:['dashboard','agenda','ventas','crm','servicios','productos','empleados','finanzas','whatsapp','ajustes'] },
  recepcion: { id:'recepcion', nombre:'Recepción',     desc:'Ventas, agenda y clientas',        allow:['dashboard','agenda','ventas','crm','servicios','productos','whatsapp','booking','ajustes'] },
  estilista: { id:'estilista', nombre:'Estilista',     desc:'Tu agenda, clientas y comisiones', allow:['dashboard','agenda','ventas','crm','ajustes'] },
}

export const usuarios: Usuario[] = [
  { id:'u1', nombre:'Roberto Benítez',  rol:'admin',     ini:'RB', color:null,      email:'roberto@robsen.com.mx',    tel:'33 3826 0774', activo:true,  ultimo:'Hoy · 08:42' },
  { id:'u2', nombre:'Lucía Fuentes',    rol:'gerente',   ini:'LF', color:'#B08AC7', email:'lucia@robsen.com.mx',      tel:'33 1188 2204', activo:true,  ultimo:'Hoy · 09:15' },
  { id:'u3', nombre:'Daniela Cortés',   rol:'recepcion', ini:'DC', color:'#C77B7B', email:'recepcion@robsen.com.mx',  tel:'33 2200 7781', activo:true,  ultimo:'Hoy · 08:05' },
  { id:'u4', nombre:'Valeria Mendoza',  rol:'estilista', ini:'VM', color:'#C8A14A', email:'valeria@robsen.com.mx',    tel:'33 3341 9920', activo:true,  ultimo:'Ayer · 19:30' },
  { id:'u5', nombre:'Renata Ochoa',     rol:'estilista', ini:'RO', color:'#93B58C', email:'renata@robsen.com.mx',     tel:'33 4419 0087', activo:false, ultimo:'10 Jun · 18:10' },
]

export const adicionales: Adicional[] = [
  { id:'ad1', nombre:'Lavado y secado express',   precio:180, cat:'Extra' },
  { id:'ad2', nombre:'Ampolleta de tratamiento',  precio:240, cat:'Extra' },
  { id:'ad3', nombre:'Peinado adicional',         precio:350, cat:'Extra' },
  { id:'ad4', nombre:'Aplicación de tinte extra', precio:280, cat:'Extra' },
  { id:'ad5', nombre:'Propina sugerida 10%',      precio:0,   cat:'Propina' },
  { id:'ad6', nombre:'Cargo por domicilio',       precio:300, cat:'Extra' },
]

export const defaultData: RBData = {
  estilistas,
  servicios,
  clientas,
  estadosCita: {
    pend: { k:'pend', label:'Pendiente' },
    conf: { k:'conf', label:'Confirmada' },
    pay:  { k:'pay',  label:'Anticipo pagado' },
    done: { k:'done', label:'Completada' },
    canc: { k:'canc', label:'Cancelada' },
  },
  hoy,
  citasFuturas: [],
  servMasVendidos: [
    { srv:'Balayage Premium',        n:38, ingreso:106400 },
    { srv:'Colorimetría completa',   n:52, ingreso:101400 },
    { srv:'Corte & Peinado',         n:96, ingreso:65280 },
    { srv:'Tratamiento de Keratina', n:24, ingreso:57600 },
    { srv:'Manicure Ruso',           n:81, ingreso:44550 },
  ],
  ventas7:   [ {d:'Lun',v:18400},{d:'Mar',v:22100},{d:'Mié',v:16800},{d:'Jue',v:27600},{d:'Vie',v:34200},{d:'Sáb',v:41800},{d:'Dom',v:12400} ],
  ventasMes: [ {d:'Ene',v:412000},{d:'Feb',v:438000},{d:'Mar',v:401000},{d:'Abr',v:472000},{d:'May',v:518000},{d:'Jun',v:486000} ],
  finanzas: { ingresosServicio:386400, ingresosProducto:99600, gastos:168200, anticipos:54800, comisiones:92300, utilidad:225500 },
  ingresosPorCategoria: [
    { cat:'Colorimetría', v:142000, c:'#C8A14A' },
    { cat:'Mechas',       v:118000, c:'#E8CE8A' },
    { cat:'Tratamientos', v:86000,  c:'#93B58C' },
    { cat:'Uñas & Spa',   v:64000,  c:'#6FA6B8' },
    { cat:'Maquillaje',   v:48000,  c:'#C77B7B' },
    { cat:'Otros',        v:27600,  c:'#B08AC7' },
  ],
  mensajes,
  plantillas,
  modulos,
  roles,
  usuarios,
  productos,
  marcas: ['Olaplex','Kérastase',"L'Oréal Pro",'Wella','Moroccanoil','OPI','Robsen'],
  transacciones,
  movimientos,
  adicionales,
  ventas,
}

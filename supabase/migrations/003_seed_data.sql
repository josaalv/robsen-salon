-- Robsen — Datos de demostración iniciales
-- Ejecutar después de 001 y 002

-- Estilistas
insert into estilistas (id, nombre, rol, color, ini, com_pct) values
('e1', 'Valeria Mendoza',  'Color & Balayage', '#C8A14A', 'VM', 35),
('e2', 'Renata Ochoa',     'Estilista Senior', '#93B58C', 'RO', 30),
('e3', 'Mariana Salgado',  'Tratamientos',     '#6FA6B8', 'MS', 32),
('e4', 'Daniela Cortés',   'Uñas & Spa',       '#C77B7B', 'DC', 25),
('e5', 'Paola Rivas',      'Maquillaje',       '#B08AC7', 'PR', 30);

-- Servicios
insert into servicios (id, nombre, cat, precio, dur, anticipo, online) values
('s1',  'Balayage Premium',         'Mechas',       2800, 180, true,  true),
('s2',  'Colorimetría completa',    'Colorimetría', 1950, 150, true,  true),
('s3',  'Retoque de raíz',          'Colorimetría', 950,  90,  false, true),
('s4',  'Corte & Peinado',          'Cortes',       680,  60,  false, true),
('s5',  'Tratamiento de Keratina',  'Tratamientos', 2400, 150, true,  true),
('s6',  'Botox Capilar',            'Tratamientos', 1600, 120, true,  true),
('s7',  'Manicure Ruso',            'Uñas',         550,  75,  false, true),
('s8',  'Pedicure Spa',             'Pedicure',     620,  75,  false, true),
('s9',  'Maquillaje Social',        'Maquillaje',   1200, 75,  true,  true),
('s10', 'Maquillaje de Novia',      'Maquillaje',   3500, 120, true,  false),
('s11', 'Extensiones de Cabello',   'Extensiones',  5400, 240, true,  false),
('s12', 'Depilación con cera',      'Depilación',   480,  45,  false, true),
('s13', 'Paquete Novia Total',      'Paquetes',     6800, 300, true,  false),
('s14', 'Paquete Glow Mensual',     'Paquetes',     2900, 180, true,  true);

-- Relación servicio ↔ estilista
insert into servicio_estilista values
('s1','e1'),('s2','e1'),('s2','e2'),('s3','e1'),('s3','e2'),
('s4','e2'),('s5','e3'),('s6','e3'),('s7','e4'),('s8','e4'),
('s9','e5'),('s10','e5'),('s11','e1'),('s12','e4'),
('s13','e5'),('s13','e1'),('s14','e2'),('s14','e3');

-- Productos
insert into productos (id, sku, nombre, marca, cat, uso, costo, precio, stock, min_stock, vendidos) values
('pr1',  'OLA-N3',   'Olaplex N°3 Hair Perfector',  'Olaplex',     'Cuidado',    'retail',  380, 720,  18, 6,  42),
('pr2',  'OLA-N0',   'Olaplex N°0 Bond Building',   'Olaplex',     'Tratamiento','interno', 520, 0,    5,  4,  0),
('pr3',  'KER-NUT',  'Kérastase Nutritive Mask',    'Kérastase',   'Cuidado',    'retail',  640, 1180, 11, 5,  23),
('pr4',  'KER-BAIN', 'Bain Satin Shampoo 250ml',    'Kérastase',   'Shampoo',    'retail',  420, 760,  3,  6,  31),
('pr5',  'LOR-MAJ7', 'Majirel Tinte 7.1 60ml',      'L''Oréal Pro','Color',      'interno', 155, 0,    24, 12, 0),
('pr6',  'LOR-OXY',  'Oxidante 20 vol 1L',          'L''Oréal Pro','Color',      'interno', 180, 0,    2,  5,  0),
('pr7',  'WEL-BLON', 'Blondor Polvo Decolorante',   'Wella',       'Color',      'interno', 640, 0,    7,  4,  0),
('pr8',  'MOR-OIL',  'Moroccanoil Treatment 100ml', 'Moroccanoil', 'Aceite',     'retail',  680, 1240, 14, 5,  38),
('pr9',  'OPI-RED',  'OPI Esmalte Big Apple Red',   'OPI',         'Uñas',       'retail',  120, 260,  22, 8,  54),
('pr10', 'OPI-BASE', 'OPI Base Coat 15ml',          'OPI',         'Uñas',       'interno', 140, 0,    9,  4,  0),
('pr11', 'RBS-TOTE', 'Robsen Tote Bag Edición',     'Robsen',      'Boutique',   'retail',  90,  320,  0,  5,  27),
('pr12', 'RBS-CAND', 'Robsen Vela Aromática',       'Robsen',      'Boutique',   'retail',  110, 290,  16, 6,  19);

-- Usuarios (email/pass se gestionan desde Supabase Auth)
insert into usuarios (nombre, email, tel, rol, ini, color, activo) values
('Roberto Benítez',  'roberto@robsen.com.mx',    '33 3826 0774', 'admin',     'RB', null,      true),
('Lucía Fuentes',    'lucia@robsen.com.mx',      '33 1188 2204', 'gerente',   'LF', '#B08AC7', true),
('Daniela Cortés',   'recepcion@robsen.com.mx',  '33 2200 7781', 'recepcion', 'DC', '#C77B7B', true),
('Valeria Mendoza',  'valeria@robsen.com.mx',    '33 3341 9920', 'estilista', 'VM', '#C8A14A', true),
('Renata Ochoa',     'renata@robsen.com.mx',     '33 4419 0087', 'estilista', 'RO', '#93B58C', false);

-- Plantillas WhatsApp
insert into plantillas_wa (nombre, icon, texto) values
('Confirmación de cita', 'calendar-check', 'Hola {nombre} 💛 Confirmamos tu cita de {servicio} el {fecha} a las {hora} con {estilista}. Te esperamos en Robsen Salón & Spa.'),
('Recordatorio 24h',     'bell',           '¡Hola {nombre}! Te recordamos tu cita de {servicio} mañana a las {hora}. Responde CONFIRMO para apartar tu lugar ✨'),
('Reactivación',         'sparkle',        'Te extrañamos en Robsen, {nombre} 💛 Han pasado {dias} días. Regresa con 20% en tu próximo servicio. ¿Agendamos?'),
('Agradecimiento',       'heart',          'Gracias por visitarnos, {nombre} ✨ Fue un placer consentirte. Nos encantará verte pronto en Robsen.');

-- Adicionales
insert into adicionales (id, nombre, precio, cat) values
('ad1', 'Lavado y secado express',   180, 'Extra'),
('ad2', 'Ampolleta de tratamiento',  240, 'Extra'),
('ad3', 'Peinado adicional',         350, 'Extra'),
('ad4', 'Aplicación de tinte extra', 280, 'Extra'),
('ad5', 'Propina sugerida 10%',      0,   'Propina'),
('ad6', 'Cargo por domicilio',       300, 'Extra');

export type EstadoCita = 'pend' | 'conf' | 'pay' | 'done' | 'canc' | 'no_asistio'
export type EstadoClienta = 'VIP' | 'Frecuente' | 'Activa' | 'Nueva' | 'Inactiva'
export type RolUsuario = 'admin' | 'gerente' | 'recepcion' | 'estilista'
export type UsoProducto = 'retail' | 'interno'
export type TipoLinea = 'servicio' | 'producto' | 'adicional'
export type EstadoVenta = 'pagada' | 'parcial' | 'pendiente' | 'apartado'
export type TipoMovimiento = 'entrada' | 'salida' | 'consumo'
export type EstadoMensaje = 'enviado' | 'entregado' | 'respondido'

export interface Estilista {
  id: string
  nombre: string
  rol: string
  color: string
  ini: string
  com?: number
  comisiones?: Record<string, number>  // excepción puntual por servicio: { [servicioId]: pct } — si falta, se usa `com`
  horarios?: boolean[]  // [Lun,Mar,Mié,Jue,Vie,Sáb,Dom]
  foto?: string
  bio?: string
}

export interface Servicio {
  id: string
  nombre: string
  cat: string
  precio: number
  dur: number
  anticipo: boolean
  online: boolean
  prof: string[]
  descripcion?: string
  precioVisible?: boolean   // mostrar precio en sitio de agendamiento
  precioVariable?: boolean  // precio/duración variable, consultar
  domicilio?: boolean       // servicio a domicilio disponible
  activo?: boolean          // false = no aparece para nuevas citas/ventas, sigue en historial
}

export interface FotoEntry {
  id: string
  antes: string
  despues: string
  fecha: string
  nota: string
}

export interface Clienta {
  id: string
  nombre: string
  tel: string
  email?: string
  estado: EstadoClienta
  ultima: string
  ticket: number
  fav: string
  est: string
  visitas: number
  gasto: number
  ini: string
  cumple: string
  ciclo: number
  notas?: string
  formulas?: { id: string; fecha: string; srv: string; formula: string; editadoEl?: string }[]
  fotos?: FotoEntry[]
}

// Un servicio dentro de una cita. Una cita puede tener varios (ej. maquillaje +
// peinado); la duración y el precio de la cita son la suma de todos.
export interface CitaServicio {
  servicioId: string
  nombre: string
  precio: number
  dur: number
}

export interface Cita {
  id: string
  h: string
  dur: number          // suma de la duración de todos los servicios
  cl: string
  clienteId?: string
  tel?: string
  email?: string
  srv: string          // resumen: nombres de los servicios unidos con " + "
  servicioId?: string  // primer servicio (retrocompat / comisión)
  servicios?: CitaServicio[]  // detalle; si falta, la cita es de un solo servicio
  est: string
  estado: EstadoCita
  total: number        // suma del precio de todos los servicios
  ant: number
  notas?: string
  fecha?: string  // 'YYYY-MM-DD' — undefined significa hoy
}

export interface LineaVenta {
  tipo: TipoLinea
  nombre: string
  productoId?: string
  est: string | null
  cant: number
  precio: number
  com: number
}

export interface Venta {
  id: string
  ticket: string
  fecha: string
  cliente: string
  clienteId: string
  pago: string
  estado: EstadoVenta
  desc: number
  anticipo: number
  lineas: LineaVenta[]
  citaId?: string
  saldoCobradoEn?: string
  saldoCobradoMonto?: number
}

export interface CierreCaja {
  id: string
  fecha: string
  usuarioId?: string
  usuarioNombre: string
  totalEfectivo: number
  totalTransferencia: number
  totalTarjeta: number
  totalPendiente: number
  anticiposCobrados: number
  saldosCobrados: number
  ventasTotal: number
  efectivoContado: number
  diferencia: number
  notas?: string
  cerradoEn: string
}

export interface Producto {
  id: string
  sku: string
  nombre: string
  marca: string
  cat: string
  uso: UsoProducto
  costo: number
  precio: number
  stock: number
  min: number
  vendidos: number
}

export interface Movimiento {
  id: string
  fecha: string
  prod: string
  tipo: TipoMovimiento
  cant: number
  motivo: string
  ref: string
}

export interface Transaccion {
  id: string
  ticket: string
  fecha: string
  cliente: string
  est: string
  items: { n: string; q: number; p: number }[]
  total: number
  pago: string
  tipo: 'producto' | 'mixto'
}

export interface Mensaje {
  id: string
  cl: string
  est: string
  tipo: string
  estado: EstadoMensaje
  prev: string
  t: string
  sin: boolean
}

export interface Plantilla {
  id: string
  nombre: string
  icon: string
  txt: string
}

export interface Usuario {
  id: string
  nombre: string
  rol: RolUsuario
  ini: string
  color: string | null
  email: string
  tel: string
  activo: boolean
  ultimo: string
  avatar?: string
  estilistaId?: string
  authUserId?: string
}

export interface Rol {
  id: string
  nombre: string
  desc: string
  allow: string[] | '*'
}

export interface Modulo {
  id: string
  label: string
}

export interface Adicional {
  id: string
  nombre: string
  precio: number
  cat: string
}

export interface Bloqueo {
  id: string
  est: string
  h: string
  fin: string
  nota: string
  fecha?: string  // 'YYYY-MM-DD' — undefined = todos los días
}

export interface Gasto {
  id: string
  concepto: string
  monto: number
  fecha: string   // 'YYYY-MM-DD'
  categoria: string
}

export interface NavItem {
  id: string
  label: string
  icon: string
  title: string
  sub: string
  badge?: number
}

export interface NavGroup {
  grupo: string
  items: NavItem[]
}

export type SlotMinutos = 15 | 30 | 60

export interface SalonConfig {
  agendaStart: number
  agendaEnd: number
  slotMin: SlotMinutos
  diasAbiertos: [boolean, boolean, boolean, boolean, boolean, boolean, boolean]  // Lun-Dom

  nombre: string
  direccion: string
  tel: string
  whatsapp: string

  anticipoPct: number
  requerirAnticipo: boolean
  iva: 0 | 16
  metodospago: { efectivo: boolean; tarjeta: boolean; transferencia: boolean; credito: boolean }

  acento: string

  comisiones: Record<string, number>
  escalaComisiones: { limite: number | null; pct: number }[]

  logo?: string

  notifs: {
    citas: boolean
    recordatorios: boolean
    anticipos: boolean
    stock: boolean
    inactivas: boolean
    cumples: boolean
  }
}

export interface RBData {
  config: SalonConfig
  estilistas: Estilista[]
  servicios: Servicio[]
  clientas: Clienta[]
  estadosCita: Record<string, { k: string; label: string }>
  hoy: Cita[]
  citasFuturas: Cita[]
  servMasVendidos: { srv: string; n: number; ingreso: number }[]
  ventas7: { d: string; v: number }[]
  ventasMes: { d: string; v: number }[]
  finanzas: {
    ingresosServicio: number
    ingresosProducto: number
    gastos: number
    anticipos: number
    comisiones: number
    utilidad: number
  }
  ingresosPorCategoria: { cat: string; v: number; c: string }[]
  mensajes: Mensaje[]
  plantillas: Plantilla[]
  modulos: Modulo[]
  roles: Record<string, Rol>
  usuarios: Usuario[]
  productos: Producto[]
  marcas: string[]
  transacciones: Transaccion[]
  movimientos: Movimiento[]
  adicionales: Adicional[]
  ventas: Venta[]
  bloqueos: Bloqueo[]
  gastos: Gasto[]
}

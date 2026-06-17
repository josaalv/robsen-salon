export type EstadoCita = 'pend' | 'conf' | 'pay' | 'done' | 'canc'
export type EstadoClienta = 'VIP' | 'Frecuente' | 'Activa' | 'Nueva' | 'Inactiva'
export type RolUsuario = 'admin' | 'gerente' | 'recepcion' | 'estilista'
export type UsoProducto = 'retail' | 'interno'
export type TipoLinea = 'servicio' | 'producto' | 'adicional'
export type EstadoVenta = 'pagada' | 'parcial' | 'pendiente'
export type TipoMovimiento = 'entrada' | 'salida' | 'consumo'
export type EstadoMensaje = 'enviado' | 'entregado' | 'respondido'

export interface Estilista {
  id: string
  nombre: string
  rol: string
  color: string
  ini: string
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
}

export interface Clienta {
  id: string
  nombre: string
  tel: string
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
}

export interface Cita {
  id: string
  h: string
  dur: number
  cl: string
  clienteId?: string
  srv: string
  servicioId?: string
  est: string
  estado: EstadoCita
  total: number
  ant: number
  notas?: string
}

export interface LineaVenta {
  tipo: TipoLinea
  nombre: string
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

export interface RBData {
  estilistas: Estilista[]
  servicios: Servicio[]
  clientas: Clienta[]
  estadosCita: Record<string, { k: string; label: string }>
  hoy: Cita[]
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
}

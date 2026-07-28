import type { Venta, SalonConfig, Rol } from '../types'

// ─── Permisos de módulos por rol ─────────────────────────────────────────────
// Fuente única de verdad para "qué módulos ve cada rol". El admin siempre tiene
// acceso total. Para el resto, si el administrador configuró permisos a medida
// (config.permisos) se usan esos; si no, el permiso por defecto del rol.
export const rolAllow = (
  roleId: string,
  config: Pick<SalonConfig, 'permisos'>,
  roles: Record<string, Rol>,
): string[] | '*' => {
  if (roleId === 'admin') return '*'
  const custom = config.permisos?.[roleId]
  if (Array.isArray(custom)) return custom
  const base = roles[roleId]?.allow
  return base === '*' ? '*' : (base ?? [])
}

export const rolPuede = (
  roleId: string,
  moduloId: string,
  config: Pick<SalonConfig, 'permisos'>,
  roles: Record<string, Rol>,
): boolean => {
  const a = rolAllow(roleId, config, roles)
  return a === '*' || a.includes(moduloId)
}

const MES: Record<string, number> = { Ene:0,Feb:1,Mar:2,Abr:3,May:4,Jun:5,Jul:6,Ago:7,Sep:8,Oct:9,Nov:10,Dic:11 }
const MESN = Object.keys(MES)
const HOY = new Date()
const DIA = 86400000

export const mxn = (n: number) => '$' + Number(n).toLocaleString('es-MX')
export const mxn0 = (n: number) => Number(n).toLocaleString('es-MX')

// Formatea un teléfono a dígitos "33 1234 5678" (10 dígitos locales) para mostrar.
export const formatTel = (t: string): string => {
  const d = (t || '').replace(/\D/g, '')
  const local = d.length > 10 ? d.slice(-10) : d
  if (local.length !== 10) return t || ''
  return `${local.slice(0, 2)} ${local.slice(2, 6)} ${local.slice(6)}`
}

// Descarga un CSV desde filas (compatible con Excel: BOM + comillas).
export const descargarCSV = (nombre: string, filas: (string | number)[][]): void => {
  const esc = (v: string | number) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = '﻿' + filas.map(f => f.map(esc).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre.endsWith('.csv') ? nombre : nombre + '.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// Teléfono: acepta con o sin código de país (52) y con o sin el 1 de
// celular (521…), siempre y cuando el número local (con lada) sean 10 dígitos.
export const normalizarTel = (t: string): string => (t || '').replace(/\D/g, '')

// Filtra lo que se escribe en los campos de teléfono: solo dígitos, espacios
// y un "+" inicial (para formatos tipo "+52 33 1234 5678"). Bloquea letras.
export const filtrarTel = (t: string): string => (t || '').replace(/[^\d\s+]/g, '')

export const telefonoValido = (t: string): boolean => {
  let d = normalizarTel(t)
  if (d.length === 13 && d.startsWith('521')) d = d.slice(3)
  else if (d.length === 12 && d.startsWith('52')) d = d.slice(2)
  return d.length === 10
}

export const telefonoError = (t: string): string =>
  !t.trim() || telefonoValido(t) ? '' : 'Ingresa un teléfono a 10 dígitos con lada, ej. 33 1234 5678'

type ComisionOverride = { tipo: 'porcentaje' | 'monto'; valor: number }
type EstilistaCom = { id: string; com?: number; comisiones?: Record<string, number | ComisionOverride> }

// Comisión resuelta para un servicio de un estilista: un porcentaje sobre el
// precio, o un monto fijo por unidad.
export type ComisionResuelta = { tipo: 'porcentaje'; pct: number } | { tipo: 'monto'; monto: number }

// Resuelve la comisión de un servicio para un estilista. La base es del empleado
// (estilista.com, siempre %); estilista.comisiones permite una excepción por
// servicio que puede ser porcentaje o monto fijo.
export const resolverComision = (
  servicioId: string,
  estId: string | null | undefined,
  estilistas: EstilistaCom[]
): ComisionResuelta => {
  const est = estilistas.find(e => e.id === estId)
  const ov = est?.comisiones?.[servicioId]
  if (ov != null) {
    if (typeof ov === 'number') return { tipo: 'porcentaje', pct: ov }
    if (ov.tipo === 'monto') return { tipo: 'monto', monto: ov.valor }
    return { tipo: 'porcentaje', pct: ov.valor }
  }
  return { tipo: 'porcentaje', pct: est?.com ?? 30 }
}

// Compatibilidad: sigue devolviendo un % (para lugares que solo manejan %).
// Si la comisión resuelta es de monto fijo, aquí se reporta 0% (el monto viaja
// aparte en la línea de venta).
export const comisionServicioEstilista = (
  servicioId: string,
  estId: string | null | undefined,
  estilistas: EstilistaCom[]
): number => {
  const r = resolverComision(servicioId, estId, estilistas)
  return r.tipo === 'porcentaje' ? r.pct : 0
}

export type EscalaTramo = { limite: number | null; pct: number }

// Calcula comisión progresiva por tramos (tipo brackets fiscales).
// Cada tramo aplica su % solo a la porción de ventas dentro de ese rango.
export const applyEscala = (totalVentas: number, escala: EscalaTramo[]): number => {
  if (!escala || escala.length === 0 || totalVentas <= 0) return 0
  const sorted = [...escala].sort((a, b) => (a.limite ?? Infinity) - (b.limite ?? Infinity))
  let comision = 0
  let prev = 0
  for (const tramo of sorted) {
    if (totalVentas <= prev) break
    const lim = tramo.limite ?? Infinity
    const enTramo = Math.min(totalVentas, lim) - prev
    comision += Math.round(enTramo * tramo.pct / 100)
    prev = lim
  }
  return comision
}

const parseDate = (s: string): Date => {
  const p = s.split(' ')
  return new Date(+p[2], MES[p[1]], +p[0])
}
const fmtDate = (dt: Date) => dt.getDate() + ' ' + MESN[dt.getMonth()] + ' ' + dt.getFullYear()

export const helpers = {
  HOY,
  diasDesde: (s: string) => Math.round((HOY.getTime() - parseDate(s).getTime()) / DIA),
  proxVisita: (ultima: string, semanas: number) => {
    const dt = parseDate(ultima)
    dt.setDate(dt.getDate() + semanas * 7)
    return dt
  },
  fmtFecha: fmtDate,
  diasACumple: (cumple: string) => {
    const p = cumple.split(' ')
    let dt = new Date(HOY.getFullYear(), MES[p[1]], +p[0])
    if (dt < HOY) dt = new Date(HOY.getFullYear() + 1, MES[p[1]], +p[0])
    return Math.round((dt.getTime() - HOY.getTime()) / DIA)
  },
  insights: (c: { ultima: string; ciclo?: number; estado: string; cumple?: string }) => {
    const dias = Math.round((HOY.getTime() - parseDate(c.ultima).getTime()) / DIA)
    const cicloD = (c.ciclo || 8) * 7
    let recompra = 'aldia'
    if (dias > cicloD + 14) recompra = 'atrasada'
    else if (dias >= cicloD - 7) recompra = 'toca'
    let riesgo = 'sana'
    if (c.estado === 'Inactiva' || dias > 90) riesgo = 'fuga'
    else if (dias > cicloD + 14) riesgo = 'riesgo'
    const prox = helpers.proxVisita(c.ultima, c.ciclo || 8)
    return {
      dias, cicloD, recompra, riesgo, prox,
      proxStr: prox.getDate() + ' ' + MESN[prox.getMonth()],
      cumpleDias: helpers.diasACumple(c.cumple || '01 Ene'),
    }
  },
}

// Timestamp real de una venta (ms): de created_at, o del id ('v'+epoch) como
// respaldo. Base para filtros de fecha reales — evita el bug de comparar
// solo el texto "DD Mon" sin año.
export const ventaTS = (v: Venta): number | null => {
  if (v.createdAt) { const t = Date.parse(v.createdAt); if (!isNaN(t)) return t }
  const m = /^v(\d{13})$/.exec(v.id || '')
  return m ? Number(m[1]) : null
}

export const ventaCalc = {
  subtotal: (v: Venta) => v.lineas.reduce((s, l) => s + l.precio * l.cant, 0),
  total: (v: Venta) => ventaCalc.subtotal(v) - (v.desc || 0),
  saldo: (v: Venta) => Math.max(0, ventaCalc.total(v) - (v.anticipo || 0)),
  comision: (v: Venta) => {
    const sub = ventaCalc.subtotal(v)
    const ratio = sub > 0 ? (sub - (v.desc || 0)) / sub : 1
    return v.lineas.reduce((s, l) => s + (
      l.comMonto != null
        ? Math.round(l.comMonto * l.cant)                       // monto fijo por unidad
        : Math.round(l.precio * l.cant * ratio * (l.com || 0) / 100)  // porcentaje
    ), 0)
  },
  porTipo: (v: Venta, tipo: string) => v.lineas.filter(l => l.tipo === tipo).reduce((s, l) => s + l.precio * l.cant, 0),
}

// Reparte un `monto` de una venta entre sus métodos de pago. Si el cobro fue
// mixto usa el desglose guardado (escalado proporcionalmente por si `monto` es
// sólo una parte, p. ej. un anticipo); si no, todo va al método único de la venta.
export const desglosePagos = (v: Venta, monto: number): { metodo: string; monto: number }[] => {
  if (v.pagos && v.pagos.length) {
    const suma = v.pagos.reduce((s, p) => s + (p.monto || 0), 0)
    if (suma > 0 && Math.abs(suma - monto) >= 1) {
      return v.pagos.map(p => ({ metodo: p.metodo, monto: Math.round((p.monto || 0) * monto / suma) }))
    }
    return v.pagos.map(p => ({ metodo: p.metodo, monto: p.monto || 0 }))
  }
  return [{ metodo: v.pago, monto }]
}

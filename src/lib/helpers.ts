import type { Venta } from '../types'

const MES: Record<string, number> = { Ene:0,Feb:1,Mar:2,Abr:3,May:4,Jun:5,Jul:6,Ago:7,Sep:8,Oct:9,Nov:10,Dic:11 }
const MESN = Object.keys(MES)
const HOY = new Date()
const DIA = 86400000

export const mxn = (n: number) => '$' + Number(n).toLocaleString('es-MX')
export const mxn0 = (n: number) => Number(n).toLocaleString('es-MX')

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

export const ventaCalc = {
  subtotal: (v: Venta) => v.lineas.reduce((s, l) => s + l.precio * l.cant, 0),
  total: (v: Venta) => ventaCalc.subtotal(v) - (v.desc || 0),
  saldo: (v: Venta) => Math.max(0, ventaCalc.total(v) - (v.anticipo || 0)),
  comision: (v: Venta) => {
    const sub = ventaCalc.subtotal(v)
    const ratio = sub > 0 ? (sub - (v.desc || 0)) / sub : 1
    return v.lineas.reduce((s, l) => s + Math.round(l.precio * l.cant * ratio * (l.com || 0) / 100), 0)
  },
  porTipo: (v: Venta, tipo: string) => v.lineas.filter(l => l.tipo === tipo).reduce((s, l) => s + l.precio * l.cant, 0),
}

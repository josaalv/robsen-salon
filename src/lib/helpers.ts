import type { Venta } from '../types'

const MES: Record<string, number> = { Ene:0,Feb:1,Mar:2,Abr:3,May:4,Jun:5,Jul:6,Ago:7,Sep:8,Oct:9,Nov:10,Dic:11 }
const MESN = Object.keys(MES)
const HOY = new Date()
const DIA = 86400000

export const mxn = (n: number) => '$' + Number(n).toLocaleString('es-MX')
export const mxn0 = (n: number) => Number(n).toLocaleString('es-MX')

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
      dias, cicloD, recompra, riesgo, prox, proxStr: fmtDate(prox),
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

import type { WaMensaje } from '../../types'

export const VENTANA_24H_MS = 24 * 60 * 60 * 1000
export const norm10 = (t: string) => (t || '').replace(/\D/g, '').slice(-10)

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const HOY = new Date()
export const MESES: Record<string, number> = { Ene:0,Feb:1,Mar:2,Abr:3,May:4,Jun:5,Jul:6,Ago:7,Sep:8,Oct:9,Nov:10,Dic:11 }

export function diasDesde(ultima: string): number {
  const [d, mes, y] = ultima.split(' ')
  if (!y) return 999
  return Math.floor((HOY.getTime() - new Date(+y, MESES[mes] ?? 0, +d).getTime()) / 86400000)
}

export function diasCumple(cumple: string): number {
  const [d, mes] = cumple.split(' ')
  let f = new Date(HOY.getFullYear(), MESES[mes] ?? 0, +d)
  if (f < HOY) f = new Date(HOY.getFullYear() + 1, MESES[mes] ?? 0, +d)
  return Math.round((f.getTime() - HOY.getTime()) / 86400000)
}

export function waUrl(tel: string, msg: string) {
  const n = tel.replace(/\D/g, '')
  return `https://wa.me/${n.startsWith('52') ? n : '52' + n}?text=${encodeURIComponent(msg)}`
}

export const CAT_SEC: Record<string, string> = {
  Mechas:'mechas', Extensiones:'mechas',
  'Colorimetría':'color',
  Tratamientos:'tratamiento',
  'Uñas':'unas', Pedicure:'unas',
  Cortes:'cortes',
  Maquillaje:'maquillaje', Depilación:'maquillaje', Paquetes:'maquillaje',
}

export interface Item {
  id: string; nombre: string; tel: string; ini: string
  contexto: string; sub?: string; urgencia: 'alta'|'media'|'baja'; msg: string
  automatico?: WaMensaje
}

// Secciones con equivalente automático (manana→recordatorio_24h,
// cumples→cumpleanos, inactivas→reactivacion): si ya existe un wa_mensajes
// para esa clienta/cita, se muestra su estado real en vez de dejar que el
// admin le escriba a ciegas por encima de lo que el sistema ya hizo.
export const AUTO_CONTACTADO: WaMensaje['estado'][] = ['enviado', 'entregado', 'leido', 'respondido']

export const URGCOLOR = { alta:'var(--st-canc)', media:'var(--st-pend)', baja:'var(--text-3)' }

// ─── Sections config ──────────────────────────────────────────────────────────
export const SECS = [
  { id:'hoy_pend',    label:'Sin confirmar hoy',   icon:'warning-circle', group:'URGENTE'      },
  { id:'cobros',      label:'Cobros pendientes',    icon:'hand-coins',     group:'URGENTE'      },
  { id:'manana',      label:'Recordatorios mañana', icon:'calendar-check', group:'HOY'          },
  { id:'post_visita', label:'Post-visita',          icon:'heart',          group:'HOY'          },
  { id:'mechas',      label:'Mechas & Balayage',    icon:'sparkle',        group:'REACTIVACIÓN' },
  { id:'color',       label:'Colorimetría & Raíz',  icon:'drop',           group:'REACTIVACIÓN' },
  { id:'tratamiento', label:'Tratamientos',         icon:'leaf',           group:'REACTIVACIÓN' },
  { id:'unas',        label:'Uñas & Manicure',      icon:'paint-brush',    group:'REACTIVACIÓN' },
  { id:'cortes',      label:'Cortes',               icon:'scissors',       group:'REACTIVACIÓN' },
  { id:'maquillaje',  label:'Maquillaje & Spa',     icon:'star',           group:'REACTIVACIÓN' },
  { id:'cumples',     label:'Cumpleaños',           icon:'gift',           group:'FIDELIZACIÓN' },
  { id:'nuevas',      label:'Clientas nuevas',      icon:'user-plus',      group:'FIDELIZACIÓN' },
  { id:'inactivas',   label:'Inactivas +60 días',   icon:'user-minus',     group:'FIDELIZACIÓN' },
]

export const EST_META: Record<string, { label: string; color: string }> = {
  aprobada:  { label: 'Aprobada', color: 'var(--st-conf)' },
  pendiente: { label: 'En revisión', color: 'var(--st-pend)' },
  rechazada: { label: 'Rechazada', color: 'var(--st-canc)' },
  borrador:  { label: 'Borrador', color: 'var(--text-3)' },
}
export const EST_MSG: Record<string, { label: string; color: string }> = {
  pendiente_aprobacion: { label: 'Por aprobar',   color: 'var(--st-pend)' },
  aprobado:             { label: 'Listo',          color: 'var(--gold)' },
  enviando:             { label: 'Enviando',       color: 'var(--gold)' },
  enviado:              { label: 'Enviado',        color: 'var(--st-conf)' },
  entregado:            { label: 'Entregado ✓✓',   color: 'var(--st-conf)' },
  leido:                { label: 'Leído',          color: 'var(--st-conf)' },
  respondido:           { label: 'Respondió',      color: 'var(--gold)' },
  fallido:              { label: 'Falló',          color: 'var(--st-canc)' },
  cancelado:            { label: 'Cancelado',      color: 'var(--text-3)' },
}
export const FLUJO_LABEL: Record<string, string> = {
  confirmacion: 'Confirmación', recordatorio_24h: 'Recordatorio', post_visita: 'Post-visita',
  cumpleanos: 'Cumpleaños', bienvenida: 'Bienvenida', reactivacion: 'Reactivación',
}

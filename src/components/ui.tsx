import React, { useState, useEffect, useRef } from 'react'
import { mxn, mxn0 } from '../lib/helpers'

/* ---- Teclado y foco para modales de alta (Esc / Enter / autofoco / trap) ---- */
export function useModalKeys(
  ref: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  onEnter?: () => void,
) {
  // Refs para no capturar closures viejos (los handlers leen estado actual).
  const cbs = useRef({ onClose, onEnter })
  cbs.current = { onClose, onEnter }
  useEffect(() => {
    // Autofoco al primer campo del modal.
    const box = ref.current
    if (box) {
      const first = box.querySelector<HTMLElement>('[data-autofocus], input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])')
      first?.focus()
    }
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); cbs.current.onClose(); return }
      if (e.key === 'Enter' && cbs.current.onEnter) {
        const t = e.target as HTMLElement
        const tag = t.tagName
        // No dispares al escribir en textarea, elegir en select o sobre un botón.
        if (tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return
        e.preventDefault(); cbs.current.onEnter()
        return
      }
      if (e.key === 'Tab' && ref.current) {
        const nodes = ref.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
        const list = Array.from(nodes).filter(n => n.offsetParent !== null)
        if (!list.length) return
        const firstEl = list[0], lastEl = list[list.length - 1]
        const active = document.activeElement as HTMLElement
        if (e.shiftKey && active === firstEl) { e.preventDefault(); lastEl.focus() }
        else if (!e.shiftKey && active === lastEl) { e.preventDefault(); firstEl.focus() }
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

/* ---- Phosphor Icons (via npm package) ---- */
export { PhosphorIcon as Ic } from './PhosphorIcon'

/* ---- Avatar ---- */
interface AvatarProps { ini: string; color?: string | null; size?: 'sm' | 'lg'; src?: string | null }
export function Avatar({ ini, color, size, src }: AvatarProps) {
  const cls = 'avatar' + (size ? ' ' + size : '')
  if (src) return <img src={src} alt={ini} className={cls} style={{ objectFit: 'cover', borderRadius: '50%' }} />
  const style = color ? { background: color, color: '#1a1410' } : undefined
  return <div className={cls} style={style}>{ini}</div>
}

/* ---- Badge estado de cita ---- */
const ESTADO_LABELS: Record<string, string> = {
  pend: 'Pendiente', conf: 'Confirmada', pay: 'Anticipo pagado', done: 'Completada', canc: 'Cancelada', no_asistio: 'No asistió'
}
export function EstadoBadge({ k }: { k: string }) {
  const label = ESTADO_LABELS[k] || k
  return <span className={`badge ${k}`}><span className="d"></span>{label}</span>
}

/* ---- Badge estado de clienta ---- */
export function ClienteBadge({ estado }: { estado: string }) {
  const map: Record<string, string> = { VIP:'vip', Frecuente:'frec', Activa:'conf', Nueva:'new', Inactiva:'canc' }
  return (
    <span className={`badge ${map[estado] || 'neutral'}`}>
      {estado === 'VIP' && <span style={{ fontSize: 11 }}>♓ </span>}
      {estado}
    </span>
  )
}

/* ---- Stat / KPI card ---- */
interface StatProps {
  icon: React.ReactNode
  label: string
  value: string | number
  unit?: string
  delta?: string
  deltaDir?: 'up' | 'down'
  spark?: number[]
  sparkColor?: string
}
export function Stat({ icon, label, value, unit, delta, deltaDir, spark, sparkColor }: StatProps) {
  return (
    <div className="card stat">
      <div className="ico">{icon}</div>
      <div className="label">{label}</div>
      <div className="value">{value}{unit && <small> {unit}</small>}</div>
      {delta != null && deltaDir && (
        <div className={`delta ${deltaDir}`}>
          {deltaDir === 'up' ? '↑' : '↓'} {delta}
        </div>
      )}
      {spark && <div className="spark"><Sparkline data={spark} color={sparkColor} /></div>}
    </div>
  )
}

/* ---- Sparkline ---- */
export function Sparkline({ data, color = '#C8A14A', w = 86, h = 34 }: { data: number[]; color?: string; w?: number; h?: number }) {
  const max = Math.max(...data), min = Math.min(...data)
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / (max - min || 1)) * (h - 4) - 2
    return [x, y]
  })
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const area = d + ` L${w} ${h} L0 ${h} Z`
  const gid = 'sg' + Math.round(Math.random() * 1e6)
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.6" fill={color} />
    </svg>
  )
}

/* ---- Bar chart ---- */
export function BarChart({ data, h = 200, highlightLast }: { data: { d: string; v: number }[]; h?: number; highlightLast?: boolean }) {
  const max = Math.max(...data.map(d => d.v))
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:14, height:h, padding:'8px 2px 0' }}>
      {data.map((d, i) => {
        const pct = (d.v / max) * 100
        const hot = highlightLast && i === data.length - 1
        return (
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:8, height:'100%', justifyContent:'flex-end' }}>
            <div className="num" style={{ fontSize:11, color: hot ? 'var(--gold)' : 'var(--text-3)', fontWeight:600 }}>{mxn0(d.v)}</div>
            <div style={{
              width:'100%', maxWidth:46, height:pct+'%', borderRadius:'7px 7px 3px 3px',
              background: hot ? 'var(--gold-grad)' : 'linear-gradient(180deg, #3a2f1f, #221c14)',
              border: '1px solid ' + (hot ? 'transparent' : 'var(--line-soft)'),
              transition: 'height .5s cubic-bezier(.2,.8,.2,1)'
            }}></div>
            <div style={{ fontSize:11.5, color:'var(--text-3)', fontWeight:600 }}>{d.d}</div>
          </div>
        )
      })}
    </div>
  )
}

/* ---- Donut chart ---- */
export function Donut({ data, size = 168, thick = 22 }: { data: { cat: string; v: number; c: string }[]; size?: number; thick?: number }) {
  const total = data.reduce((s, d) => s + d.v, 0)
  const r = (size - thick) / 2, c = 2 * Math.PI * r
  let acc = 0
  return (
    <div style={{ display:'flex', alignItems:'center', gap:26 }}>
      <svg width={size} height={size} style={{ flex:`0 0 ${size}px` }}>
        <g transform={`translate(${size/2},${size/2}) rotate(-90)`}>
          <circle r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={thick} />
          {data.map((d, i) => {
            const len = (d.v / total) * c
            const seg = (
              <circle key={i} r={r} fill="none" stroke={d.c} strokeWidth={thick}
                strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} strokeLinecap="butt" />
            )
            acc += len
            return seg
          })}
        </g>
        <text x="50%" y="46%" textAnchor="middle" fill="var(--text-3)" fontSize="11" fontFamily="var(--sans)" style={{ textTransform:'uppercase', letterSpacing:'.08em' }}>Total</text>
        <text x="50%" y="58%" textAnchor="middle" fill="var(--text)" fontSize="20" fontFamily="var(--serif)" fontWeight="600">{mxn0(total)}</text>
      </svg>
      <div style={{ display:'flex', flexDirection:'column', gap:11, flex:1 }}>
        {data.map((d, i) => (
          <div key={i} className="legend between">
            <span className="vc"><span className="k" style={{ background:d.c }}></span>{d.cat}</span>
            <span className="num" style={{ color:'var(--text)', fontWeight:600 }}>{mxn(d.v)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---- Segmented control ---- */
export function Seg({ opts, value, onChange }: { opts: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="seg">
      {opts.map(o => (
        <button key={o} className={value === o ? 'active' : ''} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  )
}

/* ---- Switch ---- */
export function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <div className={'switch' + (on ? ' on' : '')} onClick={onClick}></div>
}

/* ---- Card head ---- */
export function CardHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="card-head">
      <div><h3>{title}</h3>{sub && <div className="sub">{sub}</div>}</div>
      {right}
    </div>
  )
}

/* ===== Toast ===== */
interface ToastItem { id: number; msg: string; icon?: string }
let toastListeners = new Set<(t: ToastItem) => void>()
export const toast = (msg: string) => {
  const t: ToastItem = { id: Date.now() + Math.random(), msg }
  toastListeners.forEach(f => f(t))
}
export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([])
  useEffect(() => {
    const handler = (t: ToastItem) => {
      setItems(x => [...x, t])
      setTimeout(() => setItems(x => x.filter(i => i.id !== t.id)), 2800)
    }
    toastListeners.add(handler)
    return () => { toastListeners.delete(handler) }
  }, [])
  return (
    <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:200, display:'flex', flexDirection:'column', gap:10, alignItems:'center', pointerEvents:'none' }}>
      {items.map(t => (
        <div key={t.id} className="card gold-edge" style={{ display:'flex', alignItems:'center', gap:11, padding:'12px 18px', boxShadow:'var(--sh-lg)', animation:'pop .25s ease' }}>
          <span style={{ color:'var(--gold)' }}>✓</span>
          <span style={{ fontWeight:600, fontSize:13.5 }}>{t.msg}</span>
        </div>
      ))}
    </div>
  )
}

/* ---- Modal wrapper ---- */
export function Modal({ onClose, children, width = 560, onEnter }: { onClose: () => void; children: React.ReactNode; width?: number; onEnter?: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useModalKeys(ref, onClose, onEnter)   // Esc cierra, autofoco al primer campo, foco atrapado, Enter guarda (si onEnter)
  return (
    <div className="rb-modal-bg" onClick={onClose}>
      <div ref={ref} className="card gold-edge rb-modal" style={{ width, maxWidth:'calc(100vw - 48px)', maxHeight:'90vh', overflowY:'auto', animation:'pop .26s cubic-bezier(.2,.8,.2,1)' }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

export function ConfirmModal({ title, desc, onConfirm, onCancel, danger = true }: {
  title: string
  desc?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onCancel])
  return (
    <div className="rb-modal-bg" onClick={onCancel}>
      <div className="card gold-edge rb-modal" style={{ width: 400, maxWidth: 'calc(100vw - 48px)', animation: 'pop .2s cubic-bezier(.2,.8,.2,1)' }} onClick={e => e.stopPropagation()}>
        <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 22, fontFamily: 'var(--serif)', fontWeight: 600 }}>{title}</div>
          {desc && <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.5 }}>{desc}</div>}
          <div className="vc gap10" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn ghost" onClick={onCancel}>Cancelar</button>
            <button className={`btn ${danger ? 'danger' : 'gold'}`} onClick={onConfirm}>Confirmar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

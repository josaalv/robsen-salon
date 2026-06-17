import React, { useState, useEffect } from 'react'
import { Avatar, EstadoBadge, Seg, toast } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { useStore } from '../data/store'
import { mxn } from '../lib/helpers'
import type { Cita, EstadoCita } from '../types'

const PXH = 60
const DIAS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DIAS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function makeSlots(start: number, end: number, step: number): string[] {
  const count = Math.round((end - start) * 60 / step)
  return Array.from({ length: count }, (_, i) => {
    const total = start * 60 + i * step
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  })
}

function toMin(hhmm: string) {
  const [h, m] = (hhmm || '0:0').split(':').map(Number)
  return h * 60 + m
}

function snapSlot(hhmm: string, start: number, end: number, step: number): string {
  const total = Math.round(toMin(hhmm || '10:00') / step) * step
  const clamped = Math.min(Math.max(total, start * 60), (end - 1) * 60 + (60 - step))
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`
}

function top(hhmm: string, start: number): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h - start + m / 60) * PXH
}

function dateToIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Bloqueo {
  id: string
  est: string
  h: string
  fin: string
  nota: string
  fecha?: string  // 'YYYY-MM-DD' — undefined = todos los días
}

// ─── Modal nueva/editar cita ────────────────────────────────────────────────
function CitaModal({ cita, bloqueos, onClose, onSaved }: {
  cita: Partial<Cita>
  bloqueos: Bloqueo[]
  onClose: () => void
  onSaved: (c: Cita) => void
}) {
  const { data, upsertCita, upsertCitaFutura } = useStore()
  const { agendaStart: S, agendaEnd: E, slotMin, diasAbiertos } = data.config
  const SLOTS = makeSlots(S, E, slotMin)
  const nuevo = !cita.id

  const todayBase = new Date()
  todayBase.setHours(0, 0, 0, 0)
  const todayIso = dateToIso(todayBase)
  const tomorrowIso = dateToIso(new Date(todayBase.getTime() + 86400000))

  const fechasList: { iso: string; label: string }[] = []
  for (let i = 0; fechasList.length < 15; i++) {
    const d = new Date(todayBase.getTime() + i * 86400000)
    const dayIdx = (d.getDay() + 6) % 7  // 0=Lun, 6=Dom
    if (!diasAbiertos[dayIdx]) continue
    const iso = dateToIso(d)
    const label = iso === todayIso
      ? `Hoy · ${DIAS_ES[d.getDay()]} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`
      : iso === tomorrowIso
        ? `Mañana · ${DIAS_ES[d.getDay()]} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`
        : `${DIAS_ES[d.getDay()]} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`
    fechasList.push({ iso, label })
  }

  const initDate = cita.fecha && fechasList.some(f => f.iso === cita.fecha) ? cita.fecha : todayIso
  const [selectedDate, setSelectedDate] = useState(initDate)
  const [cl, setCl] = useState(cita.cl || '')
  const [srvId, setSrvId] = useState(() => {
    const s = data.servicios.find(s => s.nombre === cita.srv)
    return s ? s.id : data.servicios[0].id
  })
  const [est, setEst] = useState(cita.est || data.estilistas[0].id)
  const [estado, setEstado] = useState<EstadoCita>(cita.estado || 'pend')
  const [ant, setAnt] = useState(cita.ant || 0)

  const srv = data.servicios.find(s => s.id === srvId) || data.servicios[0]
  const isToday = selectedDate === todayIso

  const citasDelDia = isToday
    ? data.hoy.filter(a => a.est === est && a.id !== cita.id)
    : (data.citasFuturas || []).filter(a => a.fecha === selectedDate && a.est === est && a.id !== cita.id)

  const availableSlots = SLOTS.filter(slot => {
    const sS = toMin(slot), sE = sS + srv.dur
    if (sE > E * 60) return false
    if (citasDelDia.some(a => { const aS = toMin(a.h); return sS < aS + a.dur && sE > aS })) return false
    if (bloqueos.filter(b => b.est === est && (!b.fecha || b.fecha === selectedDate)).some(b => {
      const bS = toMin(b.h), bE = toMin(b.fin)
      return sS < bE && sE > bS
    })) return false
    return true
  })

  const [h, setH] = useState(() => {
    const snapped = snapSlot(cita.h || '10:00', S, E, slotMin)
    return availableSlots.includes(snapped) ? snapped : (availableSlots[0] || snapped)
  })

  useEffect(() => {
    if (availableSlots.length > 0 && !availableSlots.includes(h)) {
      setH(availableSlots[0])
    }
  }, [est, srvId, selectedDate])

  const displayH = availableSlots.includes(h) ? h : (availableSlots[0] || h)
  const saldoPreview = Math.max(0, srv.precio - (+ant || 0))

  const guardar = () => {
    if (!cl.trim() || availableSlots.length === 0) return
    const id = cita.id || ('a' + Date.now())
    const newCita: Cita = {
      id, cl: cl.trim(), srv: srv.nombre, est, h: displayH, dur: srv.dur,
      estado, total: srv.precio, ant: Math.max(0, +ant || 0),
      ...(isToday ? {} : { fecha: selectedDate }),
    }
    if (isToday) upsertCita(newCita)
    else upsertCitaFutura(newCita)
    toast(nuevo ? 'Cita agendada correctamente' : 'Cita actualizada')
    onSaved(newCita)
  }

  return (
    <div className="rb-modal-bg" onClick={onClose}>
      <div className="card gold-edge rb-modal" onClick={e => e.stopPropagation()} style={{ width: 520, maxWidth: '94vw' }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">{nuevo ? 'Agendar' : 'Editar'} cita</div>
            <h3 style={{ marginTop: 6 }}>{nuevo ? 'Nueva cita' : cita.cl}</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><Ic n="x" /></button>
        </div>
        <div className="card-pad" style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field">
            <label>Clienta</label>
            <input className="input" list="rb-clientas" value={cl} onChange={e => setCl(e.target.value)} placeholder="Escribe o elige una clienta…" />
            <datalist id="rb-clientas">
              {data.clientas.map(c => <option key={c.id} value={c.nombre} />)}
            </datalist>
          </div>
          <div className="field">
            <label>Servicio</label>
            <select className="select" value={srvId} onChange={e => setSrvId(e.target.value)}>
              {data.servicios.map(s => (
                <option key={s.id} value={s.id}>{s.nombre} — {mxn(s.precio)} · {s.dur} min</option>
              ))}
            </select>
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="field">
              <label>Estilista</label>
              <select className="select" value={est} onChange={e => setEst(e.target.value)}>
                {data.estilistas.map(es => <option key={es.id} value={es.id}>{es.nombre}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Fecha</label>
              <select className="select" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}>
                {fechasList.map(f => <option key={f.iso} value={f.iso}>{f.label}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Hora de inicio</label>
            {availableSlots.length > 0 ? (
              <select className="select" value={displayH} onChange={e => setH(e.target.value)}>
                {availableSlots.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <div style={{ padding: '10px 14px', border: '1px solid var(--line)', borderRadius: 10, fontSize: 13, color: 'var(--st-canc)', background: 'var(--surface)' }}>
                Sin horarios disponibles ese día
              </div>
            )}
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="field">
              <label>Estado</label>
              <select className="select" value={estado} onChange={e => setEstado(e.target.value as EstadoCita)}>
                {Object.values(data.estadosCita).map(s => (
                  <option key={s.k} value={s.k}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Anticipo (MXN)</label>
              <input className="input num" type="number" min="0" value={ant || ''} placeholder="0"
                onChange={e => setAnt(Math.max(0, +e.target.value))} />
            </div>
          </div>
          <div className="card" style={{ background: 'var(--surface)', padding: 14 }}>
            <div className="between">
              <span className="muted">Total del servicio</span>
              <span className="num gold-text" style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>{mxn(srv.precio)}</span>
            </div>
            {availableSlots.length > 0 && (
              <div className="between mt10" style={{ fontSize: 12.5 }}>
                <span className="muted">Termina aprox.</span>
                <span className="num">{(() => {
                  const end = toMin(displayH) + srv.dur
                  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
                })()}</span>
              </div>
            )}
            <div className="between mt10" style={{ fontSize: 12.5 }}>
              <span className="muted">Saldo por cobrar</span>
              <span className="num" style={{ fontWeight: 600 }}>{mxn(saldoPreview)}</span>
            </div>
          </div>
        </div>
        <hr className="hr" />
        <div className="card-pad vc gap12" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button
            className="btn gold"
            onClick={guardar}
            style={{ opacity: cl.trim() && availableSlots.length > 0 ? 1 : .4, pointerEvents: cl.trim() && availableSlots.length > 0 ? 'auto' : 'none' }}
          >
            <Ic n="check" />{nuevo ? 'Agendar cita' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal bloquear horario ─────────────────────────────────────────────────
function BloqueoModal({ onClose, onSaved }: { onClose: () => void; onSaved: (b: Bloqueo) => void }) {
  const { data } = useStore()
  const { agendaStart: S, agendaEnd: E, slotMin, diasAbiertos } = data.config
  const SLOTS = makeSlots(S, E, slotMin)

  const todayBase = new Date()
  todayBase.setHours(0, 0, 0, 0)
  const todayIso = dateToIso(todayBase)
  const tomorrowIso = dateToIso(new Date(todayBase.getTime() + 86400000))

  const fechasList: { iso: string; label: string }[] = []
  for (let i = 0; fechasList.length < 15; i++) {
    const d = new Date(todayBase.getTime() + i * 86400000)
    const dayIdx = (d.getDay() + 6) % 7  // 0=Lun, 6=Dom
    if (!diasAbiertos[dayIdx]) continue
    const iso = dateToIso(d)
    const label = iso === todayIso
      ? `Hoy · ${DIAS_ES[d.getDay()]} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`
      : iso === tomorrowIso
        ? `Mañana · ${DIAS_ES[d.getDay()]} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`
        : `${DIAS_ES[d.getDay()]} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`
    fechasList.push({ iso, label })
  }

  const [est, setEst] = useState(data.estilistas[0].id)
  const [selectedDate, setSelectedDate] = useState(todayIso)
  const [inicio, setInicio] = useState('12:00')
  const [fin, setFin] = useState('13:00')
  const [nota, setNota] = useState('')

  const inicioIdx = SLOTS.indexOf(inicio)
  const finSlots = SLOTS.slice(inicioIdx + 1)

  const handleInicio = (v: string) => {
    setInicio(v)
    const idx = SLOTS.indexOf(v)
    if (SLOTS.indexOf(fin) <= idx) setFin(SLOTS[Math.min(idx + 4, SLOTS.length - 1)])
  }

  const guardar = () => {
    onSaved({ id: 'b' + Date.now(), est, h: inicio, fin, nota: nota.trim() || 'Bloqueado', fecha: selectedDate })
    toast('Horario bloqueado')
    onClose()
  }

  const durMin = toMin(fin) - toMin(inicio)

  return (
    <div className="rb-modal-bg" onClick={onClose}>
      <div className="card gold-edge rb-modal" onClick={e => e.stopPropagation()} style={{ width: 480, maxWidth: '94vw' }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">Bloquear tiempo</div>
            <h3 style={{ marginTop: 6 }}>Nuevo bloqueo</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><Ic n="x" /></button>
        </div>
        <div className="card-pad" style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="field">
              <label>Estilista</label>
              <select className="select" value={est} onChange={e => setEst(e.target.value)}>
                {data.estilistas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Fecha</label>
              <select className="select" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}>
                {fechasList.map(f => <option key={f.iso} value={f.iso}>{f.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="field">
              <label>Desde</label>
              <select className="select" value={inicio} onChange={e => handleInicio(e.target.value)}>
                {SLOTS.slice(0, -1).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Hasta</label>
              <select className="select" value={fin} onChange={e => setFin(e.target.value)}>
                {finSlots.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Motivo (opcional)</label>
            <input className="input" value={nota} onChange={e => setNota(e.target.value)}
              placeholder="Descanso, reunión, capacitación…" />
          </div>
          <div className="card" style={{ background: 'var(--surface)', padding: 12, fontSize: 13, color: 'var(--text-3)' }}>
            <b style={{ color: 'var(--text)' }}>{fechasList.find(f => f.iso === selectedDate)?.label}</b>
            {' · '}{inicio} – {fin} · <b style={{ color: 'var(--text)' }}>{durMin} min</b>
          </div>
        </div>
        <hr className="hr" />
        <div className="card-pad vc gap12" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn gold" onClick={guardar}><Ic n="lock-simple" />Bloquear horario</button>
        </div>
      </div>
    </div>
  )
}

// ─── Detalle de cita ────────────────────────────────────────────────────────
function ApptDetail({ a, onClose, onEdit, onDelete }: {
  a: Cita; onClose: () => void; onEdit: () => void; onDelete: () => void
}) {
  const { data, upsertCita } = useStore()
  const e = data.estilistas.find(est => est.id === a.est) || data.estilistas[0]
  const saldo = Math.max(0, a.total - (a.ant || 0))

  return (
    <div className="card gold-edge" style={{ position: 'sticky', top: 92 }}>
      <div className="card-head">
        <div>
          <div className="eyebrow">Detalle de cita</div>
          <h3 style={{ marginTop: 6 }}>{a.cl}</h3>
        </div>
        <button className="icon-btn" onClick={onClose}><Ic n="x" /></button>
      </div>
      <div className="card-pad" style={{ paddingTop: 14 }}>
        <div style={{ marginBottom: 14 }}><EstadoBadge k={a.estado} /></div>
        {([['scissors', 'Servicio', a.srv], ['clock', 'Horario', `${a.h} · ${a.dur} min`], ['user', 'Estilista', e.nombre]] as [string, string, string][]).map(([ic, l, v]) => (
          <div key={l} className="list-item" style={{ padding: '11px 0' }}>
            <div className="ico" style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(200,161,74,0.08)', border: '1px solid var(--line)', color: 'var(--gold)' }}>
              <Ic n={ic} />
            </div>
            <div className="f1">
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{l}</div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{v}</div>
            </div>
          </div>
        ))}
        {a.fecha && (
          <div className="list-item" style={{ padding: '11px 0' }}>
            <div className="ico" style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(200,161,74,0.08)', border: '1px solid var(--line)', color: 'var(--gold)' }}>
              <Ic n="calendar" />
            </div>
            <div className="f1">
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Fecha</div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{a.fecha}</div>
            </div>
          </div>
        )}
        <div className="card" style={{ background: 'var(--surface)', padding: 14, marginTop: 12 }}>
          <div className="between" style={{ fontSize: 13 }}>
            <span className="muted">Total servicio</span>
            <span className="num" style={{ fontWeight: 600 }}>{mxn(a.total)}</span>
          </div>
          <div className="between mt10" style={{ fontSize: 13 }}>
            <span className="muted">Anticipo</span>
            <span className="num" style={{ fontWeight: 600, color: 'var(--st-conf)' }}>{a.ant ? mxn(a.ant) : '—'}</span>
          </div>
          <hr className="hr" style={{ margin: '10px 0' }} />
          <div className="between">
            <span style={{ fontWeight: 600 }}>Saldo por cobrar</span>
            <span className="num gold-text" style={{ fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600 }}>{mxn(saldo)}</span>
          </div>
        </div>
        {a.notas && (
          <div className="field mt14">
            <label>Notas</label>
            <div className="card" style={{ background: 'var(--surface)', padding: 12, fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
              {a.notas}
            </div>
          </div>
        )}
        <div className="vc gap8 mt14">
          {saldo > 0 && a.estado !== 'canc' ? (
            <button className="btn gold f1" style={{ justifyContent: 'center' }}
              onClick={() => { upsertCita({ ...a, estado: 'done' }); toast('Saldo cobrado'); onClose() }}>
              <Ic n="check" />Cobrar saldo {mxn(saldo)}
            </button>
          ) : (
            <div className="btn ghost f1" style={{ justifyContent: 'center', opacity: .5, pointerEvents: 'none' }}>
              <Ic n="check-circle" />Sin saldo pendiente
            </div>
          )}
          <button className="btn ghost" title="WhatsApp" onClick={() => toast('Abriendo WhatsApp...')}><Ic n="whatsapp-logo" /></button>
          <button className="btn ghost" title="Editar" onClick={onEdit}><Ic n="pencil-simple" /></button>
          <button className="btn ghost" title="Eliminar" style={{ color: 'var(--st-canc)' }} onClick={onDelete}><Ic n="trash" /></button>
        </div>
      </div>
    </div>
  )
}

// ─── Vista semana ───────────────────────────────────────────────────────────
function WeekView({ onSel }: { onSel: (a: Cita) => void }) {
  const { data } = useStore()
  const hoy = new Date()
  const dow = hoy.getDay()
  const monday = new Date(hoy)
  monday.setDate(hoy.getDate() - (dow === 0 ? 6 : dow - 1))
  monday.setHours(0, 0, 0, 0)
  const todayIso = dateToIso(hoy)

  const dias = DIAS_CORTOS.map((label, i) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    const iso = dateToIso(date)
    return { label, date, iso, isHoy: iso === todayIso }
  })

  return (
    <div className="card card-pad">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 12 }}>
        {dias.map(({ label, date, iso, isHoy }, i) => {
          const items = isHoy
            ? data.hoy
            : (data.citasFuturas || []).filter(c => c.fecha === iso)
          const esDom = i === 6
          return (
            <div key={label + date.getDate()}>
              <div className="center" style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>{label}</div>
                <div style={{
                  fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600,
                  color: isHoy ? '#241c0c' : 'var(--text)',
                  background: isHoy ? 'var(--gold-grad)' : 'none',
                  borderRadius: 10, width: 36, height: 36, lineHeight: '36px',
                  margin: '4px auto 0', textAlign: 'center'
                }}>{date.getDate()}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 320 }}>
                {items.map((a, k) => (
                  <div key={k} className={`appt ${a.estado}`} onClick={() => onSel(a)}>
                    <div className="t">{a.h}</div>
                    <div className="s">{a.cl.split(' ')[0]}</div>
                  </div>
                ))}
                {esDom && <div className="imgph" style={{ minHeight: 70, fontSize: 10 }}>Cerrado</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Vista mes ──────────────────────────────────────────────────────────────
function MonthView() {
  const { data } = useStore()
  const hoy = new Date()
  const todayNum = hoy.getDate()
  const firstDow = new Date(hoy.getFullYear(), hoy.getMonth(), 1).getDay()
  const offset = firstDow === 0 ? 6 : firstDow - 1
  const daysInMonth = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
  const yy = hoy.getFullYear()
  const mm = String(hoy.getMonth() + 1).padStart(2, '0')

  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className="card card-pad">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 8 }}>
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <div key={i} className="center dim" style={{ fontSize: 11, fontWeight: 600, paddingBottom: 4 }}>{d}</div>
        ))}
        {cells.map((d, idx) => {
          if (d === null) return <div key={'e' + idx} />
          const isHoy = d === todayNum
          const isDom = idx % 7 === 6
          const dayIso = `${yy}-${mm}-${String(d).padStart(2, '0')}`
          const n = isHoy
            ? data.hoy.length
            : (data.citasFuturas || []).filter(c => c.fecha === dayIso).length
          return (
            <div key={d} style={{
              minHeight: 92, borderRadius: 10,
              border: '1px solid ' + (isHoy ? 'var(--gold)' : 'var(--line-soft)'),
              background: isHoy ? 'rgba(200,161,74,0.06)' : isDom ? 'rgba(255,255,255,0.015)' : 'var(--surface)',
              padding: 9
            }}>
              <div className="between">
                <span className="num" style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600, color: isHoy ? 'var(--gold)' : isDom ? 'var(--text-4)' : 'var(--text-2)' }}>{d}</span>
                {n > 0 && <span style={{ fontSize: 10, color: 'var(--text-4)' }}>{n}</span>}
              </div>
              {n > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 8 }}>
                  {Array.from({ length: Math.min(n, 6) }).map((_, k) => (
                    <span key={k} className="dotc" style={{ background: ['#C8A14A', '#93B58C', '#6FA6B8', '#D9A441'][k % 4] }} />
                  ))}
                </div>
              )}
              {isDom && <div style={{ fontSize: 9.5, color: 'var(--text-4)', marginTop: 8 }}>Cerrado</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Pantalla principal ─────────────────────────────────────────────────────
export function ScreenAgenda({ onNavigate: _onNavigate }: { onNavigate: (r: string) => void }) {
  const { data, upsertCita, deleteCita, deleteCitaFutura } = useStore()
  const { agendaStart: S, agendaEnd: E } = data.config
  const [vista, setVista] = useState('Día')
  const [filtro, setFiltro] = useState('todos')
  const [sel, setSel] = useState<Cita | null>(null)
  const [editCita, setEditCita] = useState<Partial<Cita> | null>(null)
  const [showBloqueo, setShowBloqueo] = useState(false)
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([])

  const hoy = new Date()
  const todayIso = dateToIso(hoy)
  const fechaStr = `${DIAS_FULL[hoy.getDay()]} ${hoy.getDate()} de ${MESES_ES[hoy.getMonth()]}, ${hoy.getFullYear()}`

  const estilistas = data.estilistas
  const visibles = filtro === 'todos' ? estilistas : estilistas.filter(e => e.id === filtro)

  const horas: number[] = []
  for (let h = S; h <= E; h++) horas.push(h)

  const addBloqueo = (b: Bloqueo) => setBloqueos(prev => [...prev, b])
  const removeBloqueo = (id: string) => setBloqueos(prev => prev.filter(b => b.id !== id))

  const handleDelete = (cita: Cita) => {
    if (cita.fecha && cita.fecha !== todayIso) deleteCitaFutura(cita.id)
    else deleteCita(cita.id)
    setSel(null)
  }

  return (
    <div>
      <div className="between" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="display" style={{ fontSize: 26, margin: 0 }}>Agenda del salón</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            {fechaStr} · {data.hoy.length} citas · {estilistas.length} estilistas activas
            {bloqueos.length > 0 && <> · <span style={{ color: 'var(--st-canc)' }}>{bloqueos.length} bloqueo{bloqueos.length > 1 ? 's' : ''}</span></>}
          </div>
        </div>
        <div className="vc gap12">
          <Seg opts={['Día', 'Semana', 'Mes']} value={vista} onChange={setVista} />
          <button className="btn ghost" onClick={() => setShowBloqueo(true)}>
            <Ic n="lock-simple" />Bloquear horario
          </button>
          <button className="btn gold" onClick={() => setEditCita({})}><Ic n="plus" />Nueva cita</button>
        </div>
      </div>

      {/* Filtros estilistas */}
      <div className="vc gap8" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <span className="dim" style={{ fontSize: 12, marginRight: 4 }}>Estilista:</span>
        <button
          className="chip"
          style={filtro === 'todos' ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : {}}
          onClick={() => setFiltro('todos')}
        >Todas</button>
        {estilistas.map(e => (
          <button
            key={e.id}
            className="chip"
            style={filtro === e.id ? { borderColor: e.color, color: 'var(--text)' } : {}}
            onClick={() => setFiltro(e.id)}
          >
            <span className="dotc" style={{ background: e.color }} />{e.nombre.split(' ')[0]}
          </button>
        ))}
        <div className="spacer" />
        <div className="vc gap12" style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
          {['pend', 'conf', 'pay', 'done', 'canc'].map(k => <EstadoBadge key={k} k={k} />)}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: sel ? '1fr 320px' : '1fr', alignItems: 'start' }}>
        {/* Vista día */}
        {vista === 'Día' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `64px repeat(${visibles.length},1fr)`, borderBottom: '1px solid var(--line-soft)' }}>
              <div />
              {visibles.map(e => (
                <div key={e.id} className="vc gap8" style={{ padding: '14px 12px', borderLeft: '1px solid var(--line-soft)' }}>
                  <Avatar ini={e.ini} color={e.color} size="sm" />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 12.5 }}>{e.nombre.split(' ')[0]}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{e.rol}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `64px repeat(${visibles.length},1fr)`, position: 'relative' }}>
              <div>
                {horas.map(h => (
                  <div key={h} style={{ height: PXH, padding: '4px 10px 0', textAlign: 'right', fontSize: 11, color: 'var(--text-4)', fontVariantNumeric: 'tabular-nums' }}>
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>
              {visibles.map(e => (
                <div key={e.id} style={{ position: 'relative', borderLeft: '1px solid var(--line-soft)' }}>
                  {horas.map(h => <div key={h} style={{ height: PXH, borderBottom: '1px solid var(--line-soft)' }} />)}

                  {/* Bloqueos del día */}
                  {bloqueos.filter(b => b.est === e.id && (!b.fecha || b.fecha === todayIso)).map(b => (
                    <div
                      key={b.id}
                      title={`${b.nota} · ${b.h}–${b.fin} (clic para quitar)`}
                      onClick={() => removeBloqueo(b.id)}
                      style={{
                        position: 'absolute', left: 4, right: 4, zIndex: 1,
                        top: top(b.h, S) + 2,
                        height: Math.max((toMin(b.fin) - toMin(b.h)) / 60 * PXH - 6, 18),
                        background: 'repeating-linear-gradient(45deg,rgba(200,80,60,0.12),rgba(200,80,60,0.12) 4px,transparent 4px,transparent 10px)',
                        border: '1px dashed rgba(200,80,60,0.5)',
                        borderRadius: 6, display: 'flex', alignItems: 'center',
                        padding: '0 8px', fontSize: 10.5, color: 'var(--st-canc)',
                        cursor: 'pointer', gap: 4,
                      }}
                    >
                      <Ic n="lock-simple" size={11} />{b.nota}
                    </div>
                  ))}

                  {/* Citas */}
                  {data.hoy.filter(a => a.est === e.id).map(a => (
                    <div
                      key={a.id}
                      className={`appt ${a.estado}`}
                      onClick={() => setSel(a)}
                      style={{
                        position: 'absolute', left: 4, right: 4, zIndex: 2,
                        top: top(a.h, S) + 2,
                        height: (a.dur / 60) * PXH - 6,
                        boxShadow: sel?.id === a.id ? '0 0 0 1.5px var(--gold)' : 'none'
                      }}
                    >
                      <div className="t">{a.h} · {a.cl.split(' ')[0]} {a.cl.split(' ')[1] || ''}</div>
                      <div className="s">{a.srv}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {vista === 'Semana' && <WeekView onSel={setSel} />}
        {vista === 'Mes' && <MonthView />}

        {sel && (
          <ApptDetail
            a={sel}
            onClose={() => setSel(null)}
            onEdit={() => setEditCita(sel)}
            onDelete={() => handleDelete(sel)}
          />
        )}
      </div>

      {editCita !== null && (
        <CitaModal
          cita={editCita}
          bloqueos={bloqueos}
          onClose={() => setEditCita(null)}
          onSaved={(c) => { setEditCita(null); setSel(c) }}
        />
      )}

      {showBloqueo && (
        <BloqueoModal
          onClose={() => setShowBloqueo(false)}
          onSaved={addBloqueo}
        />
      )}
    </div>
  )
}

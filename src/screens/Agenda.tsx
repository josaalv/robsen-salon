import React, { useState, useEffect, useRef } from 'react'
import { Avatar, EstadoBadge, Seg, toast, ConfirmModal, useModalKeys } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { useStore } from '../data/store'
import { mxn, resolverComision } from '../lib/helpers'
import type { Cita, CitaServicio, EstadoCita, Bloqueo, Venta } from '../types'
import { db } from '../lib/db'
import { POSBuilder } from './POS'

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

// Un bloque agendable: un tramo de tiempo de un empleado. Una cita con varios
// servicios en distintos empleados/horas se "explota" en un bloque por servicio.
export interface CitaBloque {
  cita: Cita
  key: string
  est: string
  h: string
  dur: number
  label: string   // nombre del servicio (o resumen de la cita)
  idx: number     // índice del servicio dentro de la cita (para keys)
}

// ¿La cita tiene programación por servicio (algún servicio con su propio est/h)?
function tienePorServicio(a: Cita): boolean {
  return !!a.servicios && a.servicios.length > 0 && a.servicios.some(s => s.est || s.h)
}

// Explota una cita en sus bloques. Si no hay programación por servicio, es un
// único bloque con el est/h/dur de la cita (comportamiento de siempre).
function citaBloques(a: Cita): CitaBloque[] {
  if (tienePorServicio(a)) {
    return a.servicios!.map((s, i) => ({
      cita: a, key: a.id + '-' + i, est: s.est || a.est, h: s.h || a.h,
      dur: s.dur, label: s.nombre, idx: i,
    }))
  }
  return [{ cita: a, key: a.id, est: a.est, h: a.h, dur: a.dur, label: a.srv, idx: 0 }]
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

  const defEst = cita.est || data.estilistas[0].id
  const defH = snapSlot(cita.h || '10:00', S, E, slotMin)

  // Cada servicio de la cita lleva su propio empleado (est) y hora (h): así una
  // clienta con 2 servicios a distintas horas con distintos empleados no bloquea
  // las horas de un solo empleado.
  const [lineas, setLineas] = useState<{ servicioId: string; est: string; h: string }[]>(() => {
    if (cita.servicios && cita.servicios.length) {
      return cita.servicios.map(s => ({ servicioId: s.servicioId, est: s.est || defEst, h: s.h || cita.h || defH }))
    }
    const s = data.servicios.find(s => s.nombre === cita.srv)
    return [{ servicioId: s ? s.id : data.servicios[0].id, est: defEst, h: defH }]
  })
  const [addSrv, setAddSrv] = useState('')
  const [estado, setEstado] = useState<EstadoCita>(cita.estado || 'pend')
  const [ant, setAnt] = useState(cita.ant || 0)
  const [saving, setSaving] = useState(false)

  const isToday = selectedDate === todayIso
  const dayIdx = (() => { const d = new Date(selectedDate + 'T12:00:00'); return (d.getDay() + 6) % 7 })()
  const estilistasDia = data.estilistas.filter(es => !es.horarios || es.horarios[dayIdx])

  const srvDe = (id: string) => data.servicios.find(s => s.id === id)
  const lineasInfo = lineas.map((l, idx) => ({ ...l, idx, srv: srvDe(l.servicioId) }))
    .filter((l): l is typeof l & { srv: NonNullable<typeof l.srv> } => Boolean(l.srv))
  const precioTotal = lineasInfo.reduce((sum, l) => sum + l.srv.precio, 0)
  const durTotal = lineasInfo.reduce((sum, l) => sum + l.srv.dur, 0)

  // Bloques ocupados ese día por las demás citas (explotados por servicio).
  const bloquesOcupados = (isToday
    ? data.hoy
    : (data.citasFuturas || []).filter(a => a.fecha === selectedDate)
  ).filter(a => a.id !== cita.id && a.estado !== 'canc').flatMap(citaBloques)

  // Horarios libres para un servicio (est+dur), evitando otras citas y bloqueos
  // de ese empleado, y las otras líneas de esta misma cita en el mismo empleado.
  const slotsLibres = (estId: string, dur: number, ignoreIdx: number) => SLOTS.filter(slot => {
    const sS = toMin(slot), sE = sS + dur
    if (sE > E * 60) return false
    if (bloquesOcupados.some(b => b.est === estId && sS < toMin(b.h) + b.dur && sE > toMin(b.h))) return false
    if (bloqueos.filter(b => b.est === estId && (!b.fecha || b.fecha === selectedDate))
      .some(b => sS < toMin(b.fin) && sE > toMin(b.h))) return false
    if (lineas.some((l, i) => {
      if (i === ignoreIdx || l.est !== estId) return false
      const s2 = srvDe(l.servicioId); if (!s2) return false
      const lS = toMin(l.h); return sS < lS + s2.dur && sE > lS
    })) return false
    return true
  })

  const setLinea = (idx: number, patch: Partial<{ servicioId: string; est: string; h: string }>) =>
    setLineas(ls => ls.map((l, i) => i === idx ? { ...l, ...patch } : l))
  const cambiarEst = (idx: number, newEst: string, dur: number) => {
    const slots = slotsLibres(newEst, dur, idx)
    setLinea(idx, { est: newEst, h: slots.includes(lineas[idx].h) ? lineas[idx].h : (slots[0] || lineas[idx].h) })
  }
  const quitarLinea = (idx: number) =>
    setLineas(ls => ls.length > 1 ? ls.filter((_, i) => i !== idx) : ls)
  // Cambia el servicio de una línea en el lugar y reacomoda la hora según la
  // nueva duración (sin tener que borrar y recrear la cita).
  const cambiarServicio = (idx: number, newId: string) => {
    const s = srvDe(newId)
    if (!s) return
    const slots = slotsLibres(lineas[idx].est, s.dur, idx)
    setLinea(idx, { servicioId: newId, h: slots.includes(lineas[idx].h) ? lineas[idx].h : (slots[0] || lineas[idx].h) })
  }
  const agregarServicio = (id: string) => {
    if (id) {
      const s = srvDe(id)
      const est0 = estilistasDia[0]?.id || defEst
      const slots = slotsLibres(est0, s?.dur || 60, -1)
      setLineas(ls => [...ls, { servicioId: id, est: est0, h: slots[0] || defH }])
    }
    setAddSrv('')
  }

  // Al cambiar de fecha, reacomoda empleado/hora de cada línea si dejaron de ser válidos.
  useEffect(() => {
    setLineas(ls => {
      let changed = false
      const next = ls.map((l, i) => {
        const s = srvDe(l.servicioId); if (!s) return l
        let est = l.est
        if (estilistasDia.length && !estilistasDia.find(e => e.id === est)) { est = estilistasDia[0].id; changed = true }
        const slots = slotsLibres(est, s.dur, i)
        let h = l.h
        if (slots.length && !slots.includes(h)) { h = slots[0]; changed = true }
        return changed ? { ...l, est, h } : l
      })
      return changed ? next : ls
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  // Cada línea debe tener un horario válido para poder guardar.
  const lineasValidas = lineasInfo.length > 0 && lineasInfo.every(l => slotsLibres(l.est, l.srv.dur, l.idx).includes(l.h))
  const saldoPreview = Math.max(0, precioTotal - (+ant || 0))

  const guardar = async () => {
    if (!cl.trim() || !lineasValidas || saving) return
    const id = cita.id || ('a' + Date.now())
    const antFinal = Math.min(precioTotal, Math.max(0, +ant || 0))
    const serviciosCita: CitaServicio[] = lineasInfo.map(l => ({
      servicioId: l.srv.id, nombre: l.srv.nombre, precio: l.srv.precio, dur: l.srv.dur, est: l.est, h: l.h,
    }))
    // El bloque primario (para el resumen agregado) es el de hora más temprana.
    const primary = [...lineasInfo].sort((a, b) => toMin(a.h) - toMin(b.h))[0]
    const newCita: Cita = {
      id, cl: cl.trim(),
      srv: lineasInfo.map(l => l.srv.nombre).join(' + '),
      servicioId: lineasInfo[0].srv.id,
      servicios: serviciosCita,
      est: primary.est, h: primary.h, dur: durTotal,
      estado, total: precioTotal, ant: antFinal,
      ...(isToday ? {} : { fecha: selectedDate }),
    }
    setSaving(true)
    try {
      if (isToday) await upsertCita(newCita)
      else await upsertCitaFutura(newCita)

      // Sincronizar venta de apartado cuando hay anticipo: una línea por servicio,
      // cada una con su propio empleado (para la comisión correcta).
      if (antFinal > 0) {
        const existing = await db.getVentaByCitaId(id)
        const hoy = new Date().toISOString().slice(0, 10)
        const ticket = `APT-${id.slice(-6).toUpperCase()}`
        if (existing) {
          await db.updateVenta(existing.id, { anticipo: antFinal, estado: antFinal >= precioTotal ? 'pagada' : 'apartado' })
        } else {
          const ventaApartado: Venta = {
            id: 'v' + Date.now(), ticket, fecha: hoy,
            cliente: cl.trim(), clienteId: '', pago: 'efectivo',
            estado: antFinal >= precioTotal ? 'pagada' : 'apartado',
            desc: 0, anticipo: antFinal, citaId: id,
            lineas: lineasInfo.map(l => {
              const r = resolverComision(l.srv.id, l.est, data.estilistas)
              return {
                tipo: 'servicio' as const, nombre: l.srv.nombre, est: l.est, cant: 1, precio: l.srv.precio,
                com: r.tipo === 'porcentaje' ? r.pct : 0,
                comMonto: r.tipo === 'monto' ? r.monto : undefined,
              }
            }),
          }
          await db.addVenta(ventaApartado)
        }
      }

      toast(nuevo ? 'Cita agendada correctamente' : 'Cita actualizada')
      onSaved(newCita)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      toast(/existe una cita/i.test(msg)
        ? 'No se pudo guardar la cita porque se empalma con otra cita o bloqueo.'
        : 'No se pudo guardar la cita. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const cardRef = useRef<HTMLDivElement>(null)
  useModalKeys(cardRef, onClose, guardar)

  return (
    <div className="rb-modal-bg" onClick={onClose}>
      <div ref={cardRef} className="card gold-edge rb-modal" onClick={e => e.stopPropagation()} style={{ width: 520, maxWidth: '94vw' }}>
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
            <label>Fecha</label>
            <select className="select" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}>
              {fechasList.map(f => <option key={f.iso} value={f.iso}>{f.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Servicios <span className="muted" style={{ fontWeight: 400 }}>(cada uno con su empleado y hora)</span></label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {lineasInfo.map(l => {
                const slots = slotsLibres(l.est, l.srv.dur, l.idx)
                const horaOk = slots.includes(l.h)
                const fin = toMin(l.h) + l.srv.dur
                return (
                  <div key={l.idx} style={{ padding: '10px 12px', border: `1px solid ${horaOk ? 'var(--line-soft)' : 'var(--st-canc)'}`, borderRadius: 10, background: 'var(--surface)' }}>
                    <div className="between" style={{ gap: 8 }}>
                      <select
                        className="select f1"
                        value={l.servicioId}
                        onChange={e => cambiarServicio(l.idx, e.target.value)}
                        style={{ minWidth: 0, fontSize: 12.5, fontWeight: 600, padding: '7px 26px 7px 10px' }}
                      >
                        {data.servicios.filter(s => s.activo !== false || s.id === l.servicioId).map(s => (
                          <option key={s.id} value={s.id}>{s.nombre}{s.activo === false ? ' (inactivo)' : ''} — {mxn(s.precio)}</option>
                        ))}
                      </select>
                      <button
                        className="icon-btn"
                        disabled={lineasInfo.length === 1}
                        onClick={() => quitarLinea(l.idx)}
                        title={lineasInfo.length === 1 ? 'Debe quedar al menos un servicio' : 'Quitar servicio'}
                        style={{ width: 30, height: 30, flexShrink: 0, color: lineasInfo.length === 1 ? 'var(--text-4)' : 'var(--st-canc)', opacity: lineasInfo.length === 1 ? .45 : 1 }}
                      >
                        <Ic n="trash" size={14} />
                      </button>
                    </div>
                    <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>
                      {l.srv.dur} min{horaOk ? ` · termina ${String(Math.floor(fin / 60)).padStart(2, '0')}:${String(fin % 60).padStart(2, '0')}` : ''}
                    </div>
                    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                      <select className="select" value={l.est} onChange={e => cambiarEst(l.idx, e.target.value, l.srv.dur)} style={{ fontSize: 12, padding: '7px 26px 7px 10px' }}>
                        {estilistasDia.map(es => <option key={es.id} value={es.id}>{es.nombre}</option>)}
                      </select>
                      {slots.length > 0 ? (
                        <select className="select" value={horaOk ? l.h : slots[0]} onChange={e => setLinea(l.idx, { h: e.target.value })} style={{ fontSize: 12, padding: '7px 26px 7px 10px' }}>
                          {slots.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <div style={{ padding: '7px 10px', border: '1px solid var(--st-canc)', borderRadius: 8, fontSize: 11.5, color: 'var(--st-canc)' }}>Sin horario libre</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <select className="select" value={addSrv} onChange={e => agregarServicio(e.target.value)} style={{ marginTop: 8 }}>
              <option value="">+ Agregar otro servicio…</option>
              {data.servicios.filter(s => s.activo !== false).map(s => (
                <option key={s.id} value={s.id}>{s.nombre} — {mxn(s.precio)} · {s.dur} min</option>
              ))}
            </select>
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
              <input className="input num" type="number" min="0" max={precioTotal} value={ant || ''} placeholder="0"
                onChange={e => setAnt(Math.min(precioTotal, Math.max(0, +e.target.value)))} />
            </div>
          </div>
          <div className="card" style={{ background: 'var(--surface)', padding: 14 }}>
            <div className="between">
              <span className="muted">Total{lineasInfo.length > 1 ? ` (${lineasInfo.length} servicios)` : ''}</span>
              <span className="num gold-text" style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>{mxn(precioTotal)}</span>
            </div>
            <div className="between mt10" style={{ fontSize: 12.5 }}>
              <span className="muted">Duración total</span>
              <span className="num">{durTotal} min</span>
            </div>
            <div className="between mt10" style={{ fontSize: 12.5 }}>
              <span className="muted">Saldo por cobrar</span>
              <span className="num" style={{ fontWeight: 600 }}>{mxn(saldoPreview)}</span>
            </div>
          </div>
        </div>
        <hr className="hr" />
        <div className="card-pad vc gap12" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          {(() => {
            const puede = !!cl.trim() && lineasValidas && !saving
            return (
              <button
                className="btn gold"
                onClick={guardar}
                style={{ opacity: puede ? 1 : .4, pointerEvents: puede ? 'auto' : 'none' }}
              >
                <Ic n="check" />{saving ? 'Guardando…' : (nuevo ? 'Agendar cita' : 'Guardar cambios')}
              </button>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

// ─── Modal bloquear horario ─────────────────────────────────────────────────
function BloqueoModal({ onClose, onSaved }: { onClose: () => void; onSaved: (b: Bloqueo) => Promise<void> }) {
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

  const [saving, setSaving] = useState(false)
  const guardar = async () => {
    if (saving) return
    setSaving(true)
    try {
      await onSaved({ id: 'b' + Date.now(), est, h: inicio, fin, nota: nota.trim() || 'Bloqueado', fecha: selectedDate })
      toast('Horario bloqueado')
      onClose()
    } catch {
      toast('No se pudo guardar el bloqueo. Intenta de nuevo.')
      setSaving(false)
    }
  }

  const durMin = toMin(fin) - toMin(inicio)

  const cardRef = useRef<HTMLDivElement>(null)
  useModalKeys(cardRef, onClose, guardar)

  return (
    <div className="rb-modal-bg" onClick={onClose}>
      <div ref={cardRef} className="card gold-edge rb-modal" onClick={e => e.stopPropagation()} style={{ width: 480, maxWidth: '94vw' }}>
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
          <button className="btn gold" onClick={guardar} style={{ opacity: saving ? .6 : 1, pointerEvents: saving ? 'none' : 'auto' }}>
            <Ic n="lock-simple" />{saving ? 'Guardando…' : 'Bloquear horario'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Detalle de cita ────────────────────────────────────────────────────────
function waLink(tel: string, msg: string): string {
  const digits = tel.replace(/\D/g, '')
  const num = digits.startsWith('52') ? digits : '52' + digits
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
}

function ApptDetail({ a, onClose, onEdit, onDelete, onCobrar }: {
  a: Cita; onClose: () => void; onEdit: () => void; onDelete: () => void; onCobrar: () => void
}) {
  const { data, upsertCita, upsertCitaFutura } = useStore()
  const todayIso = dateToIso(new Date())
  const esFutura = a.fecha && a.fecha !== todayIso
  const saveCita = (patch: Partial<Cita>) =>
    esFutura ? upsertCitaFutura({ ...a, ...patch }) : upsertCita({ ...a, ...patch })
  const saveCitaConFeedback = async (patch: Partial<Cita>, okMsg: string) => {
    try {
      await saveCita(patch)
      toast(okMsg)
      onClose()
    } catch {
      toast('No se pudo actualizar la cita. Intenta de nuevo.')
    }
  }
  const e = data.estilistas.find(est => est.id === a.est) || data.estilistas[0]
  const saldo = Math.max(0, a.total - (a.ant || 0))
  const clientaTel = a.tel
    || (a.clienteId ? data.clientas.find(c => c.id === a.clienteId)?.tel : undefined)
    || data.clientas.find(c => c.nombre === a.cl)?.tel
    || ''

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
        {tienePorServicio(a) ? (
          // Programación por servicio: cada uno con su empleado y hora.
          <div className="list-item" style={{ padding: '11px 0', alignItems: 'flex-start' }}>
            <div className="ico" style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(200,161,74,0.08)', border: '1px solid var(--line)', color: 'var(--gold)', flexShrink: 0 }}>
              <Ic n="scissors" />
            </div>
            <div className="f1" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Servicios</div>
              {a.servicios!.map((s, i) => {
                const es = data.estilistas.find(x => x.id === (s.est || a.est))
                const hh = s.h || a.h
                const fin = toMin(hh) + s.dur
                return (
                  <div key={s.servicioId + '-' + i}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.nombre}</div>
                    <div className="dim" style={{ fontSize: 11.5, marginTop: 1 }}>
                      {hh}–{String(Math.floor(fin / 60)).padStart(2, '0')}:{String(fin % 60).padStart(2, '0')} · {es?.nombre || '—'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          ([['scissors', 'Servicio', a.srv], ['clock', 'Horario', `${a.h} · ${a.dur} min`], ['user', 'Estilista', e.nombre]] as [string, string, string][]).map(([ic, l, v]) => (
            <div key={l} className="list-item" style={{ padding: '11px 0' }}>
              <div className="ico" style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(200,161,74,0.08)', border: '1px solid var(--line)', color: 'var(--gold)' }}>
                <Ic n={ic} />
              </div>
              <div className="f1">
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{l}</div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{v}</div>
              </div>
            </div>
          ))
        )}
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
        {clientaTel && (
          <div className="list-item" style={{ padding: '11px 0' }}>
            <div className="ico" style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(200,161,74,0.08)', border: '1px solid var(--line)', color: 'var(--gold)' }}>
              <Ic n="phone" />
            </div>
            <div className="f1">
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Teléfono</div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{clientaTel}</div>
            </div>
          </div>
        )}
        <div className="card" style={{ background: 'var(--surface)', padding: 14, marginTop: 12 }}>
          {a.servicios && a.servicios.length > 1 && (
            <>
              {a.servicios.map((s, i) => (
                <div key={s.servicioId + '-' + i} className="between" style={{ fontSize: 12.5, marginBottom: 6 }}>
                  <span className="muted">{s.nombre} <span className="dim">· {s.dur} min</span></span>
                  <span className="num">{mxn(s.precio)}</span>
                </div>
              ))}
              <hr className="hr" style={{ margin: '8px 0' }} />
            </>
          )}
          <div className="between" style={{ fontSize: 13 }}>
            <span className="muted">Total{a.servicios && a.servicios.length > 1 ? ` (${a.servicios.length} servicios)` : ' servicio'}</span>
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
        <div className="mt14">
          {a.estado !== 'canc' ? (
            <button className="btn gold w100" style={{ justifyContent: 'center' }} onClick={onCobrar}>
              <Ic n="check" />{saldo > 0 ? `Cobrar saldo ${mxn(saldo)}` : 'Registrar venta'}
            </button>
          ) : (
            <div className="btn ghost w100" style={{ justifyContent: 'center', opacity: .5, pointerEvents: 'none' }}>
              <Ic n="check-circle" />Cita cancelada
            </div>
          )}
          <div className="vc gap8 mt8">
            {clientaTel
              ? <a className="btn ghost f1" style={{ justifyContent: 'center' }} title="WhatsApp" href={waLink(clientaTel, `Hola ${a.cl.split(' ')[0]} 💛 Tu cita de ${a.srv} es hoy a las ${a.h}. ¡Te esperamos!`)} target="_blank" rel="noreferrer"><Ic n="whatsapp-logo" /></a>
              : <button className="btn ghost f1" style={{ justifyContent: 'center', opacity: .4 }} title="Sin teléfono" disabled><Ic n="whatsapp-logo" /></button>}
            <button className="btn ghost f1" style={{ justifyContent: 'center' }} title="Editar" onClick={onEdit}><Ic n="pencil-simple" /></button>
            <button className="btn ghost f1" style={{ justifyContent: 'center', color: 'var(--st-canc)' }} title="Eliminar" onClick={onDelete}><Ic n="trash" /></button>
          </div>
        </div>
        {!['canc', 'done', 'no_asistio'].includes(a.estado) && (
          <button className="btn ghost w100 mt8" style={{ justifyContent: 'center', color: 'var(--st-noshow)' }}
            onClick={() => saveCitaConFeedback({ estado: 'no_asistio' }, 'Cita marcada como no asistió')}>
            <Ic n="user-minus" />Marcar como no asistió
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Vista semana ───────────────────────────────────────────────────────────
function WeekView({ onSel, weekOffset, onWeekChange }: {
  onSel: (a: Cita) => void
  weekOffset: number
  onWeekChange: (delta: number) => void
}) {
  const { data, deleteBloqueo } = useStore()
  const bloqueos = data.bloqueos || []
  const hoy = new Date()
  const dow = hoy.getDay()
  const monday = new Date(hoy)
  monday.setDate(hoy.getDate() - (dow === 0 ? 6 : dow - 1) + weekOffset * 7)
  monday.setHours(0, 0, 0, 0)
  const todayIso = dateToIso(hoy)

  const dias = DIAS_CORTOS.map((label, i) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    const iso = dateToIso(date)
    return { label, date, iso, isHoy: iso === todayIso }
  })

  const semLabel = (() => {
    const s = dias[0].date, e = dias[6].date
    const sm = MESES_CORTOS[s.getMonth()], em = MESES_CORTOS[e.getMonth()]
    return sm === em ? `${s.getDate()}–${e.getDate()} ${sm}` : `${s.getDate()} ${sm} – ${e.getDate()} ${em}`
  })()

  return (
    <div className="card card-pad">
      <div className="between" style={{ marginBottom: 14 }}>
        <button className="btn ghost" onClick={() => onWeekChange(-1)}><Ic n="caret-left" />Anterior</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
          {weekOffset === 0 ? 'Esta semana' : semLabel}
          {weekOffset !== 0 && (
            <button className="btn ghost" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 11 }} onClick={() => onWeekChange(-weekOffset)}>Hoy</button>
          )}
        </span>
        <button className="btn ghost" onClick={() => onWeekChange(1)}>Siguiente<Ic n="caret-right" /></button>
      </div>
      <div className="agenda-scroll-x">
      <div style={{ minWidth: 700, display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 12 }}>
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
                {bloqueos.filter(b => !b.fecha || b.fecha === iso).map(b => (
                  <div
                    key={b.id}
                    title={`Bloqueo: ${b.nota} · ${b.h}–${b.fin} (clic para quitar)`}
                    onClick={() => deleteBloqueo(b.id).catch(() => toast('No se pudo quitar el bloqueo. Intenta de nuevo.'))}
                    style={{
                      padding: '4px 8px', borderRadius: 6, fontSize: 10.5,
                      background: 'repeating-linear-gradient(45deg,rgba(200,80,60,0.10),rgba(200,80,60,0.10) 4px,transparent 4px,transparent 10px)',
                      border: '1px dashed rgba(200,80,60,0.45)',
                      color: 'var(--st-canc)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <Ic n="lock-simple" size={11} />{b.h}–{b.fin}
                  </div>
                ))}
                {esDom && <div className="imgph" style={{ minHeight: 70, fontSize: 10 }}>Cerrado</div>}
              </div>
            </div>
          )
        })}
      </div>
      </div>
    </div>
  )
}

// ─── Vista mes ──────────────────────────────────────────────────────────────
function MonthView({ onDayClick }: { onDayClick?: (date: Date) => void }) {
  const { data } = useStore()
  const hoy = new Date()
  const [monthOffset, setMonthOffset] = useState(0)

  const base = new Date(hoy.getFullYear(), hoy.getMonth() + monthOffset, 1)
  const displayYear = base.getFullYear()
  const displayMonth = base.getMonth()
  const isCurrentMonth = displayYear === hoy.getFullYear() && displayMonth === hoy.getMonth()

  const firstDow = new Date(displayYear, displayMonth, 1).getDay()
  const offset = firstDow === 0 ? 6 : firstDow - 1
  const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate()
  const yy = String(displayYear)
  const mm = String(displayMonth + 1).padStart(2, '0')

  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className="card card-pad">
      <div className="between" style={{ marginBottom: 14 }}>
        <button className="btn ghost" onClick={() => setMonthOffset(o => o - 1)}><Ic n="caret-left" />Anterior</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
          {MESES_ES[displayMonth].charAt(0).toUpperCase() + MESES_ES[displayMonth].slice(1)} {displayYear}
          {monthOffset !== 0 && (
            <button className="btn ghost" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 11 }} onClick={() => setMonthOffset(0)}>Hoy</button>
          )}
        </span>
        <button className="btn ghost" onClick={() => setMonthOffset(o => o + 1)}>Siguiente<Ic n="caret-right" /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 8 }}>
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <div key={i} className="center dim" style={{ fontSize: 11, fontWeight: 600, paddingBottom: 4 }}>{d}</div>
        ))}
        {cells.map((d, idx) => {
          if (d === null) return <div key={'e' + idx} />
          const isHoy = isCurrentMonth && d === hoy.getDate()
          const isDom = idx % 7 === 6
          const dayIso = `${yy}-${mm}-${String(d).padStart(2, '0')}`
          const n = isHoy
            ? data.hoy.length
            : (data.citasFuturas || []).filter(c => c.fecha === dayIso).length
          return (
            <div key={d}
              onClick={() => onDayClick?.(new Date(displayYear, displayMonth, d))}
              style={{
                minHeight: 92, borderRadius: 10,
                border: '1px solid ' + (isHoy ? 'var(--gold)' : 'var(--line-soft)'),
                background: isHoy ? 'rgba(200,161,74,0.06)' : isDom ? 'rgba(255,255,255,0.015)' : 'var(--surface)',
                padding: 9,
                cursor: onDayClick ? 'pointer' : 'default',
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
  const { data, upsertCita, upsertCitaFutura, deleteCita, deleteCitaFutura, upsertBloqueo, deleteBloqueo, addVenta, deleteVenta } = useStore()
  const { agendaStart: S, agendaEnd: E } = data.config
  const [vista, setVista] = useState('Día')
  const [filtro, setFiltro] = useState('todos')
  const [sel, setSel] = useState<Cita | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Cita | null>(null)
  const [editCita, setEditCita] = useState<Partial<Cita> | null>(null)
  const [showBloqueo, setShowBloqueo] = useState(false)
  const [posCita, setPosCita] = useState<Cita | null>(null)
  const bloqueos = data.bloqueos || []
  const [weekOffset, setWeekOffset] = useState(0)
  const [dayIso, setDayIso] = useState(() => dateToIso(new Date()))

  const hoy = new Date()
  const todayIso = dateToIso(hoy)
  const fechaStr = `${DIAS_FULL[hoy.getDay()]} ${hoy.getDate()} de ${MESES_ES[hoy.getMonth()]}, ${hoy.getFullYear()}`

  // Día seleccionado en la vista "Día": desplaza por días o salta con el
  // selector de fecha. Las citas sin fecha se consideran de hoy.
  const shiftDay = (iso: string, delta: number) => {
    const [y, m, d] = iso.split('-').map(Number)
    return dateToIso(new Date(y, m - 1, d + delta))
  }
  const tomorrowIso = shiftDay(todayIso, 1)
  const dayLabel = (() => {
    const [y, m, d] = dayIso.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    const base = `${DIAS_FULL[dt.getDay()]} ${dt.getDate()} ${MESES_CORTOS[dt.getMonth()]} ${dt.getFullYear()}`
    if (dayIso === todayIso) return `Hoy · ${base}`
    if (dayIso === tomorrowIso) return `Mañana · ${base}`
    return base
  })()
  const citasDelDia = [...data.hoy, ...(data.citasFuturas || [])]
    .filter(a => (a.fecha || todayIso) === dayIso)
  // Cada servicio (con su empleado y hora) es un bloque independiente en la
  // columna del empleado que lo realiza.
  const bloquesDelDia = citasDelDia.flatMap(citaBloques)
  const bloqueosDelDia = bloqueos.filter(b => !b.fecha || b.fecha === dayIso)

  const estilistas = data.estilistas
  const visibles = filtro === 'todos' ? estilistas : estilistas.filter(e => e.id === filtro)

  const horas: number[] = []
  for (let h = S; h <= E; h++) horas.push(h)

  const addBloqueo = (b: Bloqueo) => upsertBloqueo(b)
  const removeBloqueo = (id: string) => deleteBloqueo(id).catch(() => toast('No se pudo quitar el bloqueo. Intenta de nuevo.'))

  const handleDelete = (cita: Cita) => setConfirmDelete(cita)
  const confirmDeleteFn = async () => {
    if (!confirmDelete) return
    try {
      if (confirmDelete.fecha && confirmDelete.fecha !== todayIso) await deleteCitaFutura(confirmDelete.id)
      else await deleteCita(confirmDelete.id)
      setSel(null)
      setConfirmDelete(null)
      toast('Cita eliminada')
    } catch {
      toast('No se pudo eliminar la cita. Intenta de nuevo.')
    }
  }

  const confirmarVenta = async (venta: Venta) => {
    if (!posCita) return
    const cita = posCita
    // Si la cita tenía anticipo, ya existe una venta de apartado; el anticipo se
    // precarga en el POS (venta.anticipo), así que esta venta ya representa el
    // total con el anticipo aplicado. Se elimina la de apartado para no duplicar
    // la venta ni dejar el apartado colgado como pendiente.
    let apartadoPrevio: Venta | null = null
    try {
      apartadoPrevio = await db.getVentaByCitaId(cita.id)
    } catch { /* no bloquea el cobro */ }
    try {
      await addVenta(venta)
    } catch {
      toast('No se pudo registrar la venta. Verifica tu conexión e intenta de nuevo.')
      throw new Error('addVenta failed')
    }
    if (apartadoPrevio) {
      try { await deleteVenta(apartadoPrevio.id) } catch { /* la venta nueva ya quedó; el apartado se puede limpiar luego */ }
    }
    setPosCita(null)
    try {
      const esFutura = cita.fecha && cita.fecha !== todayIso
      if (esFutura) await upsertCitaFutura({ ...cita, estado: 'done' })
      else await upsertCita({ ...cita, estado: 'done' })
      setSel(null)
      toast('Venta registrada y cita completada')
    } catch {
      toast('La venta se registró, pero no se pudo actualizar el estado de la cita.')
    }
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
          <button className="btn gold" onClick={() => setEditCita(vista === 'Día' && dayIso !== todayIso ? { fecha: dayIso } : {})}><Ic n="plus" />Nueva cita</button>
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
          {['pend', 'conf', 'pay', 'done', 'canc', 'no_asistio'].map(k => <EstadoBadge key={k} k={k} />)}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: sel ? '1fr 320px' : '1fr', alignItems: 'start' }}>
        {/* Vista día */}
        {vista === 'Día' && (
          <div className="card" style={{ overflow: 'hidden' }}>
          <div className="between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--line-soft)', flexWrap: 'wrap', gap: 10 }}>
            <button className="btn ghost" onClick={() => setDayIso(d => shiftDay(d, -1))}><Ic n="caret-left" />Anterior</button>
            <div className="vc gap10" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
                {dayLabel} · {citasDelDia.length} cita{citasDelDia.length !== 1 ? 's' : ''}
              </span>
              <input className="input" type="date" value={dayIso} onChange={e => e.target.value && setDayIso(e.target.value)}
                style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} />
              {dayIso !== todayIso && (
                <button className="btn ghost sm" onClick={() => setDayIso(todayIso)}>Hoy</button>
              )}
            </div>
            <button className="btn ghost" onClick={() => setDayIso(d => shiftDay(d, 1))}>Siguiente<Ic n="caret-right" /></button>
          </div>
          <div className="agenda-scroll-x">
            <div style={{ minWidth: 64 + visibles.length * 130, display: 'grid', gridTemplateColumns: `64px repeat(${visibles.length},1fr)`, borderBottom: '1px solid var(--line-soft)' }}>
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
            <div style={{ minWidth: 64 + visibles.length * 130, display: 'grid', gridTemplateColumns: `64px repeat(${visibles.length},1fr)`, position: 'relative' }}>
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
                  {bloqueosDelDia.filter(b => b.est === e.id).map(b => (
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

                  {/* Citas (un bloque por servicio, en la columna de su empleado) */}
                  {bloquesDelDia.filter(b => b.est === e.id).map(b => (
                    <div
                      key={b.key}
                      className={`appt ${b.cita.estado}`}
                      onClick={() => setSel(b.cita)}
                      style={{
                        position: 'absolute', left: 4, right: 4, zIndex: 2,
                        top: top(b.h, S) + 2,
                        height: (b.dur / 60) * PXH - 6,
                        boxShadow: sel?.id === b.cita.id ? '0 0 0 1.5px var(--gold)' : 'none'
                      }}
                    >
                      <div className="t">{b.h} · {b.cita.cl.split(' ')[0]} {b.cita.cl.split(' ')[1] || ''}</div>
                      <div className="s">{b.label}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          </div>
        )}

        {vista === 'Semana' && (
          <WeekView
            onSel={setSel}
            weekOffset={weekOffset}
            onWeekChange={(delta) => setWeekOffset(w => w + delta)}
          />
        )}
        {vista === 'Mes' && (
          <MonthView onDayClick={(date) => {
            const dow = hoy.getDay()
            const mondayHoy = new Date(hoy)
            mondayHoy.setDate(hoy.getDate() - (dow === 0 ? 6 : dow - 1))
            mondayHoy.setHours(0, 0, 0, 0)
            const dowDate = date.getDay()
            const mondayDate = new Date(date)
            mondayDate.setDate(date.getDate() - (dowDate === 0 ? 6 : dowDate - 1))
            mondayDate.setHours(0, 0, 0, 0)
            const diffWeeks = Math.round((mondayDate.getTime() - mondayHoy.getTime()) / (7 * 86400000))
            setWeekOffset(diffWeeks)
            setVista('Semana')
          }} />
        )}

        {sel && (
          <ApptDetail
            a={sel}
            onClose={() => setSel(null)}
            onEdit={() => setEditCita(sel)}
            onDelete={() => handleDelete(sel)}
            onCobrar={() => setPosCita(sel)}
          />
        )}
      </div>

      {posCita && <POSBuilder citaOrigen={posCita} onClose={() => setPosCita(null)} onConfirm={confirmarVenta} />}

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

      {confirmDelete && (
        <ConfirmModal
          title="¿Eliminar cita?"
          desc={`Cita de ${confirmDelete.cl} — ${confirmDelete.srv} a las ${confirmDelete.h}. Esta acción no se puede deshacer.`}
          onConfirm={confirmDeleteFn}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

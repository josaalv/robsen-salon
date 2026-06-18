import React, { useState, useMemo } from 'react'
import { Avatar, CardHead, toast, Modal } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { useStore } from '../data/store'
import { mxn } from '../lib/helpers'
import type { Estilista } from '../types'

const COLORES = ['#C8A14A', '#93B58C', '#6FA6B8', '#C77B7B', '#B08AC7', '#E8CE8A']
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function EstilistaEditor({ est, onClose }: { est: Partial<Estilista> & { id?: string }; onClose: () => void }) {
  const { upsertEstilista, deleteEstilista } = useStore()
  const [nombre, setNombre] = useState(est.nombre || '')
  const [rol, setRol] = useState(est.rol || '')
  const [color, setColor] = useState(est.color || COLORES[0])
  const [comPct, setComPct] = useState(est.com ?? 30)

  const save = () => {
    const id = est.id || 'e' + Date.now()
    upsertEstilista({
      id, nombre, rol, color, com: comPct,
      ini: nombre.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
    })
    toast(est.id ? 'Perfil actualizado' : 'Estilista agregada')
    onClose()
  }

  const del = () => {
    if (!est.id) return
    if (!confirm('¿Eliminar estilista?')) return
    deleteEstilista(est.id)
    toast('Estilista eliminada')
    onClose()
  }

  return (
    <Modal onClose={onClose} width={480}>
      <div className="card-head">
        <div><div className="eyebrow">{est.id ? 'Editar' : 'Nueva'} estilista</div><h3 style={{ marginTop: 4 }}>Perfil y comisión</h3></div>
        <button className="icon-btn" onClick={onClose}><Ic n="x" /></button>
      </div>
      <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="field"><label>Nombre completo</label><input className="input" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Valeria Mendoza" /></div>
        <div className="field"><label>Especialidad / Rol</label><input className="input" value={rol} onChange={e => setRol(e.target.value)} placeholder="Ej. Color & Balayage" /></div>
        <div className="field">
          <label>Comisión base ({comPct}%)</label>
          <input className="input" type="number" min="0" max="100" value={comPct} onChange={e => setComPct(Number(e.target.value))} />
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Porcentaje sobre servicios y productos sin comisión personalizada por servicio.</div>
        </div>
        <div className="field">
          <label>Color de identificación</label>
          <div className="vc gap8">
            {COLORES.map(c => (
              <div
                key={c} onClick={() => setColor(c)}
                style={{ width: 30, height: 30, borderRadius: '50%', background: c, cursor: 'pointer',
                  boxShadow: color === c ? `0 0 0 2px var(--panel), 0 0 0 4px ${c}` : 'none' }}
              />
            ))}
          </div>
        </div>
        <div className="vc gap8 mt6">
          <button className="btn gold f1" style={{ justifyContent: 'center' }} onClick={save}><Ic n="check" />Guardar</button>
          {est.id && <button className="btn ghost" onClick={del} style={{ color: 'var(--st-canc)', borderColor: 'var(--st-canc)' }}><Ic n="trash" />Eliminar</button>}
        </div>
      </div>
    </Modal>
  )
}

function HorariosModal({ onClose }: { onClose: () => void }) {
  const { data } = useStore()
  const [horarios, setHorarios] = useState<Record<string, boolean[]>>(() =>
    Object.fromEntries(data.estilistas.map(e => [e.id, [true, true, true, true, true, true, false]]))
  )

  const toggle = (estId: string, day: number) => {
    setHorarios(h => ({ ...h, [estId]: h[estId].map((v, i) => i === day ? !v : v) }))
  }

  return (
    <Modal onClose={onClose} width={700}>
      <div className="card-head">
        <div><div className="eyebrow">Gestión de horarios</div><h3 style={{ marginTop: 4 }}>Disponibilidad del equipo</h3></div>
        <button className="icon-btn" onClick={onClose}><Ic n="x" /></button>
      </div>
      <div className="card-pad scroll-y" style={{ maxHeight: '60vh' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Profesional</th>
              {DIAS.map(d => <th key={d} style={{ textAlign: 'center' }}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.estilistas.map(e => (
              <tr key={e.id}>
                <td>
                  <div className="vc gap8">
                    <Avatar ini={e.ini} color={e.color} size="sm" />
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{e.nombre}</span>
                  </div>
                </td>
                {(horarios[e.id] || []).map((on, day) => (
                  <td key={day} style={{ textAlign: 'center' }}>
                    <div
                      onClick={() => toggle(e.id, day)}
                      style={{ height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: on ? 'rgba(147,181,140,0.15)' : 'transparent', color: on ? 'var(--st-conf)' : 'var(--text-4)', border: `1px solid ${on ? 'rgba(147,181,140,0.3)' : 'var(--line-soft)'}` }}
                    >
                      {on ? '9–19' : '—'}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card-pad" style={{ paddingTop: 14 }}>
        <div className="vc gap8">
          <button className="btn gold" onClick={() => { toast('Horarios guardados'); onClose() }}><Ic n="check" />Guardar horarios</button>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </Modal>
  )
}

export function ScreenEmpleados({ onNavigate }: { onNavigate: (r: string) => void }) {
  const { data } = useStore()
  const estilistas = data.estilistas
  const [selId, setSelId] = useState(estilistas[0]?.id || '')
  const [editor, setEditor] = useState<Partial<Estilista> & { id?: string } | null>(null)
  const [horarios, setHorarios] = useState(false)

  // Compute real metrics from ventas
  const metricas = useMemo(() => {
    const r: Record<string, { ventas: number; comision: number; citas: number }> = {}
    estilistas.forEach(e => { r[e.id] = { ventas: 0, comision: 0, citas: 0 } })
    data.ventas.forEach(v => {
      v.lineas.forEach(l => {
        if (!l.est || !r[l.est]) return
        const monto = l.precio * l.cant
        r[l.est].ventas += monto
        r[l.est].comision += Math.round(monto * (l.com || 0) / 100)
      })
      const mainEst = v.lineas.find(l => l.tipo === 'servicio')?.est
      if (mainEst && r[mainEst]) r[mainEst].citas++
    })
    return r
  }, [data.ventas, estilistas])

  const e = estilistas.find(x => x.id === selId) || estilistas[0]
  const sel = metricas[selId] || { ventas: 0, comision: 0, citas: 0 }
  const comPct = e?.com ?? 30
  const servReal = data.servicios.filter(s => s.prof.includes(selId))
  const comisionesMes = Object.values(metricas).reduce((s, m) => s + m.comision, 0)

  if (!e) return null

  return (
    <div>
      <div className="between" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="display" style={{ fontSize: 26, margin: 0 }}>Empleados y comisiones</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{estilistas.length} profesionales activas · comisiones acumuladas: {mxn(comisionesMes)}</div>
        </div>
        <div className="vc gap12">
          <button className="btn ghost" onClick={() => setHorarios(true)}><Ic n="calendar-blank" />Horarios</button>
          <button className="btn gold" onClick={() => setEditor({})}><Ic n="plus" />Nueva estilista</button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 360px', alignItems: 'start' }}>
        {/* Performance table */}
        <div className="card">
          <CardHead title="Rendimiento del equipo" sub="Ventas registradas en el sistema" />
          <table className="table" style={{ marginTop: 6 }}>
            <thead>
              <tr>
                <th>Profesional</th>
                <th className="num">Citas</th>
                <th className="num">Ventas</th>
                <th className="num">Comisión</th>
                <th>Com. %</th>
              </tr>
            </thead>
            <tbody>
              {estilistas.map(es => {
                const m = metricas[es.id] || { ventas: 0, comision: 0, citas: 0 }
                const pct = es.com ?? 30
                return (
                  <tr key={es.id} onClick={() => setSelId(es.id)} style={{ cursor: 'pointer', background: selId === es.id ? 'rgba(200,161,74,0.06)' : undefined }}>
                    <td>
                      <div className="cell-name">
                        <Avatar ini={es.ini} color={es.color} size="sm" />
                        <div><div className="nm">{es.nombre}</div><div className="meta">{es.rol}</div></div>
                      </div>
                    </td>
                    <td className="num">{m.citas}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{mxn(m.ventas)}</td>
                    <td className="num gold-text" style={{ fontWeight: 600 }}>{mxn(m.comision)}</td>
                    <td>
                      <div className="vc gap8">
                        <div className="bar" style={{ width: 64 }}><span style={{ width: pct + '%' }}></span></div>
                        <span className="num dim" style={{ fontSize: 11.5 }}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        <div className="card gold-edge" style={{ position: 'sticky', top: 92 }}>
          <div className="card-pad center" style={{ paddingBottom: 16 }}>
            <Avatar ini={e.ini} color={e.color} size="lg" />
            <h2 className="display" style={{ fontSize: 21, margin: '12px 0 4px' }}>{e.nombre}</h2>
            <div className="dim" style={{ fontSize: 12.5 }}>{e.rol}</div>
          </div>
          <hr className="hr" />
          <div className="card-pad grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="kpi-mini"><span className="l">Citas atendidas</span><span className="v">{sel.citas}</span></div>
            <div className="kpi-mini"><span className="l">Ventas generadas</span><span className="v">{mxn(sel.ventas)}</span></div>
            <div className="kpi-mini"><span className="l">Comisión ({comPct}%)</span><span className="v gold-text">{mxn(sel.comision)}</span></div>
            <div className="kpi-mini"><span className="l">Servicios asignados</span><span className="v">{servReal.length}</span></div>
          </div>
          <hr className="hr" />
          <div className="card-pad">
            <div className="eyebrow" style={{ marginBottom: 12 }}>Servicios que realiza</div>
            <div className="vc gap8" style={{ flexWrap: 'wrap' }}>
              {servReal.length
                ? servReal.map(s => <span key={s.id} className="chip">{s.nombre}</span>)
                : <span className="dim" style={{ fontSize: 12.5 }}>Sin servicios asignados aún</span>}
            </div>
            <div className="eyebrow mt24" style={{ marginBottom: 12 }}>Disponibilidad</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[['Lun – Vie', '09:00 – 19:00', true], ['Sábado', '09:00 – 16:00', true], ['Domingo', 'Descanso', false]].map(([d, h, on]) => (
                <div key={String(d)} className="between" style={{ fontSize: 13 }}>
                  <span className="muted">{d}</span>
                  <span style={{ fontWeight: 600, color: on ? 'var(--text)' : 'var(--text-4)' }}>{h}</span>
                </div>
              ))}
            </div>
            <button className="btn ghost w100 mt18" style={{ justifyContent: 'center' }} onClick={() => setEditor(e)}>
              <Ic n="sliders-horizontal" />Editar perfil y comisión
            </button>
          </div>
        </div>
      </div>

      {editor !== null && <EstilistaEditor est={editor} onClose={() => setEditor(null)} />}
      {horarios && <HorariosModal onClose={() => setHorarios(false)} />}
    </div>
  )
}

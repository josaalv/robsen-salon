import React, { useState, useMemo, useRef } from 'react'
import { Avatar, CardHead, toast, Modal } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { useStore } from '../data/store'
import { mxn, applyEscala } from '../lib/helpers'
import { db } from '../lib/db'
import type { EscalaTramo } from '../lib/helpers'
import type { Estilista, ComisionOverride } from '../types'

const COLORES = ['#C8A14A', '#93B58C', '#6FA6B8', '#C77B7B', '#B08AC7', '#E8CE8A']
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function EstilistaEditor({ est, onClose }: { est: Partial<Estilista> & { id?: string }; onClose: () => void }) {
  const { data, upsertEstilista, deleteEstilista } = useStore()
  const [tab, setTab] = useState('Perfil')
  const [nombre, setNombre] = useState(est.nombre || '')
  const [rol, setRol] = useState(est.rol || '')
  const [color, setColor] = useState(est.color || COLORES[0])
  const [comPct, setComPct] = useState(est.com ?? 30)
  const [comisiones, setComisiones] = useState<Record<string, number | ComisionOverride>>({ ...(est.comisiones || {}) })
  const [foto, setFoto] = useState(est.foto || '')
  const [bio, setBio] = useState(est.bio || '')
  const [uploading, setUploading] = useState(false)
  const fotoRef = useRef<HTMLInputElement>(null)

  const servReal = est.id ? data.servicios.filter(s => s.prof.includes(est.id!)) : []
  // Normaliza el override guardado (número suelto = porcentaje) a { tipo, valor }.
  const ovDe = (servicioId: string): ComisionOverride | undefined => {
    const v = comisiones[servicioId]
    if (v == null) return undefined
    return typeof v === 'number' ? { tipo: 'porcentaje', valor: v } : v
  }
  const setComTipo = (servicioId: string, tipo: 'porcentaje' | 'monto') =>
    setComisiones(prev => {
      const cur = ovDe(servicioId) || { tipo: 'porcentaje', valor: comPct }
      return { ...prev, [servicioId]: { tipo, valor: cur.valor } }
    })
  const setComValor = (servicioId: string, val: number) =>
    setComisiones(prev => {
      const cur = ovDe(servicioId) || { tipo: 'porcentaje' as const, valor: 0 }
      const max = cur.tipo === 'porcentaje' ? 100 : 1000000
      return { ...prev, [servicioId]: { tipo: cur.tipo, valor: Math.min(max, Math.max(0, val)) } }
    })
  const resetComOverride = (servicioId: string) =>
    setComisiones(prev => { const n = { ...prev }; delete n[servicioId]; return n })

  const onFotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const id = est.id || 'e' + Date.now()
      const url = await db.uploadMedia(`estilistas/${id}`, file)
      if (url) setFoto(url)
      else toast('Error al subir la imagen')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (saving) return
    setSaving(true)
    const id = est.id || 'e' + Date.now()
    try {
      await upsertEstilista({
        ...est as Estilista,
        id, nombre, rol, color, com: comPct, comisiones, foto: foto || undefined, bio: bio || undefined,
        ini: nombre.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
      })
      toast(est.id ? 'Perfil actualizado' : 'Estilista agregada')
      onClose()
    } catch {
      toast('No se pudo guardar la estilista. Intenta de nuevo.')
      setSaving(false)
    }
  }

  const del = async () => {
    if (!est.id || saving) return
    if (!confirm('¿Eliminar estilista?')) return
    setSaving(true)
    try {
      await deleteEstilista(est.id)
      toast('Estilista eliminada')
      onClose()
    } catch {
      toast('No se pudo eliminar la estilista. Intenta de nuevo.')
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} width={500}>
      <div className="card-head">
        <div><div className="eyebrow">{est.id ? 'Editar' : 'Nueva'} estilista</div><h3 style={{ marginTop: 4 }}>Perfil público y comisión</h3></div>
        <button className="icon-btn" onClick={onClose}><Ic n="x" /></button>
      </div>
      <div className="tabs" style={{ padding: '0 20px' }}>
        {['Perfil', 'Comisiones'].map(t => (
          <div key={t} className={'tab' + (tab === t ? ' active' : '')} onClick={() => setTab(t)}>{t}</div>
        ))}
      </div>
      {tab === 'Perfil' && (
      <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Foto */}
        <div className="field">
          <label>Foto de perfil <span className="muted" style={{ fontWeight: 400 }}>(visible en el sitio de agendamiento)</span></label>
          <div className="vc gap12">
            {foto
              ? <img src={foto} alt={nombre} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--line)' }} />
              : <div style={{ width: 64, height: 64, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#fff' }}>
                  {nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'}
                </div>
            }
            <div className="vc gap8">
              <input ref={fotoRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={onFotoFile} />
              <button className="btn ghost sm" disabled={uploading} onClick={() => fotoRef.current?.click()}>
                <Ic n="camera" />{uploading ? 'Subiendo…' : foto ? 'Cambiar foto' : 'Subir foto'}
              </button>
              {foto && <button className="btn ghost sm" style={{ color: 'var(--st-canc)' }} onClick={() => setFoto('')}><Ic n="trash" /></button>}
            </div>
          </div>
        </div>

        <div className="field"><label>Nombre completo</label><input className="input" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Valeria Mendoza" /></div>
        <div className="field"><label>Especialidad / Rol</label><input className="input" value={rol} onChange={e => setRol(e.target.value)} placeholder="Ej. Color & Balayage" /></div>

        {/* Bio */}
        <div className="field">
          <label>Descripción <span className="muted" style={{ fontWeight: 400 }}>(aparece en el perfil público)</span></label>
          <textarea className="input" rows={3} value={bio} onChange={e => setBio(e.target.value)}
            placeholder="Ej. Especialista en colorimetría con 8 años de experiencia. Me apasiona crear looks únicos para cada clienta."
            style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }} />
        </div>

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
      </div>
      )}

      {tab === 'Comisiones' && (
      <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!est.id ? (
          <div className="dim" style={{ fontSize: 12.5, textAlign: 'center', padding: '20px 0' }}>Guarda el perfil primero para poder configurar comisiones por servicio.</div>
        ) : (
          <>
            <div className="muted" style={{ fontSize: 12 }}>
              Por defecto cada servicio usa la comisión base ({comPct}%). Puedes definir una excepción por servicio, ya sea en <b>porcentaje</b> o en <b>monto fijo</b> ($).
            </div>
            {servReal.length === 0 && <div className="dim" style={{ fontSize: 12.5 }}>Esta estilista no tiene servicios asignados aún.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {servReal.map(s => {
                const ov = ovDe(s.id)
                const tipo = ov?.tipo ?? 'porcentaje'
                const val = ov ? ov.valor : comPct
                return (
                  <div key={s.id} className="between" style={{ padding: '8px 10px', border: '1px solid var(--line-soft)', borderRadius: 8, gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{s.nombre}</div>
                      <div className="muted" style={{ fontSize: 11 }}>
                        {mxn(s.precio)} · {ov != null
                          ? <span style={{ color: 'var(--gold)' }}>{tipo === 'monto' ? `comisión fija ${mxn(val)}` : 'personalizada'}</span>
                          : 'heredado'}
                      </div>
                    </div>
                    <div className="vc gap6" style={{ flexShrink: 0 }}>
                      <select className="select" value={tipo} onChange={e => setComTipo(s.id, e.target.value as 'porcentaje' | 'monto')}
                        style={{ width: 54, padding: '6px 20px 6px 8px', fontSize: 12 }}>
                        <option value="porcentaje">%</option>
                        <option value="monto">$</option>
                      </select>
                      <input
                        className="input" type="number" min="0" max={tipo === 'porcentaje' ? 100 : undefined} value={val}
                        style={{ width: 72, textAlign: 'right' }}
                        onChange={e => setComValor(s.id, Number(e.target.value))}
                      />
                      {ov != null && (
                        <button className="icon-btn" title="Restaurar comisión base" onClick={() => resetComOverride(s.id)}><Ic n="arrow-counter-clockwise" /></button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
      )}

      <div className="card-pad" style={{ paddingTop: 0 }}>
        <div className="vc gap8 mt6">
          <button className="btn gold f1" style={{ justifyContent: 'center', opacity: saving ? .6 : 1, pointerEvents: saving ? 'none' : 'auto' }} onClick={save}><Ic n="check" />{saving ? 'Guardando…' : 'Guardar'}</button>
          {est.id && <button className="btn ghost" onClick={del} style={{ color: 'var(--st-canc)', borderColor: 'var(--st-canc)', opacity: saving ? .6 : 1, pointerEvents: saving ? 'none' : 'auto' }}><Ic n="trash" />Eliminar</button>}
        </div>
      </div>
    </Modal>
  )
}

const DEFAULT_HORARIO = [true, true, true, true, true, true, false]

function HorariosModal({ onClose }: { onClose: () => void }) {
  const { data, upsertEstilista } = useStore()
  const cfg = data.config
  const [horarios, setHorarios] = useState<Record<string, boolean[]>>(() =>
    Object.fromEntries(data.estilistas.map(e => [e.id, e.horarios || [...DEFAULT_HORARIO]]))
  )

  const [saving, setSaving] = useState(false)

  const toggle = (estId: string, day: number) => {
    setHorarios(h => ({ ...h, [estId]: h[estId].map((v, i) => i === day ? !v : v) }))
  }

  const guardar = async () => {
    if (saving) return
    setSaving(true)
    try {
      for (const e of data.estilistas) {
        await upsertEstilista({ ...e, horarios: horarios[e.id] || [...DEFAULT_HORARIO] })
      }
      toast('Horarios guardados')
      onClose()
    } catch {
      toast('No se pudieron guardar todos los horarios. Revisa e intenta de nuevo.')
      setSaving(false)
    }
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
                      {on ? `${cfg.agendaStart}–${cfg.agendaEnd}` : '—'}
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
          <button className="btn gold" onClick={guardar} style={{ opacity: saving ? .6 : 1, pointerEvents: saving ? 'none' : 'auto' }}><Ic n="check" />{saving ? 'Guardando…' : 'Guardar horarios'}</button>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </Modal>
  )
}

function EscalaPanel({ ventasMes, escala }: { ventasMes: number; escala: EscalaTramo[] }) {
  const sorted = [...escala].sort((a, b) => (a.limite ?? Infinity) - (b.limite ?? Infinity))

  // Find active bracket index
  let activeIdx = sorted.length - 1
  for (let i = 0; i < sorted.length; i++) {
    if (ventasMes <= (sorted[i].limite ?? Infinity)) { activeIdx = i; break }
  }

  const active = sorted[activeIdx]
  const next = sorted[activeIdx + 1]
  const rangeStart = activeIdx === 0 ? 0 : (sorted[activeIdx - 1].limite ?? 0)
  const rangeEnd = active.limite
  const inRange = ventasMes - rangeStart
  const rangeSize = rangeEnd ? rangeEnd - rangeStart : 1
  const progress = rangeEnd ? Math.min(100, (inRange / rangeSize) * 100) : 100
  const faltante = rangeEnd ? Math.max(0, rangeEnd - ventasMes) : 0

  return (
    <div style={{ marginTop: 16, padding: '14px 16px', background: 'rgba(200,161,74,0.06)', border: '1px solid var(--line)', borderRadius: 10 }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>Escala de comisiones</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
        {sorted.map((t, i) => {
          const prevLim = i === 0 ? 0 : (sorted[i - 1].limite ?? 0)
          const isActive = i === activeIdx
          return (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 9px', borderRadius: 7, fontSize: 12,
              background: isActive ? 'rgba(200,161,74,0.12)' : 'transparent',
              border: `1px solid ${isActive ? 'var(--line-strong)' : 'transparent'}`,
              color: isActive ? 'var(--text)' : 'var(--text-3)',
              fontWeight: isActive ? 600 : 400,
            }}>
              <span>{mxn(prevLim)} – {t.limite ? mxn(t.limite) : '∞'}</span>
              <span style={{ color: isActive ? 'var(--gold)' : undefined }}>{t.pct}%</span>
            </div>
          )
        })}
      </div>
      {rangeEnd != null && (
        <>
          <div className="bar" style={{ marginBottom: 5 }}>
            <span style={{ width: progress + '%' }} />
          </div>
          <div className="between" style={{ fontSize: 11, color: 'var(--text-4)' }}>
            <span>{mxn(ventasMes)} en tramo</span>
            {faltante > 0 && next
              ? <span>{mxn(faltante)} para {next.pct}%</span>
              : <span>{mxn(rangeEnd)}</span>}
          </div>
        </>
      )}
      {rangeEnd == null && (
        <div style={{ fontSize: 11.5, color: 'var(--gold)', textAlign: 'center' }}>
          Tramo máximo alcanzado
        </div>
      )}
    </div>
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
    const escalaConfig = data.config?.escalaComisiones || []
    const useEscalaLocal = escalaConfig.length > 0
    const mes = new Date().toLocaleDateString('es-MX', { month: 'short' }).toLowerCase()

    const r: Record<string, { ventas: number; comision: number; citas: number; ventasMes: number }> = {}
    estilistas.forEach(e => { r[e.id] = { ventas: 0, comision: 0, citas: 0, ventasMes: 0 } })
    data.ventas.forEach(v => {
      const esMes = v.fecha.toLowerCase().includes(mes)
      v.lineas.forEach(l => {
        if (!l.est || !r[l.est]) return
        const monto = l.precio * l.cant
        r[l.est].ventas += monto
        if (esMes) r[l.est].ventasMes += monto
        if (!useEscalaLocal) r[l.est].comision += l.comMonto != null
          ? Math.round(l.comMonto * l.cant)
          : Math.round(monto * (l.com || 0) / 100)
      })
      const mainEst = v.lineas.find(l => l.tipo === 'servicio')?.est
      if (mainEst && r[mainEst]) r[mainEst].citas++
    })
    if (useEscalaLocal) {
      Object.keys(r).forEach(id => { r[id].comision = applyEscala(r[id].ventasMes, escalaConfig) })
    }
    return r
  }, [data.ventas, estilistas, data.config?.escalaComisiones])

  const escalaConfig = data.config?.escalaComisiones || []
  const useEscala = escalaConfig.length > 0
  const e = estilistas.find(x => x.id === selId) || estilistas[0]
  const sel = metricas[selId] || { ventas: 0, comision: 0, citas: 0, ventasMes: 0 }
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
          <CardHead
            title="Rendimiento del equipo"
            sub={useEscala ? 'Ventas y comisiones del mes · escala progresiva activa' : 'Ventas registradas en el sistema'}
          />
          <table className="table" style={{ marginTop: 6 }}>
            <thead>
              <tr>
                <th>Profesional</th>
                <th className="num">Citas</th>
                <th className="num">{useEscala ? 'Ventas (mes)' : 'Ventas'}</th>
                <th className="num">Comisión</th>
                <th>{useEscala ? 'Tramo' : 'Com. %'}</th>
              </tr>
            </thead>
            <tbody>
              {estilistas.map(es => {
                const m = metricas[es.id] || { ventas: 0, comision: 0, citas: 0, ventasMes: 0 }
                const ventasRef = useEscala ? m.ventasMes : m.ventas
                const pct = es.com ?? 30
                const efectivoPct = useEscala && m.ventasMes > 0
                  ? Math.round(m.comision / m.ventasMes * 100) : null
                return (
                  <tr key={es.id} onClick={() => setSelId(es.id)} style={{ cursor: 'pointer', background: selId === es.id ? 'rgba(200,161,74,0.06)' : undefined }}>
                    <td>
                      <div className="cell-name">
                        {es.foto
                          ? <img src={es.foto} alt={es.nombre} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          : <Avatar ini={es.ini} color={es.color} size="sm" />
                        }
                        <div><div className="nm">{es.nombre}</div><div className="meta">{es.rol}</div></div>
                      </div>
                    </td>
                    <td className="num">{m.citas}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{mxn(ventasRef)}</td>
                    <td className="num gold-text" style={{ fontWeight: 600 }}>{mxn(m.comision)}</td>
                    <td>
                      {useEscala ? (
                        <span className="badge neutral" style={{ fontSize: 10.5 }}>
                          {efectivoPct != null ? `≈${efectivoPct}%` : 'Escala'}
                        </span>
                      ) : (
                        <div className="vc gap8">
                          <div className="bar" style={{ width: 64 }}><span style={{ width: pct + '%' }}></span></div>
                          <span className="num dim" style={{ fontSize: 11.5 }}>{pct}%</span>
                        </div>
                      )}
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
            {e.foto
              ? <img src={e.foto} alt={e.nombre} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--line)' }} />
              : <Avatar ini={e.ini} color={e.color} size="lg" />
            }
            <h2 className="display" style={{ fontSize: 21, margin: '12px 0 4px' }}>{e.nombre}</h2>
            <div className="dim" style={{ fontSize: 12.5 }}>{e.rol}</div>
            {e.bio && <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 10, lineHeight: 1.55, textAlign: 'center', maxWidth: 280 }}>{e.bio}</p>}
          </div>
          <hr className="hr" />
          <div className="card-pad grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="kpi-mini"><span className="l">Citas atendidas</span><span className="v">{sel.citas}</span></div>
            <div className="kpi-mini"><span className="l">{useEscala ? 'Ventas del mes' : 'Ventas generadas'}</span><span className="v">{mxn(useEscala ? sel.ventasMes : sel.ventas)}</span></div>
            <div className="kpi-mini"><span className="l">{useEscala ? 'Comisión (mes)' : `Comisión (${comPct}%)`}</span><span className="v gold-text">{mxn(sel.comision)}</span></div>
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
              {DIAS.map((d, i) => {
                const on = (e.horarios || DEFAULT_HORARIO)[i]
                return (
                  <div key={d} className="between" style={{ fontSize: 13 }}>
                    <span className="muted">{d}</span>
                    <span style={{ fontWeight: 600, color: on ? 'var(--text)' : 'var(--text-4)' }}>
                      {on ? `${String(data.config.agendaStart).padStart(2,'0')}:00 – ${String(data.config.agendaEnd).padStart(2,'0')}:00` : 'Descanso'}
                    </span>
                  </div>
                )
              })}
            </div>
            {useEscala && <EscalaPanel ventasMes={sel.ventasMes} escala={escalaConfig} />}
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

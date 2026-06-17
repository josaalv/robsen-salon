import React, { useState, useMemo } from 'react'
import { Avatar, EstadoBadge, ClienteBadge, CardHead, Seg, toast } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { useStore } from '../data/store'
import { mxn, helpers } from '../lib/helpers'
import type { Clienta, EstadoClienta } from '../types'

function ClientaModal({ c, onClose, onSaved }: { c: Partial<Clienta>; onClose: () => void; onSaved: () => void }) {
  const { data, upsertClienta } = useStore()
  const nuevo = !c.id
  const [nombre, setNombre] = useState(c.nombre || '')
  const [tel, setTel] = useState(c.tel || '')
  const [estado, setEstado] = useState<EstadoClienta>(c.estado || 'Nueva')
  const [est, setEst] = useState(c.est || data.estilistas[0].id)
  const [fav, setFav] = useState(c.fav || data.servicios[0].nombre)
  const [cumple, setCumple] = useState(c.cumple || '')
  const [ciclo, setCiclo] = useState(c.ciclo || 8)

  const estadosCl: EstadoClienta[] = ['VIP', 'Frecuente', 'Activa', 'Nueva', 'Inactiva']

  const guardar = () => {
    if (!nombre.trim()) return
    const id = c.id || ('c' + Date.now())
    const ini = nombre.trim().split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    upsertClienta({
      ...(c.id ? c as Clienta : {}),
      id,
      nombre: nombre.trim(),
      tel,
      estado,
      est,
      fav,
      cumple: cumple || '01 Ene',
      ciclo: +ciclo || 8,
      ini,
      ultima: c.ultima || '17 Jun 2026',
      ticket: c.ticket || 0,
      visitas: c.visitas || 0,
      gasto: c.gasto || 0,
    })
    onSaved()
  }

  return (
    <div className="rb-modal-bg" onClick={onClose}>
      <div className="card gold-edge rb-modal" onClick={e => e.stopPropagation()} style={{ width: 520, maxWidth: '94vw' }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">{nuevo ? 'Registrar' : 'Editar'} clienta</div>
            <h3 style={{ marginTop: 6 }}>{nuevo ? 'Nueva clienta' : c.nombre}</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><Ic n="x" /></button>
        </div>
        <div className="card-pad" style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Nombre completo</label>
              <input className="input" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Ana Sofía Beltrán" />
            </div>
            <div className="field">
              <label>Teléfono (WhatsApp)</label>
              <input className="input" value={tel} onChange={e => setTel(e.target.value)} placeholder="33 0000 0000" />
            </div>
            <div className="field">
              <label>Estado</label>
              <select className="select" value={estado} onChange={e => setEstado(e.target.value as EstadoClienta)}>
                {estadosCl.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Estilista habitual</label>
              <select className="select" value={est} onChange={e => setEst(e.target.value)}>
                {data.estilistas.map(es => <option key={es.id} value={es.id}>{es.nombre}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Servicio favorito</label>
              <select className="select" value={fav} onChange={e => setFav(e.target.value)}>
                {data.servicios.map(s => <option key={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Cumpleaños (ej. 14 Ago)</label>
              <input className="input" value={cumple} onChange={e => setCumple(e.target.value)} placeholder="14 Ago" />
            </div>
            <div className="field">
              <label>Ciclo de recompra (semanas)</label>
              <input className="input num" type="number" value={ciclo} onChange={e => setCiclo(+e.target.value)} />
            </div>
          </div>
        </div>
        <hr className="hr" />
        <div className="card-pad vc gap12" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button
            className="btn gold"
            onClick={guardar}
            style={{ opacity: nombre.trim() ? 1 : .4, pointerEvents: nombre.trim() ? 'auto' : 'none' }}
          >
            <Ic n="check" />{nuevo ? 'Registrar clienta' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ClientaPerfil({ c, onBack, onEdit, onDelete, editCl, setEditCl }: {
  c: Clienta
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  editCl: Partial<Clienta> | null
  setEditCl: (c: Partial<Clienta> | null) => void
}) {
  const { data } = useStore()
  const [tab, setTab] = useState('Historial')
  const e = data.estilistas.find(est => est.id === c.est) || data.estilistas[0]

  const ventasCl = data.ventas.filter(v => v.cliente === c.nombre).map(v => ({
    f: v.fecha,
    ticket: v.ticket,
    srv: v.lineas.map(l => (l.cant > 1 ? l.cant + '× ' : '') + l.nombre).join(', '),
    est: [...new Set(v.lineas.filter(l => l.est).map(l => {
      const es = data.estilistas.find(es => es.id === l.est)
      return es ? es.nombre : ''
    }))].filter(Boolean).join(', ') || '—',
    total: v.lineas.reduce((s, l) => s + l.precio * l.cant, 0) - (v.desc || 0),
    estado: v.estado === 'parcial' ? 'pend' : 'done',
  }))

  const historialBase = [
    { f: '12 May 2026', srv: 'Retoque de raíz', est: e.nombre, total: 950, estado: 'done', ticket: '' },
    { f: '20 Abr 2026', srv: 'Corte & Peinado', est: 'Renata Ochoa', total: 680, estado: 'done', ticket: '' },
    { f: '15 Mar 2026', srv: 'Tratamiento de Keratina', est: 'Mariana Salgado', total: 2400, estado: 'done', ticket: '' },
    { f: '02 Mar 2026', srv: 'Balayage Premium', est: e.nombre, total: 2800, estado: 'done', ticket: '' },
  ]
  const historial = [...ventasCl, ...historialBase]

  const ins = helpers.insights(c)
  const salud = ins.riesgo === 'fuga'
    ? ['En fuga', 'var(--st-canc)']
    : ins.riesgo === 'riesgo'
    ? ['En riesgo', 'var(--st-pend)']
    : ['Clienta sana', 'var(--st-conf)']

  return (
    <div>
      <div className="between" style={{ marginBottom: 18 }}>
        <button className="btn ghost sm" onClick={onBack}><Ic n="arrow-left" />Volver a clientas</button>
        <div className="vc gap8">
          <button className="btn ghost sm" onClick={onEdit}><Ic n="pencil-simple" />Editar</button>
          <button className="btn ghost sm" style={{ color: 'var(--st-canc)' }} onClick={() => { if (confirm('¿Eliminar a ' + c.nombre + '?')) onDelete() }}>
            <Ic n="trash" />Eliminar
          </button>
        </div>
      </div>
      {editCl && <ClientaModal c={editCl} onClose={() => setEditCl(null)} onSaved={() => setEditCl(null)} />}

      <div className="grid" style={{ gridTemplateColumns: '340px 1fr', alignItems: 'start' }}>
        {/* Tarjeta perfil */}
        <div className="card gold-edge" style={{ position: 'sticky', top: 92 }}>
          <div className="card-pad center" style={{ paddingBottom: 18 }}>
            <Avatar ini={c.ini} size="lg" />
            <h2 className="display" style={{ fontSize: 23, margin: '14px 0 6px' }}>{c.nombre}</h2>
            <ClienteBadge estado={c.estado} />
            <div className="vc gap8 mt14" style={{ justifyContent: 'center' }}>
              <button className="btn gold sm" onClick={() => toast('Abriendo agenda...')}><Ic n="calendar-plus" />Agendar</button>
              <button className="btn ghost sm" onClick={() => toast('Abriendo WhatsApp...')}><Ic n="whatsapp-logo" />Mensaje</button>
            </div>
          </div>
          <hr className="hr" />
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {([['phone', 'Teléfono', c.tel], ['calendar-blank', 'Última visita', c.ultima], ['scissors', 'Servicio favorito', c.fav], ['user', 'Estilista habitual', e.nombre]] as [string, string, string][]).map(([ic, l, v]) => (
              <div key={l} className="vc gap12">
                <span style={{ color: 'var(--gold)', width: 18 }}><Ic n={ic} /></span>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{l}</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{v}</div>
                </div>
              </div>
            ))}
          </div>
          <hr className="hr" />
          {/* Retención */}
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="eyebrow">Retención</div>
            <div className="between">
              <span className="vc gap10" style={{ fontSize: 13 }}>
                <span className="dotc" style={{ background: salud[1], width: 10, height: 10 }}></span>Salud de la clienta
              </span>
              <span style={{ fontWeight: 600, fontSize: 13, color: salud[1] }}>{salud[0]}</span>
            </div>
            <div className="card" style={{ background: 'var(--surface)', padding: 14 }}>
              <div className="vc gap10" style={{ marginBottom: 6 }}>
                <span style={{ color: 'var(--st-pay)' }}><Ic n="arrows-clockwise" /></span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>Próxima visita sugerida</span>
              </div>
              <div className="between">
                <span className="muted" style={{ fontSize: 12.5 }}>{c.fav} · cada {c.ciclo} sem</span>
                <span style={{ fontWeight: 600, fontSize: 13, color: ins.recompra === 'aldia' ? 'var(--text)' : 'var(--st-pend)' }}>
                  {ins.proxStr.replace(' 2026', '')}
                </span>
              </div>
            </div>
            <div className="between" style={{ fontSize: 13 }}>
              <span className="vc gap10"><span style={{ color: 'var(--gold)' }}><Ic n="gift" /></span>Cumpleaños</span>
              <span style={{ fontWeight: 600 }}>{c.cumple} <span className="dim" style={{ fontWeight: 400 }}>· en {ins.cumpleDias} d</span></span>
            </div>
          </div>
          <hr className="hr" />
          <div className="card-pad grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="kpi-mini"><span className="l">Visitas</span><span className="v">{c.visitas}</span></div>
            <div className="kpi-mini"><span className="l">Gasto total</span><span className="v gold-text">{mxn(c.gasto)}</span></div>
            <div className="kpi-mini"><span className="l">Ticket prom.</span><span className="v">{mxn(c.ticket)}</span></div>
            <div className="kpi-mini"><span className="l">Antigüedad</span><span className="v">2.3<span style={{ fontSize: 13, color: 'var(--text-3)' }}> años</span></span></div>
          </div>
        </div>

        {/* Contenido tabs */}
        <div className="card">
          <div className="tabs" style={{ padding: '0 8px' }}>
            {['Historial', 'Fórmulas de color', 'Preferencias', 'Antes / Después'].map(t => (
              <div key={t} className={'tab' + (tab === t ? ' active' : '')} onClick={() => setTab(t)}>{t}</div>
            ))}
          </div>
          <div className="card-pad">
            {tab === 'Historial' && (
              <table className="table" style={{ marginTop: -6 }}>
                <thead>
                  <tr><th>Fecha</th><th>Servicio / Productos</th><th>Estilista</th><th className="num">Total</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {historial.map((h, i) => (
                    <tr key={i} style={{ cursor: 'default' }}>
                      <td className="muted">
                        {h.f}
                        {h.ticket && <span className="num" style={{ color: 'var(--gold)', marginLeft: 8, fontSize: 11.5 }}>{h.ticket}</span>}
                      </td>
                      <td style={{ fontWeight: 600 }}>{h.srv}</td>
                      <td className="muted">{h.est}</td>
                      <td className="num" style={{ fontWeight: 600 }}>{mxn(h.total)}</td>
                      <td><EstadoBadge k={h.estado} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 'Fórmulas de color' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {([['Base · 08 Jun 2026', '7.1 (40g) + 9.1 (20g) · Oxidante 20 vol · 35 min', '#8a7355'], ['Mechas · 02 Mar 2026', 'Decolorante + 0.31 matiz ceniza · 25 min', '#b9a989'], ['Tono · 12 May 2026', '6.0 raíz + gloss perla · 20 vol · 30 min', '#6e5a44']] as [string, string, string][]).map(([t, f, col], i) => (
                  <div key={i} className="card" style={{ background: 'var(--surface)', padding: 16 }}>
                    <div className="between">
                      <div className="vc gap12">
                        <span style={{ width: 30, height: 30, borderRadius: 8, background: col, border: '1px solid var(--line-soft)', display: 'inline-block' }}></span>
                        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{t}</span>
                      </div>
                      <button className="btn sm ghost"><Ic n="copy" /></button>
                    </div>
                    <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>{f}</div>
                  </div>
                ))}
              </div>
            )}
            {tab === 'Preferencias' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {['Tono ceniza', 'Sin amoniaco', 'Café de bienvenida', 'Música relajada', 'Cita matutina', 'Alérgica a PPD', 'Prefiere a Valeria', 'Agua mineral'].map(p => (
                  <span key={p} className="chip"><Ic n="check" />{p}</span>
                ))}
                <div className="field w100 mt14">
                  <label>Notas del equipo</label>
                  <div className="card" style={{ background: 'var(--surface)', padding: 14, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                    Clienta VIP, muy puntual. Le gusta agendar los lunes por la mañana. Festeja su cumpleaños el 14 de agosto — enviar promo especial. Recomendó a 3 amigas este año.
                  </div>
                </div>
              </div>
            )}
            {tab === 'Antes / Después' && (
              <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
                {(['Balayage · Jun', 'Color · May', 'Keratina · Mar'] as string[]).map((l, i) => (
                  <div key={i} className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div className="imgph" style={{ minHeight: 130 }}><Ic n="image" /><span>ANTES</span><span style={{ opacity: .6 }}>{l}</span></div>
                    <div className="imgph" style={{ minHeight: 130 }}><Ic n="image" /><span>DESPUÉS</span><span style={{ opacity: .6 }}>{l}</span></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CRMRetencion({ onPerfil }: { onPerfil: (c: Clienta) => void }) {
  const { data } = useStore()

  const recompra = data.clientas.map(c => ({ c, i: helpers.insights(c) }))
    .filter(x => x.i.recompra !== 'aldia')
    .sort((a, b) => b.i.dias - a.i.dias)

  const riesgo = data.clientas.map(c => ({ c, i: helpers.insights(c) }))
    .filter(x => x.i.riesgo !== 'sana')
    .sort((a, b) => (a.i.riesgo === 'fuga' ? 0 : 1) - (b.i.riesgo === 'fuga' ? 0 : 1) || b.i.dias - a.i.dias)

  const cumples = data.clientas.map(c => ({ c, i: helpers.insights(c) }))
    .filter(x => x.i.cumpleDias <= 30)
    .sort((a, b) => a.i.cumpleDias - b.i.cumpleDias)

  return (
    <div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 18 }}>
        <div className="card card-pad vc gap16">
          <div className="ico" style={{ width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(206,156,182,0.12)', border: '1px solid rgba(206,156,182,0.30)', color: 'var(--st-pay)' }}>
            <Ic n="arrows-clockwise" />
          </div>
          <div className="kpi-mini"><span className="l">Por reagendar</span><span className="v">{recompra.length}</span></div>
        </div>
        <div className="card card-pad vc gap16">
          <div className="ico" style={{ width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(199,123,123,0.12)', border: '1px solid rgba(199,123,123,0.28)', color: 'var(--st-canc)' }}>
            <Ic n="warning-circle" />
          </div>
          <div className="kpi-mini"><span className="l">En riesgo de fuga</span><span className="v">{riesgo.length}</span></div>
        </div>
        <div className="card card-pad vc gap16">
          <div className="ico" style={{ width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(200,161,74,0.10)', border: '1px solid var(--line)', color: 'var(--gold)' }}>
            <Ic n="gift" />
          </div>
          <div className="kpi-mini"><span className="l">Cumpleaños (30 días)</span><span className="v">{cumples.length}</span></div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
        {/* Recompra inteligente */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <CardHead title="Le toca volver · recompra" sub="Según el ciclo de cada servicio" right={<span className="badge pay"><span className="d"></span>{recompra.length} clientas</span>} />
          <table className="table" style={{ marginTop: 6 }}>
            <thead><tr><th>Clienta</th><th>Servicio habitual</th><th>Última visita</th><th>Sugerida</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {recompra.map(({ c, i }) => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => onPerfil(c)}>
                  <td><div className="cell-name"><Avatar ini={c.ini} size="sm" /><div className="nm">{c.nombre}</div></div></td>
                  <td className="muted">{c.fav} · cada {c.ciclo} sem</td>
                  <td className="muted">hace {i.dias} días</td>
                  <td className="muted">{i.proxStr.replace(' 2026', '')}</td>
                  <td>
                    {i.recompra === 'atrasada'
                      ? <span className="badge canc"><span className="d"></span>Atrasada</span>
                      : <span className="badge pend"><span className="d"></span>Le toca</span>}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className="btn sm line" onClick={() => toast('Mensaje de WhatsApp enviado')}><Ic n="whatsapp-logo" />Reagendar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Riesgo de fuga */}
        <div className="card">
          <CardHead title="Riesgo de fuga" sub="Clientas que podrías estar perdiendo" />
          <div className="card-pad" style={{ paddingTop: 8 }}>
            {riesgo.map(({ c, i }) => (
              <div key={c.id} className="list-item" style={{ padding: '13px 0', cursor: 'pointer' }} onClick={() => onPerfil(c)}>
                <Avatar ini={c.ini} size="sm" />
                <div className="f1" style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.nombre}</div>
                  <div className="vc gap8" style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>
                    {i.riesgo === 'fuga'
                      ? <span className="badge canc"><span className="d"></span>En fuga</span>
                      : <span className="badge pend"><span className="d"></span>En riesgo</span>}
                    <span>Sin venir hace {i.dias} días</span>
                  </div>
                </div>
              </div>
            ))}
            <button className="btn line w100 mt14" style={{ justifyContent: 'center' }} onClick={() => toast('Campaña de reactivación enviada')}>
              <Ic n="sparkle" />Campaña de reactivación
            </button>
          </div>
        </div>

        {/* Cumpleaños */}
        <div className="card">
          <CardHead title="Próximos cumpleaños" sub="Detalle especial = clienta feliz" />
          <div className="card-pad" style={{ paddingTop: 8 }}>
            {cumples.map(({ c, i }) => (
              <div key={c.id} className="list-item" style={{ padding: '13px 0' }}>
                <div style={{ width: 38, height: 38, flex: '0 0 38px', borderRadius: 10, background: 'rgba(200,161,74,0.10)', border: '1px solid var(--line)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Ic n="gift" />
                </div>
                <div className="f1" style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.nombre}</div>
                  <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>
                    {c.cumple} · {i.cumpleDias === 0 ? '¡hoy!' : 'en ' + i.cumpleDias + ' días'}
                  </div>
                </div>
                <button className="btn sm line" onClick={() => toast('Felicitación enviada por WhatsApp')}><Ic n="whatsapp-logo" />Felicitar</button>
              </div>
            ))}
            {!cumples.length && <div className="dim center" style={{ padding: 24 }}>Sin cumpleaños en los próximos 30 días</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ScreenCRM({ onNavigate }: { onNavigate: (r: string) => void }) {
  const { data, deleteClienta } = useStore()
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('Todas')
  const [sort, setSort] = useState<{ k: keyof Clienta; dir: number }>({ k: 'ultima', dir: -1 })
  const [perfil, setPerfil] = useState<Clienta | null>(null)
  const [vista, setVista] = useState('Clientas')
  const [editCl, setEditCl] = useState<Partial<Clienta> | null>(null)

  const filtros = ['Todas', 'VIP', 'Frecuente', 'Activa', 'Nueva', 'Inactiva']

  const rows = useMemo(() => {
    let r = data.clientas.filter(c =>
      (filtro === 'Todas' || c.estado === filtro) &&
      (c.nombre.toLowerCase().includes(q.toLowerCase()) || c.tel.includes(q))
    )
    const { k, dir } = sort
    r = [...r].sort((a, b) => {
      const av = a[k], bv = b[k]
      if (typeof av === 'string') return (av as string).localeCompare(bv as string) * dir
      return ((av as number) - (bv as number)) * dir
    })
    return r
  }, [q, filtro, sort, data.clientas])

  const toggleSort = (k: keyof Clienta) => setSort(s => s.k === k ? { k, dir: -s.dir } : { k, dir: 1 })
  const Caret = ({ k }: { k: keyof Clienta }) => sort.k === k ? <span className="caret">{sort.dir === 1 ? '▲' : '▼'}</span> : <span className="caret">↕</span>

  if (perfil) return (
    <ClientaPerfil
      c={perfil}
      onBack={() => setPerfil(null)}
      onEdit={() => setEditCl(perfil)}
      onDelete={() => { deleteClienta(perfil.id); setPerfil(null) }}
      editCl={editCl}
      setEditCl={setEditCl}
    />
  )

  return (
    <div>
      <div className="between" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="display" style={{ fontSize: 26, margin: 0 }}>CRM de clientas</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{data.clientas.length} clientas registradas · 6 nuevas este mes</div>
        </div>
        <div className="vc gap12">
          <Seg opts={['Clientas', 'Retención']} value={vista} onChange={setVista} />
          <button className="btn ghost" onClick={() => toast('Importar clientas desde CSV')}><Ic n="upload-simple" />Importar</button>
          <button className="btn gold" onClick={() => setEditCl({})}><Ic n="plus" />Nueva clienta</button>
        </div>
      </div>

      {vista === 'Retención' ? <CRMRetencion onPerfil={setPerfil} /> : (
        <>
          {/* Mini KPIs */}
          <div className="grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: 18 }}>
            {([['VIP', 3, 'crown-simple', 'var(--gold)'], ['Frecuentes', 3, 'repeat', 'var(--st-frec)'], ['Activas', 3, 'check-circle', 'var(--st-conf)'], ['Nuevas', 1, 'user-plus', '#8FB2D8'], ['Inactivas', 2, 'user-minus', 'var(--st-canc)']] as [string, number, string, string][]).map(([l, n, ic, c]) => (
              <div key={l} className="card card-pad vc gap12" style={{ cursor: 'pointer' }} onClick={() => setFiltro(l === 'Frecuentes' ? 'Frecuente' : l === 'Activas' ? 'Activa' : l === 'Nuevas' ? 'Nueva' : l === 'Inactivas' ? 'Inactiva' : 'VIP')}>
                <div className="ico" style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line-soft)', color: c }}>
                  <Ic n={ic} />
                </div>
                <div className="kpi-mini"><span className="v" style={{ fontSize: 20 }}>{n}</span><span className="l">{l}</span></div>
              </div>
            ))}
          </div>

          <div className="card">
            {/* Toolbar */}
            <div className="card-pad between" style={{ paddingBottom: 16, flexWrap: 'wrap', gap: 14 }}>
              <div className="search" style={{ width: 320 }}>
                <Ic n="magnifying-glass" />
                <input placeholder="Buscar por nombre o teléfono…" value={q} onChange={e => setQ(e.target.value)} />
              </div>
              <div className="vc gap8" style={{ flexWrap: 'wrap' }}>
                {filtros.map(f => (
                  <button key={f} className="chip" style={filtro === f ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : {}} onClick={() => setFiltro(f)}>{f}</button>
                ))}
              </div>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th className="sortable" onClick={() => toggleSort('nombre')}>Clienta <Caret k="nombre" /></th>
                  <th>Estado</th>
                  <th className="sortable" onClick={() => toggleSort('tel')}>Teléfono</th>
                  <th className="sortable" onClick={() => toggleSort('ultima')}>Última visita <Caret k="ultima" /></th>
                  <th className="sortable num" onClick={() => toggleSort('ticket')}>Ticket prom. <Caret k="ticket" /></th>
                  <th>Servicio favorito</th>
                  <th>Estilista</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(c => {
                  const e = data.estilistas.find(es => es.id === c.est) || data.estilistas[0]
                  const ins = helpers.insights(c)
                  const visitCol = ins.recompra === 'atrasada' ? 'var(--st-canc)' : ins.recompra === 'toca' ? 'var(--st-pend)' : 'var(--st-conf)'
                  const visitTip = ins.recompra === 'atrasada' ? 'Atrasada para recompra' : ins.recompra === 'toca' ? 'Le toca volver' : 'Al día'
                  return (
                    <tr key={c.id} onClick={() => setPerfil(c)}>
                      <td>
                        <div className="cell-name">
                          <Avatar ini={c.ini} size="sm" />
                          <div>
                            <div className="nm">{c.nombre}</div>
                            <div className="meta">{c.visitas} visitas · {mxn(c.gasto)}</div>
                          </div>
                        </div>
                      </td>
                      <td><ClienteBadge estado={c.estado} /></td>
                      <td className="num muted">{c.tel}</td>
                      <td className="muted">
                        <span className="vc" style={{ gap: 7 }} title={visitTip}>
                          <span className="dotc" style={{ background: visitCol }}></span>{c.ultima}
                        </span>
                      </td>
                      <td className="num" style={{ fontWeight: 600 }}>{mxn(c.ticket)}</td>
                      <td className="muted">{c.fav}</td>
                      <td>
                        <span className="vc" style={{ gap: 7, fontSize: 12.5 }}>
                          <span className="dotc" style={{ background: e.color }}></span>{e.nombre.split(' ')[0]}
                        </span>
                      </td>
                      <td><Ic n="caret-right" /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editCl !== null && <ClientaModal c={editCl} onClose={() => setEditCl(null)} onSaved={() => setEditCl(null)} />}
    </div>
  )
}

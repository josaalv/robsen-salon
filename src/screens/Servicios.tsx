import React, { useState, useMemo } from 'react'
import { Avatar, Switch, toast, Modal } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { useStore } from '../data/store'
import { mxn } from '../lib/helpers'
import type { Servicio, Estilista } from '../types'

export function ScreenServicios({ onNavigate }: { onNavigate: (r: string) => void }) {
  const [cat, setCat] = useState('Todos')
  const [q, setQ] = useState('')
  const [editor, setEditor] = useState<Partial<Servicio> | null>(null)
  const { data, upsertServicio, deleteServicio } = useStore()

  const servicios = data.servicios
  const estilistas = data.estilistas
  const comisiones = data.config?.comisiones || {}
  const anticipoPct = data.config?.anticipoPct ?? 35

  const rawCats = Array.from(new Set(servicios.map(s => s.cat)))
  const cats = ['Todos', ...rawCats]

  // Stats per service from real ventas
  const srvStats = useMemo(() => {
    const acc: Record<string, { veces: number; ingresos: number }> = {}
    data.ventas.forEach(v => {
      v.lineas.filter(l => l.tipo === 'servicio').forEach(l => {
        if (!acc[l.nombre]) acc[l.nombre] = { veces: 0, ingresos: 0 }
        acc[l.nombre].veces += l.cant
        acc[l.nombre].ingresos += l.precio * l.cant
      })
    })
    return acc
  }, [data.ventas])

  const lista = servicios
    .filter(s => cat === 'Todos' || s.cat === cat)
    .filter(s => !q || s.nombre.toLowerCase().includes(q.toLowerCase()) || s.cat.toLowerCase().includes(q.toLowerCase()))

  return (
    <div>
      <div className="between" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="display" style={{ fontSize: 26, margin: 0 }}>Servicios y paquetes</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            {servicios.length} servicios en {rawCats.length} categorías · {servicios.filter(s => s.online).length} disponibles en línea
          </div>
        </div>
        <div className="vc gap10">
          <div className="search">
            <Ic n="magnifying-glass" />
            <input placeholder="Buscar servicio…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <button className="btn gold" onClick={() => setEditor({})}>
            <Ic n="plus" />Nuevo servicio
          </button>
        </div>
      </div>

      <div className="vc gap8" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
        {cats.map(c => (
          <button
            key={c}
            className="chip"
            style={cat === c ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : {}}
            onClick={() => setCat(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        {lista.map(s => {
          const profs = s.prof
            .map(id => estilistas.find(e => e.id === id))
            .filter((e): e is Estilista => Boolean(e))
          const stats = srvStats[s.nombre] || { veces: 0, ingresos: 0 }
          const comPct = comisiones[s.id] ?? comisiones[s.cat] ?? 30
          return (
            <div
              key={s.id}
              className="card card-pad"
              style={{ display: 'flex', flexDirection: 'column', gap: 14, cursor: 'pointer' }}
              onClick={() => setEditor(s)}
            >
              <div className="between">
                <span className="badge neutral">{s.cat}</span>
                {s.online
                  ? <span className="badge conf"><span className="d"></span>En línea</span>
                  : <span className="badge neutral">Solo en salón</span>
                }
              </div>
              <div>
                <h3 className="serif" style={{ fontSize: 19, margin: 0, fontWeight: 600 }}>{s.nombre}</h3>
                {s.descripcion && (
                  <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '6px 0 0', lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {s.descripcion}
                  </p>
                )}
                <div className="vc gap12 mt10" style={{ fontSize: 12, color: 'var(--text-3)', flexWrap: 'wrap' }}>
                  <span className="vc" style={{ gap: 5 }}><Ic n="clock" />{s.dur} min</span>
                  <span className="vc" style={{ gap: 5, color: '#B08AC7' }}>
                    <Ic n="users-three" />
                    {s.comValor && s.comValor > 0
                      ? s.comTipo === 'valor' ? `Com. ${mxn(s.comValor)}` : `Com. ${s.comValor}%`
                      : `Com. ${comPct}%`}
                  </span>
                  {s.anticipo && <span className="vc" style={{ gap: 5, color: 'var(--gold)' }}><Ic n="hand-coins" />Anticipo {anticipoPct}%</span>}
                  {s.domicilio && <span className="vc" style={{ gap: 5, color: 'var(--st-conf)' }}><Ic n="house" />Domicilio</span>}
                  {s.precioVariable && <span className="vc" style={{ gap: 5, color: 'var(--text-4)' }}><Ic n="arrows-out" />Precio variable</span>}
                </div>
              </div>
              {stats.veces > 0 && (
                <div className="vc gap12" style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                  <span className="vc" style={{ gap: 4 }}><Ic n="check-circle" />{stats.veces} veces vendido</span>
                  <span className="vc gold-text" style={{ gap: 4, fontWeight: 600 }}><Ic n="currency-dollar" />{mxn(stats.ingresos)}</span>
                </div>
              )}
              <hr className="hr" />
              <div className="between">
                <div className="vc" style={{ marginLeft: 2 }}>
                  {profs.slice(0, 3).map((p, i) => (
                    <div key={i} title={p.nombre} style={{ marginLeft: i ? -8 : 0 }}>
                      <Avatar ini={p.ini} color={p.color} size="sm" />
                    </div>
                  ))}
                  <span className="dim" style={{ fontSize: 11.5, marginLeft: 10 }}>
                    {profs.length} estilista{profs.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="num gold-text" style={{ fontFamily: 'var(--serif)', fontSize: s.precioVisible === false ? 14 : 23, fontWeight: 600 }}>
                  {s.precioVisible === false ? 'Consultar' : mxn(s.precio)}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {lista.length === 0 && (
        <div className="center dim" style={{ padding: '60px 0', fontSize: 13 }}>
          <div style={{ fontSize: 32, marginBottom: 10, opacity: .4 }}><Ic n="scissors" /></div>
          No hay servicios que coincidan con tu búsqueda.
        </div>
      )}

      {editor !== null && (
        <ServicioEditor
          s={editor}
          estilistas={estilistas}
          cats={rawCats}
          anticipoPct={anticipoPct}
          onSave={srv => {
            upsertServicio(srv)
            toast('Servicio guardado')
            setEditor(null)
          }}
          onDelete={id => {
            deleteServicio(id)
            toast('Servicio eliminado')
            setEditor(null)
          }}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  )
}

interface ServicioEditorProps {
  s: Partial<Servicio>
  estilistas: Estilista[]
  cats: string[]
  anticipoPct: number
  onSave: (srv: Partial<Servicio> & { id: string }) => void
  onDelete: (id: string) => void
  onClose: () => void
}

function ServicioEditor({ s, estilistas, cats, anticipoPct, onSave, onDelete, onClose }: ServicioEditorProps) {
  const nuevo = !s.id
  const [nombre, setNombre] = useState(s.nombre ?? '')
  const [cat, setCat] = useState(s.cat ?? (cats[0] ?? ''))
  const [dur, setDur] = useState(s.dur ?? 60)
  const [precio, setPrecio] = useState(s.precio ?? 0)
  const [anticipo, setAnticipo] = useState(s.anticipo ?? false)
  const [online, setOnline] = useState(s.online ?? false)
  const [prof, setProf] = useState<string[]>(s.prof ?? [])
  const [catInput, setCatInput] = useState('')
  const [descripcion, setDescripcion] = useState(s.descripcion ?? '')
  const [precioVisible, setPrecioVisible] = useState(s.precioVisible ?? true)
  const [precioVariable, setPrecioVariable] = useState(s.precioVariable ?? false)
  const [domicilio, setDomicilio] = useState(s.domicilio ?? false)
  const [comValor, setComValor] = useState(s.comValor ?? 0)
  const [comTipo, setComTipo] = useState<'porcentaje' | 'valor'>(s.comTipo ?? 'porcentaje')

  const toggleProf = (id: string) => {
    setProf(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleSave = () => {
    if (!nombre.trim()) { toast('El nombre es requerido'); return }
    onSave({
      id: s.id ?? ('s' + Date.now()),
      nombre: nombre.trim(),
      cat: cat || catInput.trim() || 'General',
      dur, precio, anticipo, online, prof,
      descripcion: descripcion.trim() || undefined,
      precioVisible, precioVariable, domicilio,
      comValor, comTipo,
    })
  }

  const anticipoMonto = anticipo ? Math.round(precio * anticipoPct / 100) : 0

  return (
    <Modal onClose={onClose} width={560}>
      <div style={{ borderTop: '3px solid var(--gold)', borderRadius: 'var(--radius) var(--radius) 0 0' }}>
        <div className="between card-pad" style={{ borderBottom: '1px solid var(--line-soft)', paddingBottom: 16 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>{nuevo ? 'Nuevo servicio' : 'Editar servicio'}</div>
            <h3 className="serif" style={{ margin: 0, fontSize: 20 }}>{nuevo ? 'Agregar servicio' : nombre}</h3>
          </div>
          <button className="btn ghost icon-btn" onClick={onClose} style={{ padding: '6px 8px' }}><Ic n="x" /></button>
        </div>

        <div className="card-pad scroll-y" style={{ display: 'flex', flexDirection: 'column', gap: 18, maxHeight: '65vh' }}>

          {/* Info básica */}
          <div>
            <label className="label">Nombre del servicio</label>
            <input className="input" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Corte + peinado" />
          </div>

          <div>
            <label className="label">Categoría</label>
            <select className="input" value={cat} onChange={e => setCat(e.target.value)}>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="">+ Nueva categoría</option>
            </select>
            {cat === '' && (
              <input className="input mt8" value={catInput} onChange={e => setCatInput(e.target.value)} placeholder="Nombre de la nueva categoría" />
            )}
          </div>

          <div>
            <label className="label">Descripción <span className="muted" style={{ fontWeight: 400 }}>(visible para las clientas al reservar)</span></label>
            <textarea className="input" rows={3} value={descripcion} onChange={e => setDescripcion(e.target.value)}
              placeholder="Ej. Incluye lavado, corte y secado profesional. Duración y precio pueden variar según el largo del cabello."
              style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }} />
          </div>

          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label className="label">Duración (min)</label>
              <input className="input" type="number" min={5} step={5} value={dur} onChange={e => setDur(Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Precio base (MXN)</label>
              <input className="input" type="number" min={0} value={precio} onChange={e => setPrecio(Number(e.target.value))} />
            </div>
          </div>

          {/* Comisión por servicio */}
          <div>
            <label className="label">Comisión por servicio</label>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <select className="input" value={comTipo} onChange={e => setComTipo(e.target.value as 'porcentaje' | 'valor')}>
                <option value="porcentaje">Porcentaje (%)</option>
                <option value="valor">Valor fijo (MXN)</option>
              </select>
              <div style={{ position: 'relative' }}>
                <input className="input" type="number" min={0} value={comValor} onChange={e => setComValor(Number(e.target.value))}
                  placeholder={comTipo === 'porcentaje' ? '30' : '150'} />
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-4)' }}>
                  {comTipo === 'porcentaje' ? '%' : '$'}
                </span>
              </div>
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              {comTipo === 'valor'
                ? `La estilista recibe ${mxn(comValor)} fijo por este servicio`
                : `La estilista recibe ${comValor}% del precio cobrado`}
            </div>
          </div>

          {/* Estilistas */}
          <div>
            <label className="label">Estilistas que ofrecen este servicio</label>
            <div className="vc gap8" style={{ flexWrap: 'wrap', marginTop: 10 }}>
              {estilistas.map(e => {
                const sel = prof.includes(e.id)
                return (
                  <button key={e.id} className="chip vc"
                    style={{ gap: 6, borderColor: sel ? e.color : undefined, color: sel ? e.color : undefined, background: sel ? e.color + '18' : undefined }}
                    onClick={() => toggleProf(e.id)}
                  >
                    <span className="dotc" style={{ background: e.color }} />
                    {e.nombre.split(' ')[0]}
                    {sel && <Ic n="check" size={13} />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Toggles */}
          <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="between">
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>Requiere anticipo</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {anticipo ? `Se solicitará ${mxn(anticipoMonto)} (${anticipoPct}%) al agendar` : 'Sin anticipo requerido'}
                </div>
              </div>
              <Switch on={anticipo} onClick={() => setAnticipo(v => !v)} />
            </div>
            <hr className="hr" />
            <div className="between">
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>Disponible para agendar en línea</div>
                <div className="muted" style={{ fontSize: 12 }}>Visible en el portal de reservas</div>
              </div>
              <Switch on={online} onClick={() => setOnline(v => !v)} />
            </div>
            <hr className="hr" />
            <div className="between">
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>Mostrar precio en el sitio</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {precioVisible ? `Se mostrará ${mxn(precio)}` : 'Se mostrará "Consultar precio"'}
                </div>
              </div>
              <Switch on={precioVisible} onClick={() => setPrecioVisible(v => !v)} />
            </div>
            <hr className="hr" />
            <div className="between">
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>Precio / duración variable</div>
                <div className="muted" style={{ fontSize: 12 }}>El costo puede variar según el cabello o diseño</div>
              </div>
              <Switch on={precioVariable} onClick={() => setPrecioVariable(v => !v)} />
            </div>
            <hr className="hr" />
            <div className="between">
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>Servicio a domicilio</div>
                <div className="muted" style={{ fontSize: 12 }}>Disponible para atención fuera del salón</div>
              </div>
              <Switch on={domicilio} onClick={() => setDomicilio(v => !v)} />
            </div>
          </div>
        </div>

        <div className="between card-pad" style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 16 }}>
          <div>
            {!nuevo && (
              <button className="btn danger" onClick={() => s.id && onDelete(s.id)}>
                <Ic n="trash" />Eliminar
              </button>
            )}
          </div>
          <div className="vc gap10">
            <button className="btn ghost" onClick={onClose}>Cancelar</button>
            <button className="btn gold" onClick={handleSave}><Ic n="check" />Guardar</button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

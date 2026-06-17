import React, { useState } from 'react'
import { Avatar, Switch, CardHead, toast, Modal } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { useStore } from '../data/store'
import { mxn } from '../lib/helpers'
import type { Servicio, Estilista } from '../types'

export function ScreenServicios({ onNavigate }: { onNavigate: (r: string) => void }) {
  const [cat, setCat] = useState('Todos')
  const [editor, setEditor] = useState<Partial<Servicio> | null>(null)
  const { data, upsertServicio, deleteServicio } = useStore()

  const servicios = data.servicios
  const estilistas = data.estilistas
  const rawCats = Array.from(new Set(servicios.map(s => s.cat)))
  const cats = ['Todos', ...rawCats]
  const lista = cat === 'Todos' ? servicios : servicios.filter(s => s.cat === cat)

  return (
    <div>
      <div className="between" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="display" style={{ fontSize: 26, margin: 0 }}>Servicios y paquetes</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            {servicios.length} servicios en {rawCats.length} categorías · {servicios.filter(s => s.online).length} disponibles en línea
          </div>
        </div>
        <button className="btn gold" onClick={() => setEditor({})}>
          <Ic n="plus" />Nuevo servicio
        </button>
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
                <div className="vc gap16 mt10" style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                  <span className="vc" style={{ gap: 5 }}><Ic n="clock" />{s.dur} min</span>
                  {s.anticipo && (
                    <span className="vc" style={{ gap: 5, color: 'var(--gold)' }}>
                      <Ic n="hand-coins" />Requiere anticipo
                    </span>
                  )}
                </div>
              </div>
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
                <div className="num gold-text" style={{ fontFamily: 'var(--serif)', fontSize: 23, fontWeight: 600 }}>
                  {mxn(s.precio)}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {editor !== null && (
        <ServicioEditor
          s={editor}
          estilistas={estilistas}
          cats={rawCats}
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
  onSave: (srv: Partial<Servicio> & { id: string }) => void
  onDelete: (id: string) => void
  onClose: () => void
}

function ServicioEditor({ s, estilistas, cats, onSave, onDelete, onClose }: ServicioEditorProps) {
  const nuevo = !s.id
  const [nombre, setNombre] = useState(s.nombre ?? '')
  const [cat, setCat] = useState(s.cat ?? (cats[0] ?? ''))
  const [dur, setDur] = useState(s.dur ?? 60)
  const [precio, setPrecio] = useState(s.precio ?? 0)
  const [anticipo, setAnticipo] = useState(s.anticipo ?? false)
  const [online, setOnline] = useState(s.online ?? false)
  const [prof, setProf] = useState<string[]>(s.prof ?? [])
  const [catInput, setCatInput] = useState('')

  const toggleProf = (id: string) => {
    setProf(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleSave = () => {
    if (!nombre.trim()) { toast('El nombre es requerido'); return }
    onSave({
      id: s.id ?? ('s' + Date.now()),
      nombre: nombre.trim(),
      cat: cat || catInput.trim() || 'General',
      dur,
      precio,
      anticipo,
      online,
      prof,
    })
  }

  const anticipoSugerido = anticipo ? Math.round(precio * 0.35) : 0

  return (
    <Modal onClose={onClose} width={540}>
      <div style={{ borderTop: '3px solid var(--gold)', borderRadius: 'var(--radius) var(--radius) 0 0' }}>
        {/* Header */}
        <div className="between card-pad" style={{ borderBottom: '1px solid var(--line-soft)', paddingBottom: 16 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>
              {nuevo ? 'Nuevo servicio' : 'Editar servicio'}
            </div>
            <h3 className="serif" style={{ margin: 0, fontSize: 20 }}>
              {nuevo ? 'Agregar servicio' : nombre}
            </h3>
          </div>
          <button className="btn ghost icon-btn" onClick={onClose} style={{ padding: '6px 8px' }}>
            <Ic n="x" />
          </button>
        </div>

        {/* Body */}
        <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Nombre */}
          <div>
            <label className="label">Nombre del servicio</label>
            <input
              className="input"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej. Corte + peinado"
            />
          </div>

          {/* Categoría */}
          <div>
            <label className="label">Categoría</label>
            <select className="input" value={cat} onChange={e => setCat(e.target.value)}>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="">+ Nueva categoría</option>
            </select>
            {cat === '' && (
              <input
                className="input mt8"
                value={catInput}
                onChange={e => setCatInput(e.target.value)}
                placeholder="Nombre de la nueva categoría"
              />
            )}
          </div>

          {/* Duración + Precio */}
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label className="label">Duración (min)</label>
              <input
                className="input"
                type="number"
                min={5}
                step={5}
                value={dur}
                onChange={e => setDur(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label">Precio</label>
              <input
                className="input"
                type="number"
                min={0}
                value={precio}
                onChange={e => setPrecio(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Anticipo sugerido */}
          <div>
            <label className="label">Anticipo sugerido (35%)</label>
            <input
              className="input"
              type="number"
              value={anticipoSugerido}
              disabled
              style={{ opacity: 0.55, cursor: 'not-allowed' }}
            />
          </div>

          {/* Estilistas */}
          <div>
            <label className="label" style={{ marginBottom: 10 }}>Estilistas que ofrecen este servicio</label>
            <div className="vc gap8" style={{ flexWrap: 'wrap' }}>
              {estilistas.map(e => {
                const sel = prof.includes(e.id)
                return (
                  <button
                    key={e.id}
                    className="chip vc"
                    style={{
                      gap: 6,
                      borderColor: sel ? e.color : undefined,
                      color: sel ? e.color : undefined,
                      background: sel ? e.color + '18' : undefined,
                    }}
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

          {/* Switches */}
          <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="between">
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>Requiere anticipo</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Se solicitará {mxn(anticipoSugerido)} al agendar
                </div>
              </div>
              <Switch on={anticipo} onClick={() => setAnticipo(v => !v)} />
            </div>
            <hr className="hr" />
            <div className="between">
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>Disponible para agendar en línea</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Visible en el portal de reservas
                </div>
              </div>
              <Switch on={online} onClick={() => setOnline(v => !v)} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="between card-pad" style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 16 }}>
          <div>
            {!nuevo && (
              <button
                className="btn danger"
                onClick={() => s.id && onDelete(s.id)}
              >
                <Ic n="trash" />Eliminar
              </button>
            )}
          </div>
          <div className="vc gap10">
            <button className="btn ghost" onClick={onClose}>Cancelar</button>
            <button className="btn gold" onClick={handleSave}>
              <Ic n="check" />Guardar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

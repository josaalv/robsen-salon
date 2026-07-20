import React, { useState, useMemo, useRef } from 'react'
import { Avatar, Switch, toast, Modal } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { useStore } from '../data/store'
import { mxn } from '../lib/helpers'
import type { Servicio, Estilista } from '../types'
import * as XLSX from 'xlsx'

export function ScreenServicios({ onNavigate }: { onNavigate: (r: string) => void }) {
  const [cat, setCat] = useState('Todos')
  const [q, setQ] = useState('')
  const [editor, setEditor] = useState<Partial<Servicio> | null>(null)
  const [importando, setImportando] = useState(false)
  const { data, upsertServicio, deleteServicio } = useStore()

  const servicios = data.servicios
  const estilistas = data.estilistas
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
            {q && <button className="icon-btn" onClick={() => setQ('')} title="Limpiar" style={{ width: 22, height: 22, flex: '0 0 auto' }}><Ic n="x" size={12} /></button>}
          </div>
          <button className="btn ghost" onClick={() => setImportando(true)}>
            <Ic n="upload-simple" />Importar
          </button>
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
          return (
            <div
              key={s.id}
              className="card card-pad"
              style={{ display: 'flex', flexDirection: 'column', gap: 14, cursor: 'pointer', opacity: s.activo === false ? 0.55 : 1 }}
              onClick={() => setEditor(s)}
            >
              <div className="between">
                <span className="badge neutral">{s.cat}</span>
                <div className="vc gap6">
                  {s.activo === false && <span className="badge canc">Inactivo</span>}
                  {s.online
                    ? <span className="badge conf"><span className="d"></span>En línea</span>
                    : <span className="badge neutral">Solo en salón</span>
                  }
                </div>
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

      {importando && (
        <ImportarServiciosModal
          serviciosExistentes={servicios}
          onImport={async srvs => {
            let ok = 0
            for (const srv of srvs) {
              try {
                await upsertServicio(srv)
                ok++
              } catch {
                // continúa con el resto; se reporta el conteo real abajo
              }
            }
            if (ok === srvs.length) toast(`${ok} servicio${ok !== 1 ? 's' : ''} importado${ok !== 1 ? 's' : ''}`)
            else if (ok === 0) toast('No se pudo importar ningún servicio. Intenta de nuevo.')
            else toast(`${ok} de ${srvs.length} servicios importados. Revisa los que fallaron.`)
            setImportando(false)
          }}
          onClose={() => setImportando(false)}
        />
      )}

      {editor !== null && (
        <ServicioEditor
          s={editor}
          estilistas={estilistas}
          cats={rawCats}
          anticipoPct={anticipoPct}
          onSave={async srv => {
            try {
              await upsertServicio(srv)
              toast('Servicio guardado')
              setEditor(null)
            } catch {
              toast('No se pudo guardar el servicio. Es posible que no tengas permiso para editar precios.')
            }
          }}
          onDelete={async id => {
            try {
              await deleteServicio(id)
              toast('Servicio eliminado')
              setEditor(null)
            } catch {
              toast('No se pudo eliminar el servicio. Intenta de nuevo.')
            }
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

// ─── ImportarServiciosModal ───────────────────────────────────────────────────

function normalizeSrvHeader(h: string): string {
  return h.toLowerCase().trim()
    .replace(/categoría|categoria|category/i, 'cat')
    .replace(/duración.*|duracion.*|duration.*|min.*/i, 'dur')
    .replace(/precio.*venta.*|precio.*base.*|sale.*price.*/i, 'precio')
    .replace(/reservar.*online|online|en.*línea/i, 'online')
    .replace(/precio.*visible|mostrar.*precio/i, 'precioVisible')
    .replace(/precio.*variable|variable/i, 'precioVariable')
    .replace(/domicilio|a.*domicilio/i, 'domicilio')
}

interface ImportarServiciosModalProps {
  serviciosExistentes: Servicio[]
  onImport: (srvs: Servicio[]) => void
  onClose: () => void
}

function ImportarServiciosModal({ serviciosExistentes, onImport, onClose }: ImportarServiciosModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [filas, setFilas] = useState<Record<string, string>[]>([])
  const [errores, setErrores] = useState<string[]>([])
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set())
  const [paso, setPaso] = useState<'subir' | 'preview'>('subir')

  const leerArchivo = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' })
        if (json.length === 0) { setErrores(['El archivo está vacío o no tiene datos.']); return }
        const normalized = json.map(row => {
          const nr: Record<string, string> = {}
          Object.entries(row).forEach(([k, v]) => { nr[normalizeSrvHeader(k)] = String(v ?? '') })
          return nr
        })
        const errs: string[] = []
        if (!normalized[0].nombre) errs.push('No se encontró la columna "Nombre". Revisa los encabezados.')
        setErrores(errs)
        setFilas(normalized)
        setSeleccion(new Set(normalized.map((_, i) => i)))
        if (errs.length === 0) setPaso('preview')
      } catch {
        setErrores(['No se pudo leer el archivo. Asegúrate de que sea .xlsx o .csv válido.'])
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const parseBool = (v: string) => ['si', 'sí', 'yes', '1', 'true', 'x'].includes(v.toLowerCase().trim())

  const nombreExistentes = new Set(serviciosExistentes.map(s => s.nombre.toLowerCase().trim()))

  const confirmarImport = () => {
    const srvs: Servicio[] = []
    Array.from(seleccion).forEach(i => {
      const r = filas[i]
      const nombre = r.nombre?.trim()
      if (!nombre) return
      const existente = serviciosExistentes.find(s => s.nombre.toLowerCase().trim() === nombre.toLowerCase().trim())
      srvs.push({
        id: existente ? existente.id : ('s' + Date.now() + i),
        nombre,
        cat: r.cat?.trim() || 'General',
        precio: parseFloat(r.precio) || 0,
        dur: parseInt(r.dur) || 60,
        anticipo: existente?.anticipo ?? false,
        online: r.online ? parseBool(r.online) : (existente?.online ?? false),
        prof: existente?.prof ?? [],
        descripcion: r.descripcion?.trim() || existente?.descripcion,
        precioVisible: r.precioVisible ? parseBool(r.precioVisible) : (existente?.precioVisible ?? true),
        precioVariable: r.precioVariable ? parseBool(r.precioVariable) : (existente?.precioVariable ?? false),
        domicilio: r.domicilio ? parseBool(r.domicilio) : (existente?.domicilio ?? false),
      })
    })
    onImport(srvs)
  }

  const toggleFila = (i: number) => {
    setSeleccion(s => { const ns = new Set(s); ns.has(i) ? ns.delete(i) : ns.add(i); return ns })
  }

  const nuevos = filas.filter((r, i) => seleccion.has(i) && r.nombre && !nombreExistentes.has(r.nombre.toLowerCase().trim())).length
  const actualizaciones = filas.filter((r, i) => seleccion.has(i) && r.nombre && nombreExistentes.has(r.nombre.toLowerCase().trim())).length

  return (
    <Modal onClose={onClose} width={780}>
      <div style={{ borderTop: '3px solid var(--gold)', borderRadius: 'var(--radius) var(--radius) 0 0' }}>
        <div className="between card-pad" style={{ borderBottom: '1px solid var(--line-soft)', paddingBottom: 16 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Servicios</div>
            <h3 className="serif" style={{ margin: 0, fontSize: 20 }}>Importar servicios</h3>
          </div>
          <button className="btn ghost icon-btn" onClick={onClose} style={{ padding: '6px 8px' }}><Ic n="x" /></button>
        </div>

        {paso === 'subir' ? (
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) leerArchivo(f) }}
              style={{ border: '2px dashed var(--line)', borderRadius: 12, padding: '40px 24px', textAlign: 'center', cursor: 'pointer', transition: 'border-color .2s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line)')}
            >
              <div style={{ fontSize: 36, color: 'var(--gold)', marginBottom: 12 }}><Ic n="file-xls" /></div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Arrastra tu archivo aquí o haz clic para seleccionar</div>
              <div className="muted" style={{ fontSize: 12.5 }}>Formatos soportados: .xlsx, .xls, .csv</div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) leerArchivo(f); e.target.value = '' }} />
            </div>

            {errores.length > 0 && (
              <div style={{ background: 'rgba(220,80,80,0.08)', border: '1px solid rgba(220,80,80,0.25)', borderRadius: 8, padding: '12px 14px' }}>
                {errores.map((e, i) => <div key={i} style={{ fontSize: 13, color: 'var(--st-canc)' }}>⚠ {e}</div>)}
              </div>
            )}

            <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '14px 16px' }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Columnas que se reconocen</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['nombre *', 'cat / categoría', 'precio', 'dur / duración', 'descripcion', 'online', 'precioVisible', 'precioVariable', 'domicilio'].map(c => (
                  <span key={c} className="chip" style={{ fontSize: 11.5 }}>{c}</span>
                ))}
              </div>
              <div className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>
                * Obligatorio. Si el nombre coincide con uno existente, se actualiza el servicio. Las columnas extra se ignoran.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="card-pad vc gap16" style={{ borderBottom: '1px solid var(--line-soft)', flexWrap: 'wrap' }}>
              <div className="vc gap8">
                <span className="badge conf">{nuevos} nuevos</span>
                {actualizaciones > 0 && <span className="badge pend">{actualizaciones} a actualizar</span>}
                <span className="muted" style={{ fontSize: 12 }}>{seleccion.size} de {filas.length} seleccionados</span>
              </div>
              <div className="vc gap8" style={{ marginLeft: 'auto' }}>
                <button className="chip" style={{ fontSize: 11.5 }} onClick={() => setSeleccion(new Set(filas.map((_, i) => i)))}>Todos</button>
                <button className="chip" style={{ fontSize: 11.5 }} onClick={() => setSeleccion(new Set())}>Ninguno</button>
                <button className="btn ghost sm" onClick={() => { setPaso('subir'); setFilas([]); setErrores([]) }}>
                  <Ic n="arrow-left" size={13} />Cambiar archivo
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto', maxHeight: '45vh' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}></th>
                    <th>Nombre</th>
                    <th>Categoría</th>
                    <th className="num">Precio</th>
                    <th className="num">Dur.</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((r, i) => {
                    const checked = seleccion.has(i)
                    const esActualizacion = r.nombre && nombreExistentes.has(r.nombre.toLowerCase().trim())
                    const sinNombre = !r.nombre?.trim()
                    return (
                      <tr key={i} style={{ opacity: sinNombre ? 0.4 : 1, cursor: sinNombre ? 'default' : 'pointer' }}
                        onClick={() => !sinNombre && toggleFila(i)}>
                        <td><input type="checkbox" checked={checked} disabled={sinNombre} readOnly style={{ accentColor: 'var(--gold)' }} /></td>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{r.nombre || <span className="dim">—</span>}</td>
                        <td style={{ fontSize: 12 }}>{r.cat || '—'}</td>
                        <td className="num" style={{ fontSize: 12 }}>{r.precio ? `$${parseFloat(r.precio).toLocaleString()}` : '—'}</td>
                        <td className="num" style={{ fontSize: 12 }}>{r.dur ? `${r.dur} min` : '—'}</td>
                        <td>
                          {esActualizacion
                            ? <span className="badge pend">Actualizar</span>
                            : <span className="badge conf">Nuevo</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="between card-pad" style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 16 }}>
              <button className="btn ghost" onClick={onClose}>Cancelar</button>
              <button className="btn gold" disabled={seleccion.size === 0} onClick={confirmarImport}>
                <Ic n="check" />Importar {seleccion.size} servicio{seleccion.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
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
  const [activo, setActivo] = useState(s.activo ?? true)

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
      activo,
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
            <hr className="hr" />
            <div className="between">
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>Servicio activo</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {activo ? 'Disponible para nuevas citas y ventas' : 'Oculto para nuevas citas/ventas — sigue visible en el historial'}
                </div>
              </div>
              <Switch on={activo} onClick={() => setActivo(v => !v)} />
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

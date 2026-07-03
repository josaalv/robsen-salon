import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Avatar, EstadoBadge, ClienteBadge, CardHead, Seg, toast, ConfirmModal } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { useStore } from '../data/store'
import { db } from '../lib/db'
import { mxn, helpers, normalizarTel as normalizarTelShared, telefonoValido, telefonoError, filtrarTel } from '../lib/helpers'
import type { Clienta, EstadoClienta, FotoEntry } from '../types'

function waUrl(tel: string, msg: string): string {
  const digits = tel.replace(/\D/g, '')
  const num = digits.startsWith('52') ? digits : '52' + digits
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
}

function abrirWA(tel: string | undefined, msg: string) {
  if (!tel) { toast('Esta clienta no tiene teléfono registrado'); return }
  window.open(waUrl(tel, msg), '_blank')
}

const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
function fechaHoy() {
  const d = new Date()
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`
}
const normalizarTel = normalizarTelShared

// ─── Modal nueva / editar clienta ───────────────────────────────────────────
function ClientaModal({ c, onClose, onSaved }: {
  c: Partial<Clienta>; onClose: () => void; onSaved: () => void
}) {
  const { data, upsertClienta } = useStore()
  const nuevo = !c.id
  const [nombre, setNombre] = useState(c.nombre || '')
  const [tel, setTel] = useState(c.tel || '')
  const [estado, setEstado] = useState<EstadoClienta>(c.estado || 'Nueva')
  const [est, setEst] = useState(c.est || data.estilistas[0].id)
  const [fav, setFav] = useState(c.fav || data.servicios[0].nombre)
  const [cumple, setCumple] = useState(c.cumple || '')
  const [ciclo, setCiclo] = useState(c.ciclo || 8)
  const [forzarDuplicado, setForzarDuplicado] = useState(false)
  const [saving, setSaving] = useState(false)

  const estadosCl: EstadoClienta[] = ['VIP', 'Frecuente', 'Activa', 'Nueva', 'Inactiva']

  const telNorm = normalizarTel(tel)
  const duplicado = telNorm.length >= 8
    ? data.clientas.find(x => x.id !== c.id && normalizarTel(x.tel) === telNorm)
    : undefined

  const telInvalido = !!tel.trim() && !telefonoValido(tel)

  const guardar = async () => {
    if (!nombre.trim() || saving) return
    if (telInvalido) return
    if (duplicado && !forzarDuplicado) return
    const id = c.id || ('c' + Date.now())
    const ini = nombre.trim().split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    setSaving(true)
    try {
      await upsertClienta({
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
        ultima: c.ultima || fechaHoy(),
        ticket: c.ticket || 0,
        visitas: c.visitas || 0,
        gasto: c.gasto || 0,
      })
      toast(nuevo ? 'Clienta registrada correctamente' : 'Clienta actualizada')
      onSaved()
    } catch (err) {
      const code = (err as { code?: string })?.code
      toast(code === '23505'
        ? 'Ya existe una clienta con ese teléfono. Revisa el listado antes de crear una nueva.'
        : 'No se pudo guardar la clienta. Intenta de nuevo.')
      setSaving(false)
    }
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
              <input
                className="input"
                value={tel}
                onChange={e => { setTel(filtrarTel(e.target.value)); setForzarDuplicado(false) }}
                placeholder="33 1234 5678"
                style={{ borderColor: telInvalido ? 'var(--st-canc)' : undefined }}
              />
              {telInvalido && <div style={{ fontSize: 11.5, color: 'var(--st-canc)', marginTop: 4 }}>{telefonoError(tel)}</div>}
            </div>
            {duplicado && (
              <div style={{ gridColumn: '1 / -1', background: 'rgba(220,80,80,0.08)', border: '1px solid rgba(220,80,80,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, color: 'var(--st-canc)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>Ya existe una clienta con este teléfono: <b>{duplicado.nombre}</b>. ¿Es la misma persona?</span>
                {!forzarDuplicado && (
                  <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => setForzarDuplicado(true)}>
                    Es una persona distinta, guardar de todas formas
                  </button>
                )}
              </div>
            )}
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
              <input className="input num" type="number" min="1" value={ciclo} onChange={e => setCiclo(Math.max(1, +e.target.value))} />
            </div>
          </div>
        </div>
        <hr className="hr" />
        <div className="card-pad vc gap12" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button
            className="btn gold"
            onClick={guardar}
            style={(() => {
              const ok = !!nombre.trim() && !telInvalido && (!duplicado || forzarDuplicado) && !saving
              return { opacity: ok ? 1 : .4, pointerEvents: ok ? 'auto' : 'none' }
            })()}
          >
            <Ic n="check" />{saving ? 'Guardando…' : (nuevo ? 'Registrar clienta' : 'Guardar cambios')}
          </button>
        </div>
      </div>
    </div>
  )
}

function PreferenciasTab({ c }: { c: Clienta }) {
  const { upsertClienta } = useStore()
  const [notas, setNotas] = useState(c.notas || '')
  const [saved, setSaved] = useState(false)

  const guardar = async () => {
    try {
      await upsertClienta({ ...c, notas })
      setSaved(true)
      toast('Preferencias guardadas')
      setTimeout(() => setSaved(false), 2000)
    } catch {
      toast('No se pudieron guardar las preferencias. Intenta de nuevo.')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="eyebrow" style={{ marginBottom: 0 }}>Notas del equipo</div>
      <div className="dim" style={{ fontSize: 12, marginTop: -8 }}>
        Alergias, preferencias de horario, notas de sensibilidad, observaciones del servicio.
      </div>
      <textarea
        className="input"
        rows={6}
        placeholder="Ej. Alergia a amonio · prefiere citas por la mañana · cabello teñido con henna previa…"
        value={notas}
        onChange={e => setNotas(e.target.value)}
        style={{ resize: 'vertical', lineHeight: 1.6 }}
      />
      <div className="vc gap8">
        <button className="btn gold sm" onClick={guardar}>
          <Ic n={saved ? 'check' : 'floppy-disk'} />{saved ? 'Guardado' : 'Guardar notas'}
        </button>
        {notas && <button className="btn ghost sm" onClick={() => { setNotas(''); upsertClienta({ ...c, notas: '' }).catch(() => toast('No se pudo limpiar las notas. Intenta de nuevo.')) }}>Limpiar</button>}
      </div>
    </div>
  )
}

function FormulaColorTab({ c }: { c: Clienta }) {
  const { upsertClienta } = useStore()
  const formulas = c.formulas || []
  const [adding, setAdding] = useState(false)
  const [srv, setSrv] = useState('')
  const [formula, setFormula] = useState('')

  const agregar = async () => {
    if (!formula.trim()) return
    const newEntry = {
      id: 'f' + Date.now(),
      fecha: new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }),
      srv: srv || 'Color',
      formula: formula.trim(),
    }
    try {
      await upsertClienta({ ...c, formulas: [newEntry, ...formulas] })
      setFormula(''); setSrv(''); setAdding(false)
      toast('Fórmula guardada')
    } catch {
      toast('No se pudo guardar la fórmula. Intenta de nuevo.')
    }
  }

  const eliminar = (id: string) => {
    upsertClienta({ ...c, formulas: formulas.filter(f => f.id !== id) })
      .catch(() => toast('No se pudo eliminar la fórmula. Intenta de nuevo.'))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="between">
        <div className="eyebrow">Historial de fórmulas de color</div>
        <button className="btn gold sm" onClick={() => setAdding(v => !v)}>
          <Ic n={adding ? 'x' : 'plus'} />{adding ? 'Cancelar' : 'Nueva fórmula'}
        </button>
      </div>

      {adding && (
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Servicio</label>
              <input className="input" value={srv} onChange={e => setSrv(e.target.value)} placeholder="Ej. Balayage, Color permanente…" />
            </div>
            <div className="field">
              <label>Fecha</label>
              <input className="input" value={new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })} disabled style={{ opacity: 0.6 }} />
            </div>
          </div>
          <div className="field">
            <label>Fórmula y técnica</label>
            <textarea
              className="input"
              rows={4}
              placeholder="Ej. Base: 6N 50g + 20vol · Mechas: 9.1 30g + 30vol · Tóner: 10P 20g · Tiempo: 35min"
              value={formula}
              onChange={e => setFormula(e.target.value)}
              style={{ resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>
          <button className="btn gold sm" style={{ alignSelf: 'flex-start' }} onClick={agregar} disabled={!formula.trim()}>
            <Ic n="check" />Guardar fórmula
          </button>
        </div>
      )}

      {formulas.length > 0 ? formulas.map(f => (
        <div key={f.id} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="between">
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{f.srv}</div>
              <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>{f.fecha}</div>
            </div>
            <button className="icon-btn" style={{ width: 30, height: 30, color: 'var(--st-canc)' }} onClick={() => eliminar(f.id)}>
              <Ic n="trash" size={14} />
            </button>
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.7, color: 'var(--text-2)', background: 'var(--surface-2)', padding: '10px 14px', borderRadius: 8, fontFamily: 'monospace' }}>
            {f.formula}
          </div>
        </div>
      )) : !adding && (
        <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-4)' }}>
          <Ic n="paint-brush" size={28} style={{ display: 'block', margin: '0 auto 10px', opacity: .4 }} />
          <div style={{ fontSize: 13 }}>Sin fórmulas registradas</div>
        </div>
      )}
    </div>
  )
}

// ─── Antes / Después ─────────────────────────────────────────────────────────
function AntesDesTab({ c }: { c: Clienta }) {
  const { upsertClienta } = useStore()
  const [fotos, setFotos] = useState<FotoEntry[]>(() => c.fotos || [])
  const [adding, setAdding] = useState(false)
  const [antesFile, setAntesFile] = useState<File | null>(null)
  const [antesPreview, setAntesPreview] = useState('')
  const [despuesFile, setDespuesFile] = useState<File | null>(null)
  const [despuesPreview, setDespuesPreview] = useState('')
  const [nota, setNota] = useState('')
  const [uploading, setUploading] = useState(false)
  const antesRef = useRef<HTMLInputElement>(null)
  const despuesRef = useRef<HTMLInputElement>(null)
  // fotos[].antes/despues guardan el path del bucket privado, no una URL.
  // Para mostrarlas hay que pedir una URL firmada (expira) por cada path.
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    setFotos(c.fotos || [])
  }, [c.id])

  useEffect(() => {
    const paths = fotos.flatMap(f => [f.antes, f.despues]).filter(Boolean)
    const faltantes = paths.filter(p => !signedUrls[p])
    if (faltantes.length === 0) return
    Promise.all(faltantes.map(async p => [p, await db.getSignedUrl(p)] as const)).then(pairs => {
      setSignedUrls(prev => {
        const next = { ...prev }
        for (const [p, url] of pairs) if (url) next[p] = url
        return next
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotos])

  const handleFile = (file: File, type: 'antes' | 'despues') => {
    if (file.size > 15 * 1024 * 1024) { toast('La imagen debe pesar menos de 15 MB'); return }
    const preview = URL.createObjectURL(file)
    if (type === 'antes') {
      if (antesPreview) URL.revokeObjectURL(antesPreview)
      setAntesFile(file); setAntesPreview(preview)
    } else {
      if (despuesPreview) URL.revokeObjectURL(despuesPreview)
      setDespuesFile(file); setDespuesPreview(preview)
    }
  }

  const resetForm = () => {
    if (antesPreview) URL.revokeObjectURL(antesPreview)
    if (despuesPreview) URL.revokeObjectURL(despuesPreview)
    setAntesFile(null); setAntesPreview('')
    setDespuesFile(null); setDespuesPreview('')
    setNota('')
  }

  const save = async () => {
    if (!antesFile && !despuesFile) { toast('Sube al menos una foto'); return }
    setUploading(true)
    try {
      const id = 'p' + Date.now()
      const [antesPath, despuesPath] = await Promise.all([
        antesFile ? db.uploadMediaPrivado(`${c.id}/${id}-antes`, antesFile) : Promise.resolve(null),
        despuesFile ? db.uploadMediaPrivado(`${c.id}/${id}-despues`, despuesFile) : Promise.resolve(null),
      ])
      if (antesFile && !antesPath) { toast('Error al subir la foto de antes'); return }
      if (despuesFile && !despuesPath) { toast('Error al subir la foto de después'); return }
      const entry: FotoEntry = {
        id,
        antes: antesPath || '',
        despues: despuesPath || '',
        fecha: new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }),
        nota,
      }
      const next = [entry, ...fotos]
      try {
        await upsertClienta({ id: c.id, fotos: next })
        setFotos(next)
        toast('Comparativa guardada')
        setAdding(false)
        resetForm()
      } catch {
        toast('No se pudo guardar la comparativa. Intenta de nuevo.')
      }
    } finally {
      setUploading(false)
    }
  }

  const eliminar = async (id: string) => {
    const f = fotos.find(x => x.id === id)
    const next = fotos.filter(f => f.id !== id)
    try {
      await upsertClienta({ id: c.id, fotos: next })
      if (f) {
        const paths = [f.antes, f.despues].filter(Boolean)
        if (paths.length) db.deleteMediaPrivado(paths)
      }
      setFotos(next)
    } catch {
      toast('No se pudo eliminar la comparativa. Intenta de nuevo.')
    }
  }

  const PhotoSlot = ({ src, label, onClick }: { src: string; label: string; onClick: () => void }) => (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6, letterSpacing: '.1em' }}>{label}</div>
      <div
        onClick={onClick}
        style={{ height: 160, border: '2px dashed var(--line)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}
      >
        {src
          ? <img src={src} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div className="dim" style={{ textAlign: 'center', fontSize: 12 }}>
              <Ic n="upload" size={24} style={{ display: 'block', margin: '0 auto 6px', opacity: .5 }} />
              Subir foto
            </div>}
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="between">
        <div className="eyebrow">Comparativas de antes / después</div>
        <button className="btn gold sm" onClick={() => { if (adding) resetForm(); setAdding(v => !v) }}>
          <Ic n={adding ? 'x' : 'plus'} />{adding ? 'Cancelar' : 'Nueva comparativa'}
        </button>
      </div>

      {adding && (
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <PhotoSlot src={antesPreview} label="ANTES" onClick={() => antesRef.current?.click()} />
            <PhotoSlot src={despuesPreview} label="DESPUÉS" onClick={() => despuesRef.current?.click()} />
          </div>
          <input ref={antesRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f, 'antes') }} />
          <input ref={despuesRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f, 'despues') }} />
          <div className="field">
            <label>Nota (opcional)</label>
            <input className="input" placeholder="Ej. Balayage natural + tóner cenizo · Jun 2026" value={nota} onChange={e => setNota(e.target.value)} />
          </div>
          <button className="btn gold sm" style={{ alignSelf: 'flex-start' }} onClick={save} disabled={uploading}>
            {uploading ? <><Ic n="spinner" />Subiendo…</> : <><Ic n="check" />Guardar comparativa</>}
          </button>
        </div>
      )}

      {fotos.map(f => (
        <div key={f.id} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="between">
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{f.nota || 'Sin nota'}</div>
              <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>{f.fecha}</div>
            </div>
            <button className="icon-btn" style={{ width: 30, height: 30, color: 'var(--st-canc)' }} onClick={() => eliminar(f.id)}>
              <Ic n="trash" size={14} />
            </button>
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {f.antes && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', marginBottom: 4 }}>ANTES</div>
                {signedUrls[f.antes]
                  ? <img src={signedUrls[f.antes]} alt="Antes" style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 8 }} />
                  : <div style={{ width: '100%', height: 160, borderRadius: 8, background: 'var(--surface-2)' }} />}
              </div>
            )}
            {f.despues && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', marginBottom: 4 }}>DESPUÉS</div>
                {signedUrls[f.despues]
                  ? <img src={signedUrls[f.despues]} alt="Después" style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 8 }} />
                  : <div style={{ width: '100%', height: 160, borderRadius: 8, background: 'var(--surface-2)' }} />}
              </div>
            )}
          </div>
        </div>
      ))}

      {fotos.length === 0 && !adding && (
        <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-4)' }}>
          <Ic n="camera" size={28} style={{ display: 'block', margin: '0 auto 10px', opacity: .4 }} />
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>Sin fotos</div>
          <div style={{ fontSize: 12.5 }}>Sube comparativas de antes y después por visita</div>
        </div>
      )}
    </div>
  )
}

// ─── Perfil de clienta ───────────────────────────────────────────────────────
function ClientaPerfil({ c, onBack, onEdit, onDelete, onNavigate, editCl, setEditCl }: {
  c: Clienta
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  onNavigate: (r: string) => void
  editCl: Partial<Clienta> | null
  setEditCl: (c: Partial<Clienta> | null) => void
}) {
  const { data } = useStore()
  const [tab, setTab] = useState('Historial')
  const e = data.estilistas.find(est => est.id === c.est) || data.estilistas[0]

  // Solo ventas reales de esta clienta
  const ventasCl = data.ventas.filter(v => c.id && v.clienteId === c.id).map(v => ({
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
          <button className="btn ghost sm" style={{ color: 'var(--st-canc)' }}
            onClick={() => { if (confirm('¿Eliminar a ' + c.nombre + '?')) onDelete() }}>
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
              <button className="btn gold sm" onClick={() => onNavigate('agenda')}><Ic n="calendar-plus" />Agendar</button>
              <button
                className="btn sm"
                style={{ background: '#25D366', color: '#fff', border: 'none' }}
                onClick={() => abrirWA(c.tel, `Hola ${c.nombre.split(' ')[0]} 💛 `)}
              >
                <Ic n="whatsapp-logo" />Mensaje
              </button>
            </div>
          </div>
          <hr className="hr" />
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {([['phone', 'Teléfono', c.tel || '—'], ['calendar-blank', 'Última visita', c.ultima], ['scissors', 'Servicio favorito', c.fav], ['user', 'Estilista habitual', e.nombre]] as [string, string, string][]).map(([ic, l, v]) => (
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
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="eyebrow">Retención</div>
            <div className="between">
              <span className="vc gap10" style={{ fontSize: 13 }}>
                <span className="dotc" style={{ background: salud[1], width: 10, height: 10 }} />Salud de la clienta
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
                  {ins.proxStr}
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
            <div className="kpi-mini"><span className="l">Ciclo</span><span className="v">{c.ciclo}<span style={{ fontSize: 13, color: 'var(--text-3)' }}> sem</span></span></div>
          </div>
        </div>

        {/* Tabs */}
        <div className="card">
          <div className="tabs" style={{ padding: '0 8px' }}>
            {['Historial', 'Fórmulas de color', 'Preferencias', 'Antes / Después'].map(t => (
              <div key={t} className={'tab' + (tab === t ? ' active' : '')} onClick={() => setTab(t)}>{t}</div>
            ))}
          </div>
          <div className="card-pad">

            {tab === 'Historial' && (
              ventasCl.length > 0 ? (
                <table className="table" style={{ marginTop: -6 }}>
                  <thead>
                    <tr><th>Fecha</th><th>Servicio / Productos</th><th>Estilista</th><th className="num">Total</th><th>Estado</th></tr>
                  </thead>
                  <tbody>
                    {ventasCl.map((h, i) => (
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
              ) : (
                <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-4)' }}>
                  <Ic n="receipt" size={32} style={{ display: 'block', margin: '0 auto 10px', opacity: .4 }} />
                  <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>Sin historial de ventas</div>
                  <div style={{ fontSize: 12.5 }}>Las visitas registradas en Ventas aparecerán aquí</div>
                </div>
              )
            )}

            {tab === 'Fórmulas de color' && (
              <FormulaColorTab c={c} />
            )}

            {tab === 'Preferencias' && (
              <PreferenciasTab c={c} />
            )}

            {tab === 'Antes / Después' && (
              <AntesDesTab c={c} />
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Vista de retención ──────────────────────────────────────────────────────
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
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <CardHead title="Le toca volver · recompra" sub="Según el ciclo de cada servicio"
            right={<span className="badge pay"><span className="d" />{recompra.length} clientas</span>} />
          {recompra.length > 0 ? (
            <table className="table" style={{ marginTop: 6 }}>
              <thead><tr><th>Clienta</th><th>Servicio habitual</th><th>Última visita</th><th>Sugerida</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {recompra.map(({ c, i }) => (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => onPerfil(c)}>
                    <td><div className="cell-name"><Avatar ini={c.ini} size="sm" /><div className="nm">{c.nombre}</div></div></td>
                    <td className="muted">{c.fav} · cada {c.ciclo} sem</td>
                    <td className="muted">hace {i.dias} días</td>
                    <td className="muted">{i.proxStr}</td>
                    <td>
                      {i.recompra === 'atrasada'
                        ? <span className="badge canc"><span className="d" />Atrasada</span>
                        : <span className="badge pend"><span className="d" />Le toca</span>}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <button
                        className="btn sm"
                        style={{ background: '#25D366', color: '#fff', border: 'none' }}
                        onClick={() => abrirWA(c.tel, `Hola ${c.nombre.split(' ')[0]} 💛 En ${data.config.nombre} llevamos tiempo sin verte. Tu ${c.fav} te espera — ¿agendamos? 🗓`)}
                      >
                        <Ic n="whatsapp-logo" />Reagendar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="card-pad" style={{ textAlign: 'center', color: 'var(--text-4)', padding: '28px 0' }}>
              <Ic n="check-circle" size={28} style={{ display: 'block', margin: '0 auto 8px', color: 'var(--st-conf)' }} />
              Todas las clientas al día
            </div>
          )}
        </div>

        <div className="card">
          <CardHead title="Riesgo de fuga" sub="Clientas que podrías estar perdiendo" />
          <div className="card-pad" style={{ paddingTop: 8 }}>
            {riesgo.length > 0 ? riesgo.map(({ c, i }) => (
              <div key={c.id} className="list-item" style={{ padding: '13px 0', cursor: 'pointer' }} onClick={() => onPerfil(c)}>
                <Avatar ini={c.ini} size="sm" />
                <div className="f1" style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.nombre}</div>
                  <div className="vc gap8" style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>
                    {i.riesgo === 'fuga'
                      ? <span className="badge canc"><span className="d" />En fuga</span>
                      : <span className="badge pend"><span className="d" />En riesgo</span>}
                    <span>Sin venir hace {i.dias} días</span>
                  </div>
                </div>
              </div>
            )) : (
              <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: '20px 0', fontSize: 13 }}>Sin clientas en riesgo</div>
            )}
            {riesgo.length > 0 && (
              <div className="dim mt14" style={{ fontSize: 11.5, textAlign: 'center', lineHeight: 1.5 }}>
                Toca el nombre de cada clienta y usa el botón <b>Mensaje</b> para contactarla por WhatsApp.
              </div>
            )}
          </div>
        </div>

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
                <button
                className="btn sm"
                style={{ background: '#25D366', color: '#fff', border: 'none' }}
                onClick={() => abrirWA(c.tel, `¡Feliz cumpleaños ${c.nombre.split(' ')[0]}! 🎂 Todo el equipo de ${data.config.nombre} te desea un día increíble. Tienes un regalo especial esperándote 🎁`)}
              >
                <Ic n="whatsapp-logo" />Felicitar
              </button>
              </div>
            ))}
            {!cumples.length && <div className="dim center" style={{ padding: 24 }}>Sin cumpleaños en los próximos 30 días</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Pantalla principal CRM ─────────────────────────────────────────────────
export function ScreenCRM({ onNavigate }: { onNavigate: (r: string) => void }) {
  const { data, deleteClienta, upsertClienta } = useStore()
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('Todas')
  const [sort, setSort] = useState<{ k: keyof Clienta; dir: number }>({ k: 'ultima', dir: -1 })
  const [perfil, setPerfil] = useState<Clienta | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Clienta | null>(null)
  const [vista, setVista] = useState('Clientas')
  const [editCl, setEditCl] = useState<Partial<Clienta> | null>(null)
  const csvRef = useRef<HTMLInputElement>(null)

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const text = ev.target?.result as string
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      if (lines.length < 2) { toast('El archivo CSV está vacío'); return }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
      let imported = 0
      let failed = 0
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''))
        const get = (keys: string[]) => vals[headers.findIndex(h => keys.includes(h))] || ''
        const nombre = get(['nombre', 'name', 'cliente'])
        if (!nombre) continue
        const existing = data.clientas.find(c => c.nombre.toLowerCase() === nombre.toLowerCase())
        if (existing) continue
        try {
          await upsertClienta({
            id: 'cl' + Date.now() + i,
            nombre,
            tel: get(['tel', 'telefono', 'phone', 'celular']),
            estado: 'Nueva' as const,
            ultima: new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) + ' ' + new Date().getFullYear(),
            ticket: 0, fav: '', est: '', visitas: 0, gasto: 0,
            ini: nombre.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
            cumple: get(['cumple', 'cumpleaños', 'birthday']),
            ciclo: 0,
            notas: get(['notas', 'notes', 'comentarios']),
          })
          imported++
        } catch {
          failed++
        }
      }
      if (failed === 0) toast(imported > 0 ? `${imported} clienta${imported > 1 ? 's' : ''} importada${imported > 1 ? 's' : ''}` : 'No se encontraron clientas nuevas')
      else toast(`${imported} importadas, ${failed} fallaron. Revisa e intenta de nuevo con las que fallaron.`)
      e.target.value = ''
    }
    reader.readAsText(file)
  }

  const filtros = ['Todas', 'VIP', 'Frecuente', 'Activa', 'Nueva', 'Inactiva']

  // Conteos reales por estado
  const cuentas: Record<string, number> = {
    VIP:      data.clientas.filter(c => c.estado === 'VIP').length,
    Frecuente:data.clientas.filter(c => c.estado === 'Frecuente').length,
    Activa:   data.clientas.filter(c => c.estado === 'Activa').length,
    Nueva:    data.clientas.filter(c => c.estado === 'Nueva').length,
    Inactiva: data.clientas.filter(c => c.estado === 'Inactiva').length,
  }

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
  const Caret = ({ k }: { k: keyof Clienta }) => (
    <span className="caret">{sort.k === k ? (sort.dir === 1 ? '▲' : '▼') : '↕'}</span>
  )

  const confirmDeleteModal = confirmDelete && (
    <ConfirmModal
      title="¿Eliminar clienta?"
      desc={`${confirmDelete.nombre} será eliminada permanentemente del CRM.`}
      onConfirm={async () => {
        try {
          await deleteClienta(confirmDelete.id)
          setConfirmDelete(null); setPerfil(null); toast('Clienta eliminada')
        } catch {
          toast('No se pudo eliminar la clienta. Intenta de nuevo.')
        }
      }}
      onCancel={() => setConfirmDelete(null)}
    />
  )

  if (perfil) return (
    <>
      <ClientaPerfil
        c={perfil}
        onBack={() => setPerfil(null)}
        onEdit={() => setEditCl(perfil)}
        onDelete={() => setConfirmDelete(perfil)}
        onNavigate={onNavigate}
        editCl={editCl}
        setEditCl={setEditCl}
      />
      {confirmDeleteModal}
    </>
  )

  return (
    <div>
      <div className="between" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="display" style={{ fontSize: 26, margin: 0 }}>CRM de clientas</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            {data.clientas.length} clientas registradas · {cuentas.Nueva} nuevas
          </div>
        </div>
        <div className="vc gap12">
          <Seg opts={['Clientas', 'Retención']} value={vista} onChange={setVista} />
          <input ref={csvRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCsvImport} />
          <button className="btn ghost" onClick={() => csvRef.current?.click()}><Ic n="upload-simple" />Importar CSV</button>
          <button className="btn gold" onClick={() => setEditCl({})}><Ic n="plus" />Nueva clienta</button>
        </div>
      </div>

      {vista === 'Retención' ? <CRMRetencion onPerfil={setPerfil} /> : (
        <>
          {/* Mini KPIs calculados */}
          <div className="grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: 18 }}>
            {([
              ['VIP',       'VIP',       'crown-simple',  'var(--gold)'],
              ['Frecuente', 'Frecuentes','repeat',        'var(--st-frec)'],
              ['Activa',    'Activas',   'check-circle',  'var(--st-conf)'],
              ['Nueva',     'Nuevas',    'user-plus',     '#8FB2D8'],
              ['Inactiva',  'Inactivas', 'user-minus',    'var(--st-canc)'],
            ] as [string, string, string, string][]).map(([key, label, ic, color]) => (
              <div key={key} className="card card-pad vc gap12" style={{ cursor: 'pointer' }}
                onClick={() => setFiltro(key)}>
                <div className="ico" style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line-soft)', color }}>
                  <Ic n={ic} />
                </div>
                <div className="kpi-mini">
                  <span className="v" style={{ fontSize: 20 }}>{cuentas[key]}</span>
                  <span className="l">{label}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-pad between" style={{ paddingBottom: 16, flexWrap: 'wrap', gap: 14 }}>
              <div className="search" style={{ width: 320 }}>
                <Ic n="magnifying-glass" />
                <input placeholder="Buscar por nombre o teléfono…" value={q} onChange={e => setQ(e.target.value)} />
              </div>
              <div className="vc gap8" style={{ flexWrap: 'wrap' }}>
                {filtros.map(f => (
                  <button key={f} className="chip"
                    style={filtro === f ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : {}}
                    onClick={() => setFiltro(f)}>{f}</button>
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
                          <span className="dotc" style={{ background: visitCol }} />{c.ultima}
                        </span>
                      </td>
                      <td className="num" style={{ fontWeight: 600 }}>{mxn(c.ticket)}</td>
                      <td className="muted">{c.fav}</td>
                      <td>
                        <span className="vc" style={{ gap: 7, fontSize: 12.5 }}>
                          <span className="dotc" style={{ background: e.color }} />{e.nombre.split(' ')[0]}
                        </span>
                      </td>
                      <td><Ic n="caret-right" /></td>
                    </tr>
                  )
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-4)' }}>Sin resultados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editCl !== null && (
        <ClientaModal c={editCl} onClose={() => setEditCl(null)} onSaved={() => setEditCl(null)} />
      )}
      {confirmDeleteModal}
    </div>
  )
}

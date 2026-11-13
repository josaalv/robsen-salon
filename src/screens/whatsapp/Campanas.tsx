import React, { useState, useMemo } from 'react'
import { CardHead, Modal, toast } from '../../components/ui'
import { PhosphorIcon as Ic } from '../../components/PhosphorIcon'
import { useStore } from '../../data/store'
import { db } from '../../lib/db'
import { normalizarBusqueda } from '../../lib/helpers'
import type { WaPlantilla } from '../../types'
import { EST_META } from './shared'

// Mismas variables que ya usan las plantillas locales de Audiencias (misma
// sintaxis {var} para que el equipo no tenga que aprender dos formatos) —
// el server (wa-templates, action create-campana) las traduce a {{1}}/{{2}}
// posicional, que es lo que exige Meta. Este mismo orden (nombre, promo) se
// usa aquí al armar las variables por clienta — tiene que coincidir con el
// orden del server o el mensaje real le llegaría con los valores cruzados.
const ORDEN_VARS = ['nombre', 'promo'] as const
const VARS_CAMPANA = ['{nombre}', '{promo}']

// Punto de partida listo para usar — el equipo solo completa {promo} (el
// texto de la oferta) en vez de redactar una campaña desde cero cada vez.
// Siguen necesitando aprobación de Meta antes de poder lanzarse, como
// cualquier plantilla de marketing — esto no se salta ese paso, solo quita
// la fricción de escribir el mensaje.
const CAMPANAS_PREDEFINIDAS: { icon: string; etiqueta: string; cuerpo: string }[] = [
  {
    icon: 'sparkle',
    etiqueta: 'Promoción del mes',
    cuerpo: 'Hola {nombre} 💛 Este mes en Robsen Salón & Spa tenemos {promo}. ¿Agendamos tu cita? Contesta este mensaje y te apartamos tu lugar ✨',
  },
  {
    icon: 'users-three',
    etiqueta: 'Trae una amiga',
    cuerpo: 'Hola {nombre} 💅 ¿Conoces a alguien que ama consentirse tanto como tú? Trae a una amiga y las dos reciben {promo} en Robsen Salón & Spa. ¡Agenden juntas!',
  },
  {
    icon: 'clock-countdown',
    etiqueta: 'Tiempo limitado',
    cuerpo: 'Hola {nombre} ✨ Por tiempo limitado: {promo} en Robsen Salón & Spa. Agenda esta semana para no quedarte sin lugar — responde este mensaje 💛',
  },
  {
    icon: 'star',
    etiqueta: 'Nuevo servicio',
    cuerpo: 'Hola {nombre} 💛 Tenemos algo nuevo que te va a encantar: {promo}. ¿Quieres ser de las primeras en probarlo en Robsen Salón & Spa? Escríbenos 🌟',
  },
  {
    icon: 'heart',
    etiqueta: 'Clienta especial',
    cuerpo: 'Hola {nombre} 💛 Como clienta de Robsen Salón & Spa, tienes acceso a {promo}. Te esperamos pronto para consentirte otra vez ✨',
  },
  {
    icon: 'gift',
    etiqueta: 'Fecha especial / temporada',
    cuerpo: '¡Hola {nombre}! 🎉 Por {promo}, consiéntete en Robsen Salón & Spa. Agenda ya, los lugares se llenan rápido 💛',
  },
]

function NuevaCampanaModal({ inicial, onClose, onCreada }: { inicial?: { etiqueta: string; cuerpo: string }; onClose: () => void; onCreada: () => void }) {
  const [etiqueta, setEtiqueta] = useState(inicial?.etiqueta || '')
  const [cuerpo, setCuerpo] = useState(inicial?.cuerpo || '')
  const [enviando, setEnviando] = useState(false)

  const varsEnTexto = cuerpo.match(/\{[^}]+\}/g) || []
  const varsInvalidas = varsEnTexto.filter(v => !VARS_CAMPANA.includes(v))
  const tieneVar = varsEnTexto.some(v => VARS_CAMPANA.includes(v))
  const canSave = !!etiqueta.trim() && !!cuerpo.trim() && varsInvalidas.length === 0 && tieneVar

  const insertVar = (v: string) => setCuerpo(prev => prev + v)

  const guardar = async () => {
    if (!canSave || enviando) {
      if (!etiqueta.trim() || !cuerpo.trim()) toast('Completa el nombre y el mensaje.')
      else if (varsInvalidas.length) toast(`Variable inválida: ${varsInvalidas[0]}`)
      else if (!tieneVar) toast('El mensaje debe usar {nombre} y/o {promo}.')
      return
    }
    setEnviando(true)
    try {
      await db.crearPlantillaCampana(etiqueta.trim(), cuerpo.trim())
      toast('Campaña sometida a Meta para revisión — normalmente tarda algunas horas.')
      onCreada()
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo someter la plantilla. Intenta de nuevo.')
      setEnviando(false)
    }
  }

  return (
    <Modal onClose={onClose} width={480}>
      <div style={{ borderTop: '3px solid var(--gold)', borderRadius: 'var(--radius) var(--radius) 0 0' }}>
        <div className="between card-pad" style={{ borderBottom: '1px solid var(--line-soft)', paddingBottom: 16 }}>
          <div>
            <h3 className="serif" style={{ margin: 0, fontSize: 20 }}>{inicial ? 'Usar plantilla sugerida' : 'Nueva campaña'}</h3>
            {inicial && <div className="dim" style={{ fontSize: 11.5, marginTop: 3 }}>Ajusta el texto si quieres — {'{promo}'} se llena después, al lanzarla.</div>}
          </div>
          <button className="btn ghost icon-btn" onClick={onClose}><Ic n="x" /></button>
        </div>
        <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label className="label">Nombre de la campaña</label>
            <input className="input" value={etiqueta} onChange={e => setEtiqueta(e.target.value)} placeholder="Ej. Promo Buen Fin 2026" />
            <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>Solo para identificarla en el panel — la clienta no la ve.</div>
          </div>
          <div className="field">
            <div className="between" style={{ marginBottom: 6 }}>
              <label className="label" style={{ marginBottom: 0 }}>Mensaje</label>
              <div className="vc gap4">
                {VARS_CAMPANA.map(v => (
                  <button key={v} className="chip" style={{ fontSize: 10.5, padding: '2px 7px' }} onClick={() => insertVar(v)}>{v}</button>
                ))}
              </div>
            </div>
            <textarea
              className="input" rows={5} value={cuerpo} onChange={e => setCuerpo(e.target.value)}
              style={{ resize: 'vertical', lineHeight: 1.6 }}
              placeholder="Hola {nombre} 💛 {promo}. Agenda tu cita respondiendo este mensaje — Robsen Salón & Spa"
            />
            {varsInvalidas.length > 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--st-canc)', marginTop: 5 }}>
                Variable inválida: {varsInvalidas.join(', ')} · usa solo {VARS_CAMPANA.join(' o ')}
              </div>
            )}
          </div>
          <div className="dim" style={{ fontSize: 11.5, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px' }}>
            Meta revisa cada plantilla nueva antes de poder usarla — normalmente tarda algunas horas, a veces hasta un día. Somete la campaña con anticipación, no el mismo día que la quieres mandar.
          </div>
        </div>
        <div className="between card-pad" style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn gold" disabled={!canSave || enviando} style={{ opacity: canSave && !enviando ? 1 : .5 }} onClick={guardar}>
            <Ic n={enviando ? 'spinner' : 'paper-plane-tilt'} />{enviando ? 'Enviando a Meta…' : 'Someter a aprobación'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function LanzarCampanaModal({ plantilla, onClose, onEnviado }: { plantilla: WaPlantilla; onClose: () => void; onEnviado: () => void }) {
  const { data } = useStore()
  const necesitaPromo = plantilla.cuerpo.includes('{promo}')
  const [promo, setPromo] = useState('')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [confirmEnvio, setConfirmEnvio] = useState(false)
  const [enviando, setEnviando] = useState(false)

  // Respeta el opt-out de WhatsApp de cada clienta (switch "Recibe mensajes
  // por WhatsApp" en su perfil) — igual que todos los flujos automáticos, una
  // campaña manual no es excepción.
  const candidatas = useMemo(() => data.clientas.filter(c => c.waOptin !== false && c.tel), [data.clientas])
  const filtradas = useMemo(
    () => q ? candidatas.filter(c => normalizarBusqueda(c.nombre).includes(normalizarBusqueda(q))) : candidatas,
    [candidatas, q],
  )

  const toggle = (id: string) => setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const seleccionarFiltradas = () => setSel(new Set(filtradas.map(c => c.id)))
  const limpiarSel = () => setSel(new Set())

  const resolverTexto = (nombreCorto: string) =>
    plantilla.cuerpo.replace('{nombre}', nombreCorto).replace('{promo}', promo.trim() || '…')

  const UMBRAL_MASIVO = 5
  const lanzar = async () => {
    if (necesitaPromo && !promo.trim()) { toast('Completa el texto de la promoción.'); return }
    if (!sel.size) { toast('Selecciona al menos una clienta.'); return }
    if (sel.size >= UMBRAL_MASIVO && !confirmEnvio) { setConfirmEnvio(true); return }
    setEnviando(true)
    try {
      const elegidas = [...sel].map(id => data.clientas.find(c => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c)
      const presentes = ORDEN_VARS.filter(k => plantilla.cuerpo.includes(`{${k}}`))
      await db.insertWaMensajes(elegidas.map(c => {
        const nombreCorto = c.nombre.split(' ')[0]
        const valores: Record<string, string> = { nombre: nombreCorto, promo: promo.trim() }
        const variables: Record<string, string> = {}
        presentes.forEach((k, i) => { variables[String(i + 1)] = valores[k] })
        return {
          clientaId: c.id, tel: c.tel, flujo: 'campana', plantilla: plantilla.nombre,
          variables, cuerpo: resolverTexto(nombreCorto),
          estado: 'pendiente_aprobacion' as const, requiereAprobacion: true, creadoPor: 'staff',
        }
      }))
      toast(`${elegidas.length} mensaje${elegidas.length > 1 ? 's' : ''} agregado${elegidas.length > 1 ? 's' : ''} a la cola de aprobación (arriba, en Automatización).`)
      onEnviado()
      onClose()
    } catch {
      toast('No se pudo encolar la campaña. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal onClose={onClose} width={640}>
      <div style={{ borderTop: '3px solid var(--gold)', borderRadius: 'var(--radius) var(--radius) 0 0' }}>
        <div className="between card-pad" style={{ borderBottom: '1px solid var(--line-soft)', paddingBottom: 16 }}>
          <div>
            <div className="eyebrow">Lanzar campaña</div>
            <h3 style={{ margin: '4px 0 0' }}>{plantilla.nombre.replace(/^promo_/, '').replace(/_/g, ' ')}</h3>
          </div>
          <button className="btn ghost icon-btn" onClick={onClose}><Ic n="x" /></button>
        </div>
        <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {necesitaPromo && (
            <div className="field">
              <label className="label">Texto de la promoción ({'{promo}'})</label>
              <input className="input" value={promo} onChange={e => setPromo(e.target.value)} placeholder="Ej. 20% de descuento en tintes todo noviembre" />
            </div>
          )}
          <div className="field" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px' }}>
            <div className="dim" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Vista previa</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{resolverTexto('Ana')}</div>
          </div>

          <div className="field">
            <div className="between" style={{ marginBottom: 6 }}>
              <label className="label" style={{ marginBottom: 0 }}>Destinatarias ({candidatas.length} con WhatsApp activo)</label>
              <div className="vc gap8">
                <button className="btn ghost sm" onClick={seleccionarFiltradas}>Seleccionar {q ? 'filtradas' : 'todas'} ({filtradas.length})</button>
                {sel.size > 0 && <button className="btn ghost sm" onClick={limpiarSel}>Ninguna</button>}
              </div>
            </div>
            <input className="input" placeholder="Buscar clienta…" value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 8 }} />
            <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--line-soft)', borderRadius: 8 }}>
              {filtradas.length === 0 ? (
                <div className="dim" style={{ padding: 16, fontSize: 12.5, textAlign: 'center' }}>Sin clientas que coincidan.</div>
              ) : filtradas.map(c => (
                <label key={c.id} className="vc gap10" style={{ padding: '8px 12px', borderBottom: '1px solid var(--line-soft)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} />
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{c.nombre}</span>
                  <span className="dim" style={{ fontSize: 11 }}>{c.tel}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="between card-pad" style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 16 }}>
          <span className="dim" style={{ fontSize: 12 }}>{sel.size} seleccionada{sel.size !== 1 ? 's' : ''}</span>
          <button
            className={confirmEnvio ? 'btn' : 'btn gold'}
            style={confirmEnvio ? { background: 'var(--st-canc)', color: '#fff', border: 'none' } : undefined}
            disabled={enviando || sel.size === 0}
            onClick={lanzar}
          >
            <Ic n={enviando ? 'spinner' : confirmEnvio ? 'warning-circle' : 'paper-plane-tilt'} />
            {enviando ? 'Encolando…' : confirmEnvio ? `¿Mandar a ${sel.size}? Confirmar` : `Encolar campaña (${sel.size})`}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export function Campanas({ plantillas, recargar }: { plantillas: WaPlantilla[]; recargar: () => Promise<void> }) {
  const [modal, setModal] = useState<{ etiqueta: string; cuerpo: string } | 'nueva' | null>(null)
  const [lanzando, setLanzando] = useState<WaPlantilla | null>(null)
  const [sincronizando, setSincronizando] = useState(false)

  const campanas = plantillas.filter(p => p.flujo === 'campana')

  const sincronizar = async () => {
    setSincronizando(true)
    try {
      const r = await db.sincronizarWaPlantillas()
      await recargar()
      toast(r?.sincronizados ? `Estado actualizado desde Meta (${r.sincronizados} plantillas).` : 'Sin cambios desde Meta.')
    } catch {
      toast('No se pudo consultar Meta. Intenta de nuevo.')
    } finally {
      setSincronizando(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {modal && (
        <NuevaCampanaModal
          inicial={modal === 'nueva' ? undefined : modal}
          onClose={() => setModal(null)}
          onCreada={recargar}
        />
      )}
      {lanzando && <LanzarCampanaModal plantilla={lanzando} onClose={() => setLanzando(null)} onEnviado={recargar} />}

      <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <CardHead title="Plantillas sugeridas" sub="Puntos de partida listos — elige una, ajusta el texto si quieres y sométela a aprobación" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
          {CAMPANAS_PREDEFINIDAS.map(p => (
            <div key={p.etiqueta} style={{ border: '1px solid var(--line-soft)', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="vc gap8">
                <Ic n={p.icon} size={16} style={{ color: 'var(--gold)' }} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>{p.etiqueta}</span>
              </div>
              <div className="dim" style={{ fontSize: 11.5, lineHeight: 1.45, flex: 1 }}>{p.cuerpo}</div>
              <button className="btn ghost sm" style={{ justifyContent: 'center' }} onClick={() => setModal(p)}>
                <Ic n="arrow-right" size={13} />Usar esta
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="between" style={{ flexWrap: 'wrap', gap: 10 }}>
          <CardHead title="Campañas de marketing" sub="Plantillas para promociones puntuales — se mandan desde aquí, no automáticamente" />
          <div className="vc gap8">
            <button className="btn ghost sm" disabled={sincronizando} onClick={sincronizar}>
              <Ic n={sincronizando ? 'spinner' : 'arrows-clockwise'} size={13} />{sincronizando ? 'Consultando…' : 'Sincronizar con Meta'}
            </button>
            <button className="btn gold sm" onClick={() => setModal('nueva')}><Ic n="plus" size={13} />Nueva campaña desde cero</button>
          </div>
        </div>

        {campanas.length === 0 ? (
          <div className="dim" style={{ textAlign: 'center', padding: '28px 0', fontSize: 13 }}>
            Todavía no hay campañas. Crea la primera para empezar a atraer clientas con promociones.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {campanas.map(p => {
              const e = EST_META[p.estadoMeta] || EST_META.borrador
              const aprobada = p.estadoMeta === 'aprobada'
              return (
                <div key={p.id} className="between" style={{ border: '1px solid var(--line-soft)', borderRadius: 10, padding: '12px 14px', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="vc gap8" style={{ marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 13.5 }}>{p.nombre.replace(/^promo_/, '').replace(/_/g, ' ')}</span>
                      <span className="badge" style={{ fontSize: 10.5, color: e.color, borderColor: e.color }}>{e.label}</span>
                    </div>
                    <div className="dim" style={{ fontSize: 12, lineHeight: 1.4 }}>{p.cuerpo}</div>
                  </div>
                  <button className="btn gold sm" disabled={!aprobada} style={{ opacity: aprobada ? 1 : .4, flexShrink: 0 }}
                    title={aprobada ? undefined : 'Espera a que Meta la apruebe (usa "Sincronizar con Meta" para ver el estado real)'}
                    onClick={() => setLanzando(p)}>
                    <Ic n="paper-plane-tilt" size={13} />Lanzar
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

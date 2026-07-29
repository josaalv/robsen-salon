import React, { useState, useMemo, useEffect } from 'react'
import { Avatar, CardHead, Switch, Seg, toast, Modal } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { useStore } from '../data/store'
import { useAuth } from '../lib/auth'
import { db } from '../lib/db'
import { mxn, filtrarTel, telefonoValido } from '../lib/helpers'
import type { Clienta, WaMensaje, WaPlantilla } from '../types'

const VENTANA_24H_MS = 24 * 60 * 60 * 1000
const norm10 = (t: string) => (t || '').replace(/\D/g, '').slice(-10)

// ─── Helpers ──────────────────────────────────────────────────────────────────
const HOY = new Date()
const MESES: Record<string, number> = { Ene:0,Feb:1,Mar:2,Abr:3,May:4,Jun:5,Jul:6,Ago:7,Sep:8,Oct:9,Nov:10,Dic:11 }

function diasDesde(ultima: string): number {
  const [d, mes, y] = ultima.split(' ')
  if (!y) return 999
  return Math.floor((HOY.getTime() - new Date(+y, MESES[mes] ?? 0, +d).getTime()) / 86400000)
}

function diasCumple(cumple: string): number {
  const [d, mes] = cumple.split(' ')
  let f = new Date(HOY.getFullYear(), MESES[mes] ?? 0, +d)
  if (f < HOY) f = new Date(HOY.getFullYear() + 1, MESES[mes] ?? 0, +d)
  return Math.round((f.getTime() - HOY.getTime()) / 86400000)
}

function waUrl(tel: string, msg: string) {
  const n = tel.replace(/\D/g, '')
  return `https://wa.me/${n.startsWith('52') ? n : '52' + n}?text=${encodeURIComponent(msg)}`
}

const CAT_SEC: Record<string, string> = {
  Mechas:'mechas', Extensiones:'mechas',
  'Colorimetría':'color',
  Tratamientos:'tratamiento',
  'Uñas':'unas', Pedicure:'unas',
  Cortes:'cortes',
  Maquillaje:'maquillaje', Depilación:'maquillaje', Paquetes:'maquillaje',
}

interface Item {
  id: string; nombre: string; tel: string; ini: string
  contexto: string; sub?: string; urgencia: 'alta'|'media'|'baja'; msg: string
  automatico?: WaMensaje
}

// Secciones con equivalente automático (manana→recordatorio_24h,
// cumples→cumpleanos, inactivas→reactivacion): si ya existe un wa_mensajes
// para esa clienta/cita, se muestra su estado real en vez de dejar que el
// admin le escriba a ciegas por encima de lo que el sistema ya hizo.
const AUTO_CONTACTADO: WaMensaje['estado'][] = ['enviado', 'entregado', 'leido', 'respondido']

const URGCOLOR = { alta:'var(--st-canc)', media:'var(--st-pend)', baja:'var(--text-3)' }

// ─── Sections config ──────────────────────────────────────────────────────────
const SECS = [
  { id:'hoy_pend',    label:'Sin confirmar hoy',   icon:'warning-circle', group:'URGENTE'      },
  { id:'cobros',      label:'Cobros pendientes',    icon:'hand-coins',     group:'URGENTE'      },
  { id:'manana',      label:'Recordatorios mañana', icon:'calendar-check', group:'HOY'          },
  { id:'post_visita', label:'Post-visita',          icon:'heart',          group:'HOY'          },
  { id:'mechas',      label:'Mechas & Balayage',    icon:'sparkle',        group:'REACTIVACIÓN' },
  { id:'color',       label:'Colorimetría & Raíz',  icon:'drop',           group:'REACTIVACIÓN' },
  { id:'tratamiento', label:'Tratamientos',         icon:'leaf',           group:'REACTIVACIÓN' },
  { id:'unas',        label:'Uñas & Manicure',      icon:'paint-brush',    group:'REACTIVACIÓN' },
  { id:'cortes',      label:'Cortes',               icon:'scissors',       group:'REACTIVACIÓN' },
  { id:'maquillaje',  label:'Maquillaje & Spa',     icon:'star',           group:'REACTIVACIÓN' },
  { id:'cumples',     label:'Cumpleaños',           icon:'gift',           group:'FIDELIZACIÓN' },
  { id:'nuevas',      label:'Clientas nuevas',      icon:'user-plus',      group:'FIDELIZACIÓN' },
  { id:'inactivas',   label:'Inactivas +60 días',   icon:'user-minus',     group:'FIDELIZACIÓN' },
]

// ─── Nueva plantilla modal ─────────────────────────────────────────────────────
const VARS_VALIDAS = ['{nombre}', '{servicio}', '{fecha}', '{hora}', '{estilista}', '{dias}']

function NuevaPlantillaModal({ onClose }: { onClose: () => void }) {
  const { upsertPlantilla } = useStore()
  const [nombre, setNombre] = useState('')
  const [txt, setTxt] = useState('')
  const ICONS = ['chat-text','calendar-check','clock-countdown','hand-coins','user-plus','gift','sparkle']
  const [icon, setIcon] = useState('chat-text')

  const varsEnTexto = txt.match(/\{[^}]+\}/g) || []
  const varsInvalidas = varsEnTexto.filter(v => !VARS_VALIDAS.includes(v))
  const canSave = nombre.trim() && txt.trim() && varsInvalidas.length === 0

  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!canSave || saving) { if (!canSave) toast(varsInvalidas.length > 0 ? `Variable inválida: ${varsInvalidas[0]}` : 'Completa nombre y mensaje'); return }
    setSaving(true)
    try {
      await upsertPlantilla({ id:'pl'+Date.now(), nombre:nombre.trim(), icon, txt:txt.trim() })
      toast('Plantilla guardada'); onClose()
    } catch {
      toast('No se pudo guardar la plantilla. Intenta de nuevo.')
      setSaving(false)
    }
  }

  const insertVar = (v: string) => setTxt(prev => prev + v)

  return (
    <Modal onClose={onClose} width={480}>
      <div style={{ borderTop:'3px solid var(--gold)', borderRadius:'var(--radius) var(--radius) 0 0' }}>
        <div className="between card-pad" style={{ borderBottom:'1px solid var(--line-soft)', paddingBottom:16 }}>
          <h3 className="serif" style={{ margin:0, fontSize:20 }}>Nueva plantilla</h3>
          <button className="btn ghost icon-btn" onClick={onClose}><Ic n="x" /></button>
        </div>
        <div className="card-pad" style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="field"><label className="label">Nombre</label>
            <input className="input" value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Ej. Confirmación de cita" />
          </div>
          <div className="field"><label className="label">Icono</label>
            <div className="vc gap8">{ICONS.map(ic=>(
              <button key={ic} className="btn ghost icon-btn"
                style={{ width:36,height:36,borderColor:icon===ic?'var(--gold)':undefined,color:icon===ic?'var(--gold)':undefined }}
                onClick={()=>setIcon(ic)}><Ic n={ic} size={18}/></button>
            ))}</div>
          </div>
          <div className="field">
            <div className="between" style={{ marginBottom: 6 }}>
              <label className="label" style={{ marginBottom: 0 }}>Mensaje</label>
              <div className="vc gap4" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {VARS_VALIDAS.map(v => (
                  <button key={v} className="chip" style={{ fontSize: 10.5, padding: '2px 7px' }} onClick={() => insertVar(v)}>{v}</button>
                ))}
              </div>
            </div>
            <textarea className="input" rows={5}
              value={txt} onChange={e=>setTxt(e.target.value)}
              style={{ resize:'vertical', lineHeight:1.6 }} />
            {varsInvalidas.length > 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--st-canc)', marginTop: 5 }}>
                Variable inválida: {varsInvalidas.join(', ')} · usa solo las variables del botón
              </div>
            )}
          </div>
        </div>
        <div className="between card-pad" style={{ borderTop:'1px solid var(--line-soft)', paddingTop:16 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn gold" disabled={!canSave || saving} style={{ opacity: canSave && !saving ? 1 : .5 }} onClick={save}><Ic n="check"/>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </Modal>
  )
}

const WA_CONTACTADOS_KEY = 'rb_wa_contactados'

function loadContactados(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(WA_CONTACTADOS_KEY) || '[]')) } catch { return new Set() }
}
function saveContactados(s: Set<string>) {
  localStorage.setItem(WA_CONTACTADOS_KEY, JSON.stringify([...s]))
}

// ─── Main screen ──────────────────────────────────────────────────────────────
// ─── Panel de automatización (cola + aprobación) ────────────────────────────
const EST_META: Record<string, { label: string; color: string }> = {
  aprobada:  { label: 'Aprobada', color: 'var(--st-conf)' },
  pendiente: { label: 'En revisión', color: 'var(--st-pend)' },
  rechazada: { label: 'Rechazada', color: 'var(--st-canc)' },
  borrador:  { label: 'Borrador', color: 'var(--text-3)' },
}
const EST_MSG: Record<string, { label: string; color: string }> = {
  pendiente_aprobacion: { label: 'Por aprobar',   color: 'var(--st-pend)' },
  aprobado:             { label: 'Listo',          color: 'var(--gold)' },
  enviando:             { label: 'Enviando',       color: 'var(--gold)' },
  enviado:              { label: 'Enviado',        color: 'var(--st-conf)' },
  entregado:            { label: 'Entregado ✓✓',   color: 'var(--st-conf)' },
  leido:                { label: 'Leído',          color: 'var(--st-conf)' },
  respondido:           { label: 'Respondió',      color: 'var(--gold)' },
  fallido:              { label: 'Falló',          color: 'var(--st-canc)' },
  cancelado:            { label: 'Cancelado',      color: 'var(--text-3)' },
}
const FLUJO_LABEL: Record<string, string> = {
  confirmacion: 'Confirmación', recordatorio_24h: 'Recordatorio', post_visita: 'Post-visita',
  cumpleanos: 'Cumpleaños', bienvenida: 'Bienvenida', reactivacion: 'Reactivación',
}

// Modo prueba: mientras está activo, el envío real (cron cada 30 min y el
// botón "Enviar aprobados") solo entrega a waTestTel — cualquier otro
// mensaje se queda en la cola sin salir. Es la manera de dejar todo el
// flujo conectado y probarlo de punta a punta sin riesgo de que le llegue
// algo a una clienta real. Solo el admin puede verlo y cambiarlo.
function ModoPrueba() {
  const { data, updateConfig } = useStore()
  const cfg = data.config
  const [tel, setTel] = useState(cfg.waTestTel || '')
  const [guardando, setGuardando] = useState(false)

  const toggle = async () => {
    try { await updateConfig({ waModoPrueba: !cfg.waModoPrueba }) }
    catch { toast('No se pudo guardar el cambio. Intenta de nuevo.') }
  }
  const guardarTel = async () => {
    if (tel && !telefonoValido(tel)) { toast('Teléfono inválido.'); return }
    setGuardando(true)
    try { await updateConfig({ waTestTel: tel || undefined }); toast('Teléfono de prueba actualizado.') }
    catch { toast('No se pudo guardar. Intenta de nuevo.') }
    finally { setGuardando(false) }
  }

  return (
    <div
      className="card card-pad"
      style={{ display: 'flex', flexDirection: 'column', gap: 10, borderColor: cfg.waModoPrueba ? 'var(--gold)' : undefined }}
    >
      <div className="between" style={{ gap: 10, flexWrap: 'wrap' }}>
        <div className="vc gap8">
          <Switch on={cfg.waModoPrueba} onClick={toggle} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Modo prueba</div>
            <div className="dim" style={{ fontSize: 11.5 }}>
              {cfg.waModoPrueba
                ? 'Activo: el envío real solo llega al teléfono de prueba, sin importar qué haya en la cola.'
                : 'Apagado: el envío real llega a cualquier clienta que califique. Úsalo solo cuando ya probaste todo.'}
            </div>
          </div>
        </div>
        <div className="vc gap8">
          <input
            className="input sm"
            style={{ width: 160 }}
            placeholder="Tel. de prueba"
            value={tel}
            onChange={e => setTel(filtrarTel(e.target.value))}
          />
          <button className="btn ghost sm" disabled={guardando || tel === (cfg.waTestTel || '')} onClick={guardarTel}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface PanelAutomatizacionProps {
  plantillas: WaPlantilla[]; cola: WaMensaje[]; cargando: boolean
  setCola: React.Dispatch<React.SetStateAction<WaMensaje[]>>
  recargar: () => Promise<void>
}

function PanelAutomatizacion({ plantillas, cola, cargando, setCola, recargar }: PanelAutomatizacionProps) {
  const { data } = useStore()
  const { user } = useAuth()
  const esAdmin = user?.rol === 'admin'
  const [enviando, setEnviando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [confirmVaciar, setConfirmVaciar] = useState(false)

  const tplPorFlujo = useMemo(() => {
    const m: Record<string, WaPlantilla> = {}
    plantillas.forEach(p => { if (p.flujo) m[p.flujo] = p })
    return m
  }, [plantillas])

  const setEstado = async (m: WaMensaje, estado: WaMensaje['estado']) => {
    setCola(prev => prev.map(x => x.id === m.id ? { ...x, estado } : x))
    try { await db.updateWaMensaje(m.id, { estado }) }
    catch { toast('No se pudo actualizar. Intenta de nuevo.'); recargar() }
  }
  const aprobarTodos = async () => {
    const pend = cola.filter(m => m.estado === 'pendiente_aprobacion')
    for (const m of pend) await setEstado(m, 'aprobado')
    if (pend.length) toast(`${pend.length} aprobado${pend.length > 1 ? 's' : ''}.`)
  }
  const vaciar = async () => {
    try {
      await db.vaciarColaWa()
      await recargar()
      setConfirmVaciar(false)
      toast('Solicitudes borradas.')
    } catch {
      toast('No se pudo vaciar la cola. Intenta de nuevo.')
    }
  }
  const sincronizar = async () => {
    setSincronizando(true)
    try {
      const r = await db.sincronizarWaPlantillas()
      await recargar()
      toast(r?.sincronizados ? `Estado actualizado desde Meta (${r.sincronizados} plantillas).` : 'Sin cambios desde Meta.')
    } catch {
      toast('No se pudo consultar Meta. Revisa el token e intenta de nuevo.')
    } finally {
      setSincronizando(false)
    }
  }
  const enviarAprobados = async () => {
    setEnviando(true)
    try {
      const r = await db.enviarWaAprobados()
      await recargar()
      toast(r?.procesados ? `${r.procesados} mensaje${r.procesados > 1 ? 's' : ''} enviado${r.procesados > 1 ? 's' : ''}.` : 'No había mensajes listos para enviar.')
    } catch {
      toast('No se pudo enviar. Revisa el token de WhatsApp e intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  const porAprobar = cola.filter(m => m.estado === 'pendiente_aprobacion')
  const listos     = cola.filter(m => m.estado === 'aprobado')
  const enviados   = cola.filter(m => ['enviando', 'enviado', 'entregado', 'leido', 'respondido'].includes(m.estado))
  const borrables  = cola.filter(m => ['borrador', 'pendiente_aprobacion', 'aprobado', 'fallido'].includes(m.estado)).length
  const aprobadasN = plantillas.filter(p => p.estadoMeta === 'aprobada').length

  const nombreDe = (m: WaMensaje) => data.clientas.find(c => c.id === m.clientaId)?.nombre || m.tel

  const Fila = ({ m, acciones }: { m: WaMensaje; acciones?: React.ReactNode }) => {
    const est = EST_MSG[m.estado] || { label: m.estado, color: 'var(--text-3)' }
    return (
      <div style={{ padding: '12px 14px', border: '1px solid var(--line-soft)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="between" style={{ gap: 10 }}>
          <div className="vc gap8" style={{ minWidth: 0 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{nombreDe(m)}</span>
            <span className="badge neutral" style={{ fontSize: 10.5 }}>{FLUJO_LABEL[m.flujo] || m.flujo}</span>
          </div>
          <span className="badge" style={{ fontSize: 10.5, color: est.color, borderColor: est.color }}>{est.label}</span>
        </div>
        <div className="dim" style={{ fontSize: 12, lineHeight: 1.45 }}>{m.cuerpo}</div>
        {acciones && <div className="vc gap8" style={{ marginTop: 2 }}>{acciones}</div>}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {esAdmin && <ModoPrueba />}
      <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 2 }}>Automatización</div>
          <h3 style={{ margin: 0 }}>WhatsApp automático</h3>
        </div>
        <div className="vc gap8">
          {porAprobar.length > 0 && (
            <button className="btn ghost sm" onClick={aprobarTodos}><Ic n="check" />Aprobar todos ({porAprobar.length})</button>
          )}
          {listos.length > 0 && (
            <button className="btn gold sm" disabled={enviando} onClick={enviarAprobados}>
              <Ic n={enviando ? 'spinner' : 'paper-plane-tilt'} />{enviando ? 'Enviando…' : `Enviar aprobados (${listos.length})`}
            </button>
          )}
          {borrables > 0 && (
            <button
              className="btn ghost sm"
              style={{ color: 'var(--st-canc)' }}
              onClick={() => (confirmVaciar ? vaciar() : setConfirmVaciar(true))}
              onMouseLeave={() => setConfirmVaciar(false)}
              title="Borra todas las solicitudes pendientes de una vez"
            >
              <Ic n="trash" />{confirmVaciar ? '¿Confirmar borrar todo?' : `Vaciar solicitudes (${borrables})`}
            </button>
          )}
        </div>
      </div>

      {/* Estado de plantillas */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <span className="dim" style={{ fontSize: 12 }}>Plantillas: <b>{aprobadasN}/{plantillas.length || 6}</b> aprobadas por Meta</span>
        <button className="btn ghost sm" disabled={sincronizando} onClick={sincronizar} title="Consulta a Meta el estado real de aprobación">
          <Ic n={sincronizando ? 'spinner' : 'arrows-clockwise'} size={13} />{sincronizando ? 'Consultando…' : 'Sincronizar con Meta'}
        </button>
        {plantillas.map(p => {
          const e = EST_META[p.estadoMeta] || EST_META.borrador
          return <span key={p.id} className="badge" style={{ fontSize: 10.5, color: e.color, borderColor: e.color }}>{FLUJO_LABEL[p.flujo || ''] || p.nombre} · {e.label}</span>
        })}
      </div>
      {aprobadasN < (plantillas.length || 6) && (
        <div className="dim" style={{ fontSize: 11.5, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px' }}>
          El envío real se activa cuando Meta apruebe las plantillas (en revisión). Mientras tanto puedes generar y aprobar la cola.
        </div>
      )}

      {cargando ? (
        <div className="dim center" style={{ padding: 20, fontSize: 13 }}>Cargando…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="eyebrow">Por aprobar ({porAprobar.length})</div>
            {porAprobar.length === 0 && <div className="dim" style={{ fontSize: 12 }}>Nada pendiente.</div>}
            {porAprobar.map(m => (
              <Fila key={m.id} m={m} acciones={<>
                <button className="btn gold sm" onClick={() => setEstado(m, 'aprobado')}><Ic n="check" />Aprobar</button>
                <button className="btn ghost sm" onClick={() => setEstado(m, 'cancelado')}>Descartar</button>
              </>} />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="eyebrow">Listos para enviar ({listos.length})</div>
            {listos.length === 0 && <div className="dim" style={{ fontSize: 12 }}>Nada listo.</div>}
            {listos.map(m => (
              <Fila key={m.id} m={m} acciones={
                <button className="btn ghost sm" onClick={() => setEstado(m, 'cancelado')}>Cancelar</button>
              } />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="eyebrow">Enviados ({enviados.length})</div>
            {enviados.length === 0 && <div className="dim" style={{ fontSize: 12 }}>Aún nada enviado.</div>}
            {enviados.map(m => <Fila key={m.id} m={m} />)}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

// ─── Bandeja de conversaciones ──────────────────────────────────────────────
// Agrupa toda la cola (automática + entrante) por teléfono para armar el
// historial real de ida y vuelta con cada clienta, y permite contestar texto
// libre — solo dentro de la ventana de 24h que exige Meta (se abre cada vez
// que la clienta escribe). Solo se listan conversaciones donde la clienta ya
// contestó algo alguna vez; el resto es solo envío automático sin respuesta.
interface Hilo {
  tel10: string; tel: string; nombre: string; mensajes: WaMensaje[]
  ultimo: WaMensaje; ventanaAbierta: boolean
}

function Conversaciones({ cola, recargar }: { cola: WaMensaje[]; recargar: () => Promise<void> }) {
  const { data } = useStore()
  const [selTel, setSelTel] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)

  const hilos = useMemo((): Hilo[] => {
    const grupos = new Map<string, WaMensaje[]>()
    for (const m of cola) {
      const key = norm10(m.tel)
      if (!key) continue
      if (!grupos.has(key)) grupos.set(key, [])
      grupos.get(key)!.push(m)
    }
    return [...grupos.entries()]
      .map(([tel10, msgs]): Hilo | null => {
        const ordenados = [...msgs].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
        const ultimoEntrante = [...ordenados].reverse().find(m => m.creadoPor === 'clienta')
        if (!ultimoEntrante) return null // nunca contestó — no es una conversación, solo envíos nuestros
        const ultimo = ordenados[ordenados.length - 1]
        const clienta = data.clientas.find(c => norm10(c.tel) === tel10)
        const ventanaAbierta = (Date.now() - new Date(ultimoEntrante.createdAt).getTime()) < VENTANA_24H_MS
        return { tel10, tel: ultimo.tel, nombre: clienta?.nombre || ultimo.tel, mensajes: ordenados, ultimo, ventanaAbierta }
      })
      .filter((h): h is Hilo => h !== null)
      .sort((a, b) => (b.ultimo.createdAt || '').localeCompare(a.ultimo.createdAt || ''))
  }, [cola, data.clientas])

  useEffect(() => { if (!selTel && hilos[0]) setSelTel(hilos[0].tel10) }, [hilos.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const hilo = hilos.find(h => h.tel10 === selTel) || null

  const enviar = async () => {
    if (!hilo || !texto.trim() || enviando) return
    setEnviando(true)
    try {
      await db.responderWa(hilo.tel, texto.trim())
      setTexto('')
      await recargar()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo enviar. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="card" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', minHeight: 480, overflow: 'hidden' }}>
      <div style={{ borderRight: '1px solid var(--line-soft)', overflowY: 'auto' }}>
        {hilos.length === 0 ? (
          <div className="dim" style={{ padding: 16, fontSize: 12.5, lineHeight: 1.5 }}>
            Todavía no hay conversaciones — aparecen aquí en cuanto una clienta responda algo (texto o botón).
          </div>
        ) : hilos.map(h => (
          <div
            key={h.tel10}
            onClick={() => setSelTel(h.tel10)}
            style={{
              padding: '12px 14px', cursor: 'pointer', borderBottom: '1px solid var(--line-soft)',
              background: selTel === h.tel10 ? 'var(--gold-soft)' : 'transparent',
            }}
          >
            <div className="between" style={{ gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{h.nombre}</span>
              {h.ventanaAbierta && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--st-conf)', flexShrink: 0 }} title="Ventana de 24h abierta" />}
            </div>
            <div className="dim" style={{ fontSize: 11.5, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {h.ultimo.creadoPor !== 'clienta' && 'Tú: '}{h.ultimo.cuerpo}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!hilo ? (
          <div className="dim" style={{ margin: 'auto', fontSize: 13 }}>Selecciona una conversación</div>
        ) : (
          <>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line-soft)' }}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{hilo.nombre}</div>
              <div className="dim" style={{ fontSize: 11 }}>{hilo.tel}</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {hilo.mensajes.map(m => {
                const deClienta = m.creadoPor === 'clienta'
                return (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: deClienta ? 'flex-start' : 'flex-end', maxWidth: '70%',
                      background: deClienta ? 'var(--surface-2)' : 'var(--gold-soft)',
                      borderRadius: 10, padding: '8px 12px',
                    }}
                  >
                    <div style={{ fontSize: 13, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{m.cuerpo}</div>
                    <div className="dim" style={{ fontSize: 10, marginTop: 3 }}>
                      {new Date(m.createdAt).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ padding: 12, borderTop: '1px solid var(--line-soft)' }}>
              {hilo.ventanaAbierta ? (
                <div className="vc gap8">
                  <input
                    className="input f1" placeholder="Escribe una respuesta…" value={texto}
                    onChange={e => setTexto(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') enviar() }}
                  />
                  <button className="btn gold" disabled={!texto.trim() || enviando} onClick={enviar}>
                    <Ic n={enviando ? 'spinner' : 'paper-plane-tilt'} />{enviando ? 'Enviando…' : 'Enviar'}
                  </button>
                </div>
              ) : (
                <div className="dim" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
                  Pasaron más de 24h desde su último mensaje — Meta ya no permite texto libre aquí.
                  Para contactarla de nuevo hay que usar una plantilla aprobada.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function ScreenWhatsApp({ onNavigate: _onNavigate }: { onNavigate: (r:string)=>void }) {
  const { data, loadFromSupabase } = useStore()
  const [vista, setVista] = useState('Seguimiento')
  const [sec, setSec] = useState('hoy_pend')
  const [contactados, setContactados] = useState<Set<string>>(loadContactados)
  const [selItem, setSelItem] = useState<Item|null>(null)
  const [msgEdit, setMsgEdit] = useState('')
  const [showNueva, setShowNueva] = useState(false)
  const [soloNoContactados, setSoloNoContactados] = useState(false)

  // Cola de WhatsApp automático — vive aquí (no dentro de PanelAutomatizacion)
  // para poder cruzarla contra las tarjetas de contacto manual de abajo:
  // si el sistema ya le mandó un recordatorio/cumpleaños/reactivación a
  // alguien, se muestra ese estado real en vez de dejar que el admin le
  // escriba por encima sin saberlo.
  const [plantillas, setPlantillas] = useState<WaPlantilla[]>([])
  const [cola, setCola] = useState<WaMensaje[]>([])
  const [cargandoCola, setCargandoCola] = useState(true)

  const recargarCola = async () => {
    const [p, c] = await Promise.all([db.getWaPlantillas(), db.getWaMensajes()])
    setPlantillas(p); setCola(c)
  }
  useEffect(() => { recargarCola().finally(() => setCargandoCola(false)) }, [])

  // Refresco periódico: los cambios que hace el webhook del lado del
  // servidor (confirmar/cancelar por botón de WhatsApp, entregado/leído)
  // no llegan solos a una pantalla ya abierta — no hay Supabase Realtime
  // wireado (sería un cambio de arquitectura mucho más grande). Mientras
  // esta pantalla esté montada, se refresca sola cada 45s.
  useEffect(() => {
    const id = setInterval(() => { recargarCola(); loadFromSupabase() }, 45000)
    return () => clearInterval(id)
  }, [])

  // ─── Build all section items ───────────────────────────────────────────────
  const hoy = new Date()
  const mañana = new Date(hoy); mañana.setDate(hoy.getDate() + 1)
  const MANANA_STR = `${mañana.getFullYear()}-${String(mañana.getMonth()+1).padStart(2,'0')}-${String(mañana.getDate()).padStart(2,'0')}`

  const todos = useMemo((): Record<string, Item[]> => {
    const salon = data.config.nombre || 'el salón'
    const clByNombre = (nombre: string) => data.clientas.find(c => c.nombre === nombre)
    const estNombre = (id: string) => data.estilistas.find(e => e.id === id)?.nombre.split(' ')[0] || 'tu estilista'
    // Mensaje automático más reciente (no cancelado) para una clienta+flujo,
    // o una cita+flujo puntual cuando se pasa citaId.
    const automaticoDe = (flujo: string, clientaId?: string, citaId?: string): WaMensaje | undefined =>
      cola
        .filter(m => m.flujo === flujo && m.estado !== 'cancelado'
          && (citaId ? m.citaId === citaId : m.clientaId === clientaId))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0]

    const hoy_pend: Item[] = data.hoy.filter(c => c.estado === 'pend').map(c => {
      const cl = clByNombre(c.cl)
      return { id:c.id, nombre:c.cl, tel:cl?.tel||'', ini:cl?.ini||c.cl[0], urgencia:'alta',
        contexto:`${c.srv} · ${c.h}`, sub:estNombre(c.est),
        msg:`Hola ${c.cl.split(' ')[0]} 💛 Te confirmamos tu cita de *${c.srv}* hoy a las *${c.h}* con ${estNombre(c.est)}. Responde *CONFIRMO* para apartar tu lugar ✅` }
    })

    const cobros: Item[] = data.ventas.filter(v => v.estado==='parcial'||v.estado==='pendiente').map(v => {
      const saldo = Math.max(0, v.lineas.reduce((s,l)=>s+l.precio*l.cant,0) - (v.desc||0) - (v.anticipo||0))
      const cl = data.clientas.find(c=>c.id===v.clienteId)
      const srv = v.lineas.find(l=>l.tipo==='servicio')?.nombre || 'tu servicio'
      return { id:v.id, nombre:v.cliente, tel:cl?.tel||'', ini:cl?.ini||v.cliente[0], urgencia:'alta',
        contexto:`Saldo pendiente · ${mxn(saldo)}`, sub:v.ticket,
        msg:`Hola ${v.cliente.split(' ')[0]} 💛 Quedó un saldo de *${mxn(saldo)}* pendiente por tu ${srv}. ¿Puedes pasarlo hoy? Te mandamos datos para transferencia 🙏` }
    })

    const manana: Item[] = data.citasFuturas.filter(c=>c.fecha===MANANA_STR).map(c => {
      const cl = clByNombre(c.cl)
      return { id:c.id, nombre:c.cl, tel:cl?.tel||'', ini:cl?.ini||c.cl[0], urgencia:'media',
        contexto:`${c.srv} · mañana ${c.h}`, sub:estNombre(c.est),
        msg:`Hola ${c.cl.split(' ')[0]} 💛 Te recordamos tu cita de *${c.srv}* mañana a las *${c.h}* con ${estNombre(c.est)}. ¡Te esperamos! ✨`,
        automatico: automaticoDe('recordatorio_24h', undefined, c.id) }
    })

    const post_visita: Item[] = data.clientas.filter(c => { const d=diasDesde(c.ultima); return d>=1&&d<=3 }).map(c => ({
      id:c.id+'_pv', nombre:c.nombre, tel:c.tel, ini:c.ini, urgencia:'media' as const,
      contexto:`Visitó hace ${diasDesde(c.ultima)} día${diasDesde(c.ultima)>1?'s':''}`, sub:c.fav,
      msg:`Hola ${c.nombre.split(' ')[0]} 💛 Fue un placer tenerte en ${salon}. ¿Cómo quedaste con tu ${c.fav}? Tu opinión nos importa mucho 😊`
    }))

    const react = (catSec: string, buildMsg: (c:Clienta)=>string): Item[] =>
      data.clientas.filter(c => {
        const cat = data.servicios.find(s=>s.nombre===c.fav)?.cat||''
        return CAT_SEC[cat]===catSec && diasDesde(c.ultima) >= c.ciclo*7*0.85
      }).map(c => {
        const dias = diasDesde(c.ultima)
        return { id:`${c.id}_r_${catSec}`, nombre:c.nombre, tel:c.tel, ini:c.ini,
          urgencia: dias>c.ciclo*7*1.2?'alta':'media' as 'alta'|'media',
          contexto:`${c.fav} · hace ${dias} días`, sub:`Ciclo ${c.ciclo} sem`,
          msg: buildMsg(c) }
      })

    const mechas      = react('mechas',      c=>`Hola ${c.nombre.split(' ')[0]} ✨ Ya casi es hora de dar mantenimiento a tu ${c.fav}. ¿Agendamos en las próximas semanas? Te esperamos en ${salon} 💇‍♀️`)
    const color       = react('color',       c=>`Hola ${c.nombre.split(' ')[0]} 💛 Ya casi es momento del retoque de ${c.fav}. ¿Cuándo te acomodamos? 🗓`)
    const tratamiento = react('tratamiento', c=>`Hola ${c.nombre.split(' ')[0]} 💛 ¿Lista para renovar tu ${c.fav}? Tu cabello lo va a agradecer 🌿`)
    const unas        = react('unas',        c=>`Hola ${c.nombre.split(' ')[0]} 💅 Ya casi es hora de tu ${c.fav}. ¿Agendamos esta semana? Te esperamos ✨`)
    const cortes      = react('cortes',      c=>`Hola ${c.nombre.split(' ')[0]} ✂️ Tu corte ya está pidiendo tijeras 😄 ¿Cuándo pasas por ${salon}?`)
    const maquillaje  = react('maquillaje',  c=>`Hola ${c.nombre.split(' ')[0]} 💛 ¿Tienes algún evento próximo? Tenemos ${c.fav} disponible. ¿Agendamos? ✨`)

    const cumples: Item[] = data.clientas.filter(c=>diasCumple(c.cumple)<=7)
      .sort((a,b)=>diasCumple(a.cumple)-diasCumple(b.cumple))
      .map(c => {
        const d = diasCumple(c.cumple)
        return { id:c.id+'_cumple', nombre:c.nombre, tel:c.tel, ini:c.ini,
          urgencia: d===0?'alta':'media' as 'alta'|'media',
          contexto: d===0?'¡Hoy es su cumpleaños!':`Cumpleaños en ${d} días`, sub:c.cumple,
          msg: d===0
            ? `¡Feliz cumpleaños ${c.nombre.split(' ')[0]}! 🎂🎉 Todo el equipo de ${salon} te desea un día increíble. ¡Eres muy especial para nosotras! 💛`
            : `Hola ${c.nombre.split(' ')[0]} 💛 Estamos a nada de tu cumpleaños 🎂 Tenemos una sorpresa especial para ti en ${salon}. ¡Ven a celebrar! ✨`,
          automatico: automaticoDe('cumpleanos', c.id) }
      })

    const nuevas: Item[] = data.clientas.filter(c=>c.visitas===1&&diasDesde(c.ultima)<=14).map(c=>({
      id:c.id+'_nva', nombre:c.nombre, tel:c.tel, ini:c.ini, urgencia:'media' as const,
      contexto:`Primera visita · hace ${diasDesde(c.ultima)} días`, sub:c.fav,
      msg:`Hola ${c.nombre.split(' ')[0]} 💛 Fue un gusto que nos visitaras en ${salon}. ¿Cómo quedaste con tu ${c.fav}? ¡Esperamos verte pronto! 😊`
    }))

    const inactivas: Item[] = data.clientas
      .filter(c=>c.estado==='Inactiva'||diasDesde(c.ultima)>c.ciclo*7*1.5)
      .map(c=>({ id:c.id+'_ina', nombre:c.nombre, tel:c.tel, ini:c.ini,
        urgencia: diasDesde(c.ultima)>120?'alta':'media' as 'alta'|'media',
        contexto:`Sin visita hace ${diasDesde(c.ultima)} días`, sub:c.fav,
        msg:`Hola ${c.nombre.split(' ')[0]} 💛 ¡Te extrañamos en ${salon}! Llevamos tiempo sin verte. ¿Cuándo nos visitas? Tenemos algo especial cuando regreses ✨`,
        automatico: automaticoDe('reactivacion', c.id)
      }))

    return { hoy_pend, cobros, manana, post_visita, mechas, color, tratamiento, unas, cortes, maquillaje, cumples, nuevas, inactivas }
  }, [data, cola])

  // "Contactado" real: para las secciones con equivalente automático, un
  // envío ya entregado/leído/respondido cuenta como contacto hecho aunque
  // nadie lo haya marcado a mano — es la señal más confiable de las dos.
  const efectivo = (item: Item) => contactados.has(item.id)
    || (!!item.automatico && AUTO_CONTACTADO.includes(item.automatico.estado))

  const items = (todos[sec] || []).filter(i => soloNoContactados ? !efectivo(i) : true)

  const marcar = (id: string) => setContactados(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    saveContactados(next)
    return next
  })

  const selectItem = (item: Item) => { setSelItem(item); setMsgEdit(item.msg) }

  // KPIs
  const kpis = [
    { icon:'warning-circle', label:'Sin confirmar hoy', val:todos.hoy_pend?.length||0, color:'var(--st-canc)' },
    { icon:'hand-coins',     label:'Cobros pendientes', val:todos.cobros?.length||0,    color:'var(--st-pend)' },
    { icon:'calendar-check', label:'Recordatorios mañana', val:todos.manana?.length||0, color:'var(--st-conf)' },
    { icon:'gift',           label:'Cumpleaños próximos', val:todos.cumples?.length||0, color:'var(--gold)' },
  ]

  // Group sections for nav
  const groups = ['URGENTE','HOY','REACTIVACIÓN','FIDELIZACIÓN']
  const groupLabel: Record<string,string> = { URGENTE:'🔴 Urgente', HOY:'🟡 Para hoy', REACTIVACIÓN:'🟣 Por reagendar', FIDELIZACIÓN:'🎁 Fidelización' }

  const currentSec = SECS.find(s=>s.id===sec)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {showNueva && <NuevaPlantillaModal onClose={()=>setShowNueva(false)} />}

      <PanelAutomatizacion plantillas={plantillas} cola={cola} cargando={cargandoCola} setCola={setCola} recargar={recargarCola} />

      <Seg opts={['Seguimiento', 'Conversaciones']} value={vista} onChange={setVista} />

      {vista === 'Conversaciones' && <Conversaciones cola={cola} recargar={recargarCola} />}

      {vista === 'Seguimiento' && <>
      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
        {kpis.map(k=>(
          <div key={k.label} className="card" style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:38,height:38,borderRadius:10,background:k.color+'22',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
              <Ic n={k.icon} size={20} style={{ color:k.color }} />
            </div>
            <div>
              <div style={{ fontSize:22,fontWeight:700,fontFamily:'var(--serif)',color:k.color }}>{k.val}</div>
              <div className="dim" style={{ fontSize:11,lineHeight:1.3 }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main layout */}
      <div className="whatsapp-layout" style={{ display:'grid', gridTemplateColumns:'220px 1fr 290px', gap:14, alignItems:'start' }}>

        {/* Left nav */}
        <div className="card" style={{ padding:8, position:'sticky', top:92 }}>
          {groups.map(g=>(
            <div key={g}>
              <div style={{ fontSize:10,fontWeight:700,letterSpacing:'.14em',color:'var(--text-4)',padding:'10px 10px 5px' }}>{groupLabel[g]}</div>
              {SECS.filter(s=>s.group===g).map(s=>{
                const cnt = (todos[s.id]||[]).length
                const active = sec===s.id
                return (
                  <div key={s.id}
                    className={'nav-item'+(active?' active':'')}
                    style={{ justifyContent:'space-between' }}
                    onClick={()=>{ setSec(s.id); setSelItem(null) }}
                  >
                    <span className="vc gap8"><Ic n={s.icon} size={15}/>{s.label}</span>
                    {cnt>0 && <span className="badge neutral" style={{ fontSize:10,minWidth:20,textAlign:'center' }}>{cnt}</span>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Center: action list */}
        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">{currentSec?.group}</div>
              <h3 style={{ marginTop:4 }}>{currentSec?.label}</h3>
            </div>
            <div className="vc gap8">
              <span className="dim" style={{ fontSize:12 }}>{items.length} pendientes</span>
              <button
                className={'btn sm '+(soloNoContactados?'gold':'ghost')}
                onClick={()=>setSoloNoContactados(v=>!v)}
              >
                <Ic n="funnel" size={13}/>
                {soloNoContactados?'Solo pendientes':'Mostrar todos'}
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="card-pad" style={{ textAlign:'center', padding:'40px 0', color:'var(--text-4)' }}>
              <Ic n="check-circle" size={32} style={{ display:'block', margin:'0 auto 10px', color:'var(--st-conf)', opacity:.6 }}/>
              <div style={{ fontWeight:600, fontSize:13.5 }}>Todo al día</div>
              <div style={{ fontSize:12.5, marginTop:4 }}>Sin pendientes en esta sección</div>
            </div>
          ) : (
            <div>
              {items.map((item,i)=>{
                const done = efectivo(item)
                const active = selItem?.id===item.id
                const est = item.automatico ? EST_MSG[item.automatico.estado] : undefined
                return (
                  <div
                    key={item.id}
                    onClick={()=>selectItem(item)}
                    style={{
                      padding:'13px 20px',
                      borderBottom: i<items.length-1?'1px solid var(--line-soft)':'none',
                      borderLeft: active?'3px solid var(--gold)':'3px solid transparent',
                      background: active?'var(--gold-soft)': done?'rgba(147,181,140,0.06)':'transparent',
                      cursor:'pointer', display:'flex', alignItems:'center', gap:14,
                      opacity: done ? .55 : 1,
                    }}
                  >
                    {/* Urgencia dot */}
                    <div style={{ width:8,height:8,borderRadius:'50%',background:URGCOLOR[item.urgencia],flexShrink:0 }} />

                    {/* Avatar */}
                    <Avatar ini={item.ini} size="sm" />

                    {/* Info */}
                    <div className="f1" style={{ minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:13.5, display:'flex', alignItems:'center', gap:8 }}>
                        {item.nombre}
                        {done && <Ic n="check-circle" size={14} style={{ color:'var(--st-conf)' }}/>}
                      </div>
                      <div className="dim" style={{ fontSize:12, marginTop:2 }}>
                        {item.contexto}
                        {item.sub && <span style={{ marginLeft:8, opacity:.6 }}>· {item.sub}</span>}
                      </div>
                      {est && (
                        <div style={{ marginTop:4 }}>
                          <span className="badge" style={{ fontSize:10, color:est.color, borderColor:est.color }}>
                            Automático · {est.label}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="vc gap8" onClick={e=>e.stopPropagation()}>
                      {item.tel ? (
                        <a
                          href={waUrl(item.tel, item.msg)}
                          target="_blank" rel="noopener noreferrer"
                          className="btn sm"
                          style={{ background:'#25D366', color:'#fff', border:'none', textDecoration:'none' }}
                        >
                          <Ic n="whatsapp-logo" size={13}/>Enviar
                        </a>
                      ) : (
                        <span className="dim" style={{ fontSize:11 }}>Sin tel.</span>
                      )}
                      <button
                        className={'btn sm '+(done?'gold':'ghost')}
                        style={{ padding:'6px 10px' }}
                        onClick={()=>marcar(item.id)}
                        title={done?'Desmarcar':'Marcar como contactado'}
                      >
                        <Ic n={done?'check-circle':'check'} size={13}/>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: message composer + templates */}
        <div style={{ display:'flex', flexDirection:'column', gap:14, position:'sticky', top:92 }}>

          {/* Message editor (when item selected) */}
          {selItem && (
            <div className="card card-pad" style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div className="vc gap10">
                <Avatar ini={selItem.ini} size="sm"/>
                <div>
                  <div style={{ fontWeight:600, fontSize:13 }}>{selItem.nombre}</div>
                  {selItem.tel
                    ? <div style={{ fontSize:11, color:'#25D366' }}>{selItem.tel}</div>
                    : <div style={{ fontSize:11, color:'var(--text-4)' }}>Sin teléfono</div>}
                </div>
              </div>
              <textarea
                className="input"
                rows={5}
                value={msgEdit}
                onChange={e=>setMsgEdit(e.target.value)}
                style={{ resize:'vertical', fontSize:12.5, lineHeight:1.6 }}
              />
              <div className="vc gap8">
                {selItem.tel ? (
                  <a
                    href={waUrl(selItem.tel, msgEdit)}
                    target="_blank" rel="noopener noreferrer"
                    className="btn gold f1"
                    style={{ textDecoration:'none', justifyContent:'center', background:'#25D366', border:'none' }}
                    onClick={()=>marcar(selItem.id)}
                  >
                    <Ic n="whatsapp-logo"/>Abrir en WhatsApp
                  </a>
                ) : (
                  <button className="btn ghost f1" style={{ justifyContent:'center' }} disabled>Sin teléfono</button>
                )}
                <button className="btn ghost sm" onClick={()=>setMsgEdit(selItem.msg)} title="Restaurar mensaje original">
                  <Ic n="arrow-counter-clockwise" size={14}/>
                </button>
              </div>
            </div>
          )}

          {/* Templates */}
          <div className="card" style={{ overflow:'hidden' }}>
            <div style={{ padding:'12px 14px 8px' }}>
              <CardHead title="Plantillas" sub="Clic para cargar en el editor" />
            </div>
            <div style={{ maxHeight: selItem ? 260 : 420, overflowY:'auto', padding:'0 14px' }}>
              {data.plantillas.map(p=>(
                <div
                  key={p.id}
                  onClick={()=>{
                    if (!selItem) { toast('Selecciona una clienta primero'); return }
                    const cita = data.hoy.find(c=>c.cl===selItem.nombre)
                    const cl = data.clientas.find(c=>c.nombre===selItem.nombre)
                    const t = p.txt
                      .replace('{nombre}', selItem.nombre.split(' ')[0])
                      .replace('{servicio}', cita?.srv||cl?.fav||'tu servicio')
                      .replace('{hora}', cita?.h||'—')
                      .replace('{estilista}', data.estilistas.find(e=>e.id===cita?.est)?.nombre.split(' ')[0]||'')
                      .replace('{dias}', String(diasDesde(cl?.ultima||'')||60))
                    setMsgEdit(t)
                  }}
                  style={{ padding:'9px 11px', borderRadius:'var(--r)', border:'1px solid var(--line-soft)', marginBottom:8, cursor:'pointer', background:'var(--surface-2)' }}
                  onMouseEnter={e=>(e.currentTarget.style.borderColor='var(--gold)')}
                  onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--line-soft)')}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:3 }}>
                    <Ic n={p.icon} size={14} style={{ color:'var(--gold)' }}/>
                    <span style={{ fontWeight:600, fontSize:12 }}>{p.nombre}</span>
                  </div>
                  <div className="dim" style={{ fontSize:11, lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{p.txt}</div>
                </div>
              ))}
            </div>
            <div style={{ padding:'8px 14px 12px' }}>
              <button className="btn ghost w100" onClick={()=>setShowNueva(true)}>
                <Ic n="plus" size={13}/>Nueva plantilla
              </button>
            </div>
          </div>

          {contactados.size>0 && (
            <button className="btn ghost sm" style={{ justifyContent:'center' }} onClick={()=>{ const s=new Set<string>(); saveContactados(s); setContactados(s) }}>
              <Ic n="arrow-counter-clockwise" size={13}/>Limpiar {contactados.size} marcado{contactados.size!==1?'s':''}
            </button>
          )}
        </div>

      </div>
      </>}
    </div>
  )
}

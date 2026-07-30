import React, { useState } from 'react'
import { Switch, toast } from '../../components/ui'
import { PhosphorIcon as Ic } from '../../components/PhosphorIcon'
import { useStore } from '../../data/store'
import { useAuth } from '../../lib/auth'
import { db } from '../../lib/db'
import { filtrarTel, telefonoValido } from '../../lib/helpers'
import type { WaMensaje, WaPlantilla } from '../../types'
import { EST_META, EST_MSG, FLUJO_LABEL } from './shared'

// Modo prueba: mientras está activo, el envío real (cron cada 30 min y el
// botón "Enviar aprobados") solo entrega a waTestTel — cualquier otro
// mensaje se queda en la cola sin salir. Es la manera de dejar todo el
// flujo conectado y probarlo de punta a punta sin riesgo de que le llegue
// algo a una clienta real. Solo el admin puede verlo y cambiarlo.
export function ModoPrueba() {
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

// Franja de automatización: vive arriba de Audiencias (no es su propia
// pestaña). El detalle completo (por aprobar/listos/enviados + badges de
// plantillas) queda colapsado por default, pero se auto-abre si hay algo
// por aprobar — lo accionable nunca queda escondido detrás de un clic extra.
export function PanelAutomatizacion({ plantillas, cola, cargando, setCola, recargar }: PanelAutomatizacionProps) {
  const { data } = useStore()
  const { user } = useAuth()
  const esAdmin = user?.rol === 'admin'
  const [enviando, setEnviando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [confirmVaciar, setConfirmVaciar] = useState(false)
  const [detalleManual, setDetalleManual] = useState(false)

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
  const detalleVisible = detalleManual || porAprobar.length > 0

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

      {/* Estado de plantillas (resumen compacto, siempre visible) */}
      <div className="between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <span className="dim" style={{ fontSize: 12 }}>Plantillas: <b>{aprobadasN}/{plantillas.length || 6}</b> aprobadas por Meta</span>
        <button className="btn ghost sm" onClick={() => setDetalleManual(v => !v)}>
          <Ic n={detalleVisible ? 'caret-up' : 'caret-down'} size={13} />
          {detalleVisible ? 'Ocultar detalle' : 'Ver detalle de la cola'}
        </button>
      </div>

      {detalleVisible && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
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
        </>
      )}
      </div>
    </div>
  )
}

import React, { useEffect, useMemo, useState } from 'react'
import { toast } from '../../components/ui'
import { PhosphorIcon as Ic } from '../../components/PhosphorIcon'
import { useStore } from '../../data/store'
import { db } from '../../lib/db'
import type { WaMensaje } from '../../types'
import { VENTANA_24H_MS, norm10 } from './shared'

// Agrupa toda la cola (automática + entrante) por teléfono para armar el
// historial real de ida y vuelta con cada clienta, y permite contestar texto
// libre — solo dentro de la ventana de 24h que exige Meta (se abre cada vez
// que la clienta escribe). Solo se listan conversaciones donde la clienta ya
// contestó algo alguna vez; el resto es solo envío automático sin respuesta.
interface Hilo {
  tel10: string; tel: string; nombre: string; mensajes: WaMensaje[]
  ultimo: WaMensaje; ventanaAbierta: boolean
}

export function Conversaciones({ cola, recargar, openTel }: { cola: WaMensaje[]; recargar: () => Promise<void>; openTel?: string | null }) {
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

  // Llegada desde Audiencias: preselecciona el hilo de ese contacto en vez
  // de dejar el primero de la lista.
  useEffect(() => { if (openTel) setSelTel(norm10(openTel)) }, [openTel])

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

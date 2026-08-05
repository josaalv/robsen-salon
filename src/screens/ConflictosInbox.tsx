import React, { useEffect, useState } from 'react'
import { toast, ConfirmModal } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { useStore } from '../data/store'
import { normalizarTel, formatTel, mxn } from '../lib/helpers'
import { getConflictItems, discardOutboxItem, subscribeOutbox } from '../lib/outbox'
import type { OutboxItem } from '../lib/offlineDb'
import type { Cita, Clienta, Venta } from '../types'
import { CitaModal } from './Agenda'

// Cada renglón de la cola que no pudo sincronizarse solo (choque de horario,
// teléfono duplicado, o sin permiso) llega aquí — nunca desaparece por sí
// solo, se queda hasta que alguien lo resuelve o lo descarta a propósito.
export function ScreenConflictosInbox() {
  const { data } = useStore()
  const [items, setItems] = useState<OutboxItem[]>([])
  const [reagendar, setReagendar] = useState<OutboxItem | null>(null)
  const [descartar, setDescartar] = useState<OutboxItem | null>(null)

  const cargar = () => { getConflictItems().then(setItems).catch(() => {}) }

  useEffect(() => {
    cargar()
    return subscribeOutbox(e => {
      if (e.type === 'conflict' || e.type === 'synced' || e.type === 'counts') cargar()
    })
  }, [])

  const porTipo = {
    overlap: items.filter(i => i.conflictType === 'overlap'),
    duplicate_phone: items.filter(i => i.conflictType === 'duplicate_phone'),
    rls_denied: items.filter(i => i.conflictType === 'rls_denied'),
    otro: items.filter(i => !i.conflictType),
  }

  const cancelarCitaConflicto = async (item: OutboxItem) => {
    useStore.setState(s => ({
      data: {
        ...s.data,
        hoy: s.data.hoy.filter(c => c.id !== item.id),
        citasFuturas: (s.data.citasFuturas || []).filter(c => c.id !== item.id),
      },
    }))
    await discardOutboxItem(item.id)
    toast('Cita descartada')
  }

  const usarClientaExistente = async (item: OutboxItem) => {
    useStore.setState(s => ({ data: { ...s.data, clientas: s.data.clientas.filter(c => c.id !== item.id) } }))
    await discardOutboxItem(item.id)
    toast('Se descartó la clienta duplicada — se usará la existente')
  }

  const corregirTelefono = async (item: OutboxItem, nuevoTel: string) => {
    const { upsertClienta } = useStore.getState()
    await discardOutboxItem(item.id)
    await upsertClienta({ ...(item.payload as Clienta), tel: nuevoTel })
    toast('Teléfono corregido — se volverá a intentar sincronizar')
  }

  if (items.length === 0) {
    return (
      <div>
        <h1 className="display" style={{ fontSize: 26, margin: 0 }}>Conflictos de sincronización</h1>
        <div className="card" style={{ marginTop: 22, padding: 40, textAlign: 'center' }}>
          <Ic n="check-circle" size={32} />
          <div style={{ marginTop: 10, fontWeight: 600 }}>No hay nada pendiente por resolver</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Aquí aparecerán las citas, clientas o ventas que se crearon sin conexión y no se pudieron
            sincronizar solas al volver a internet.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="between" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="display" style={{ fontSize: 26, margin: 0 }}>Conflictos de sincronización</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            {items.length} pendiente{items.length !== 1 ? 's' : ''} por resolver — nada se pierde, pero necesita una decisión.
          </div>
        </div>
      </div>

      {porTipo.overlap.length > 0 && (
        <Seccion titulo="Choque de horario" desc="Se guardaron sin conexión y, al sincronizar, otra cita ya había tomado ese horario.">
          {porTipo.overlap.map(item => {
            const c = item.payload as Cita
            return (
              <FilaConflicto key={item.id} onDescartar={() => setDescartar(item)}>
                <div style={{ fontWeight: 600 }}>{c.cl}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>{c.srv} · {c.fecha} {c.h}</div>
                <div className="vc gap8" style={{ marginTop: 8 }}>
                  <button className="btn gold sm" onClick={() => setReagendar(item)}><Ic n="calendar-blank" />Reagendar</button>
                  <button className="btn ghost sm" onClick={() => cancelarCitaConflicto(item)}><Ic n="x-circle" />Cancelar esta cita</button>
                </div>
              </FilaConflicto>
            )
          })}
        </Seccion>
      )}

      {porTipo.duplicate_phone.length > 0 && (
        <Seccion titulo="Teléfono duplicado" desc="Se creó una clienta sin conexión con un teléfono que ya tiene otra clienta registrada.">
          {porTipo.duplicate_phone.map(item => {
            const c = item.payload as Clienta
            const existente = data.clientas.find(x => x.id !== item.id && normalizarTel(x.tel) === normalizarTel(c.tel))
            return (
              <FilaConflicto key={item.id} onDescartar={() => setDescartar(item)}>
                <div className="vc gap16" style={{ flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }} className="dim">Nueva (sin sincronizar)</div>
                    <div style={{ fontWeight: 600 }}>{c.nombre}</div>
                    <div className="muted" style={{ fontSize: 12.5 }}>{formatTel(c.tel)}</div>
                  </div>
                  {existente && (
                    <div>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }} className="dim">Ya existe</div>
                      <div style={{ fontWeight: 600 }}>{existente.nombre}</div>
                      <div className="muted" style={{ fontSize: 12.5 }}>{formatTel(existente.tel)}</div>
                    </div>
                  )}
                </div>
                <div className="vc gap8" style={{ marginTop: 8 }}>
                  <button className="btn ghost sm" onClick={() => usarClientaExistente(item)}><Ic n="user-check" />Usar la existente</button>
                  <CorregirTelefonoBtn onGuardar={tel => corregirTelefono(item, tel)} />
                </div>
              </FilaConflicto>
            )
          })}
        </Seccion>
      )}

      {porTipo.rls_denied.length > 0 && (
        <Seccion titulo="Sin permiso" desc="Se creó sin conexión, pero al sincronizar el rol de quien lo hizo no tiene permiso para guardarlo. Pide a un administrador que lo revise.">
          {porTipo.rls_denied.map(item => (
            <FilaConflicto key={item.id} onDescartar={() => setDescartar(item)}>
              <div style={{ fontWeight: 600 }}>{resumenPayload(item)}</div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{item.entityType} · creado {new Date(item.createdAt).toLocaleString('es-MX')}</div>
            </FilaConflicto>
          ))}
        </Seccion>
      )}

      {porTipo.otro.length > 0 && (
        <Seccion titulo="Otro" desc="El servidor rechazó el cambio por un motivo que no se pudo identificar automáticamente.">
          {porTipo.otro.map(item => (
            <FilaConflicto key={item.id} onDescartar={() => setDescartar(item)}>
              <div style={{ fontWeight: 600 }}>{resumenPayload(item)}</div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{item.entityType} · {item.lastError || 'motivo desconocido'}</div>
            </FilaConflicto>
          ))}
        </Seccion>
      )}

      {reagendar && (
        <CitaModal
          cita={reagendar.payload as Cita}
          bloqueos={data.bloqueos || []}
          onClose={() => setReagendar(null)}
          onSaved={() => setReagendar(null)}
        />
      )}

      {descartar && (
        <ConfirmModal
          title="¿Descartar este pendiente?"
          desc="Se elimina de la cola de sincronización. Si el cambio ya no es válido o decidiste no aplicarlo, esta es la forma de quitarlo de la lista."
          onConfirm={async () => { await discardOutboxItem(descartar.id); setDescartar(null); toast('Descartado') }}
          onCancel={() => setDescartar(null)}
        />
      )}
    </div>
  )
}

function resumenPayload(item: OutboxItem): string {
  if (item.entityType === 'cita') return (item.payload as Cita).cl || item.id
  if (item.entityType === 'clienta') return (item.payload as Clienta).nombre || item.id
  const v = item.payload as Venta
  return v.cliente ? `Venta · ${v.cliente} · ${mxn(v.lineas?.reduce((s, l) => s + l.precio * l.cant, 0) || 0)}` : item.id
}

function Seccion({ titulo, desc, children }: { titulo: string; desc: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontWeight: 600, fontSize: 14 }}>{titulo}</div>
      <div className="muted" style={{ fontSize: 12.5, marginTop: 2, marginBottom: 10 }}>{desc}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  )
}

function FilaConflicto({ children, onDescartar }: { children: React.ReactNode; onDescartar: () => void }) {
  return (
    <div className="card gold-edge" style={{ padding: 16, position: 'relative' }}>
      <button className="icon-btn" onClick={onDescartar} title="Descartar" style={{ position: 'absolute', top: 10, right: 10 }}>
        <Ic n="trash" size={14} />
      </button>
      {children}
    </div>
  )
}

function CorregirTelefonoBtn({ onGuardar }: { onGuardar: (tel: string) => void }) {
  const [editando, setEditando] = useState(false)
  const [tel, setTel] = useState('')
  if (!editando) {
    return <button className="btn ghost sm" onClick={() => setEditando(true)}><Ic n="pencil-simple" />Corregir el teléfono</button>
  }
  return (
    <div className="vc gap8">
      <input className="input sm" style={{ width: 160 }} placeholder="Nuevo teléfono" value={tel} onChange={e => setTel(e.target.value)} />
      <button
        className="btn gold sm"
        disabled={normalizarTel(tel).length < 10}
        onClick={() => { onGuardar(tel); setEditando(false); setTel('') }}
      >
        Guardar
      </button>
    </div>
  )
}

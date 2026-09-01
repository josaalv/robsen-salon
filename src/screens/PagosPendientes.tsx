import React, { useEffect, useState } from 'react'
import { toast } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { db } from '../lib/db'
import { mxn, formatTel } from '../lib/helpers'

interface PagoConError {
  id: string; referencia: string; monto: number; reservaError: string
  clienteNombre?: string; clienteTel?: string; servicio?: string; fechaCita?: string; horaCita?: string
  creadoEn: string; actualizadoEn: string | null
}

// H-15 de la auditoría: un pago de anticipo se aprueba pero, por algún
// motivo (ej. alguien más tomó ese horario mientras se pagaba), la cita no
// se pudo agendar sola — antes esto solo se veía consultando la base a
// mano. El dinero nunca se pierde (el pago queda registrado igual), pero
// alguien del equipo tiene que agendar a mano y avisarle a la clienta.
export function ScreenPagosPendientes() {
  const [items, setItems] = useState<PagoConError[]>([])
  const [cargando, setCargando] = useState(true)
  const [resolviendo, setResolviendo] = useState<string | null>(null)

  const cargar = () => db.getPagosConError().then(setItems).finally(() => setCargando(false))

  useEffect(() => {
    cargar()
    const id = setInterval(cargar, 60000)
    return () => clearInterval(id)
  }, [])

  const resolver = async (p: PagoConError) => {
    setResolviendo(p.id)
    try {
      await db.marcarPagoErrorResuelto(p.id)
      setItems(x => x.filter(i => i.id !== p.id))
      toast('Marcado como resuelto')
    } catch (e: any) {
      toast(e.message || 'No se pudo marcar como resuelto')
    } finally {
      setResolviendo(null)
    }
  }

  if (cargando) return null

  if (items.length === 0) {
    return (
      <div>
        <h1 className="display" style={{ fontSize: 26, margin: 0 }}>Pagos pendientes de agendar</h1>
        <div className="card" style={{ marginTop: 22, padding: 40, textAlign: 'center' }}>
          <Ic n="check-circle" size={32} />
          <div style={{ marginTop: 10, fontWeight: 600 }}>No hay nada pendiente</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Aquí aparecen los anticipos cobrados en línea cuya cita no se pudo agendar sola —
            el dinero nunca se pierde, pero hay que agendar a mano y avisarle a la clienta.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 className="display" style={{ fontSize: 26, margin: 0 }}>Pagos pendientes de agendar</h1>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          {items.length} pago{items.length !== 1 ? 's' : ''} cobrado{items.length !== 1 ? 's' : ''} sin cita agendada —
          el dinero está seguro, falta agendar a mano y avisarle a la clienta.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(p => (
          <div key={p.id} className="card gold-edge" style={{ padding: 16 }}>
            <div className="between" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{p.clienteNombre || 'Clienta sin nombre registrado'}</div>
                {p.clienteTel && <div className="muted" style={{ fontSize: 12.5 }}>{formatTel(p.clienteTel)}</div>}
                <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                  {p.servicio || 'Servicio sin registrar'}
                  {(p.fechaCita || p.horaCita) && ` · ${p.fechaCita || ''} ${p.horaCita || ''}`.trimEnd()}
                </div>
                <div className="dim" style={{ fontSize: 11.5, marginTop: 6 }}>
                  Anticipo {mxn(p.monto)} · cobrado {new Date(p.creadoEn).toLocaleString('es-MX')}
                </div>
              </div>
              <button
                className="btn gold sm"
                disabled={resolviendo === p.id}
                onClick={() => resolver(p)}
              >
                <Ic n="check" />Marcar resuelto
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

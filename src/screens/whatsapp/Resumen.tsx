import React, { useMemo } from 'react'
import { Stat, Donut, BarChart, CardHead } from '../../components/ui'
import { PhosphorIcon as Ic } from '../../components/PhosphorIcon'
import { useStore } from '../../data/store'
import { fechaLocalIso } from '../../lib/helpers'
import type { WaMensaje, WaPlantilla } from '../../types'
import { FLUJO_LABEL } from './shared'

const ENVIADO_ESTADOS = ['enviado', 'entregado', 'leido', 'respondido']
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

const FLUJO_COLOR: Record<string, string> = {
  confirmacion: '#C8A14A', recordatorio_24h: '#8BA888', post_visita: '#B98BC9',
  cumpleanos: '#E0A96D', bienvenida: '#6FAACB', reactivacion: '#CB6F6F', manual: '#9AA0A6',
}

// Fecha efectiva de un mensaje para agrupar "por día": el envío real si ya
// se mandó, o cuándo se generó si sigue en cola — así un mensaje fallido o
// pendiente de aprobación también cuenta en el día que corresponde.
const fechaMsg = (m: WaMensaje) => (m.enviadoAt || m.createdAt || '').slice(0, 10)

export function Resumen({ cola, plantillas }: { cola: WaMensaje[]; plantillas: WaPlantilla[] }) {
  const { data } = useStore()

  const stats = useMemo(() => {
    const hoy = fechaLocalIso()
    const enviadosHoy = cola.filter(m => ENVIADO_ESTADOS.includes(m.estado) && fechaMsg(m) === hoy).length

    const procesados = cola.filter(m => ENVIADO_ESTADOS.includes(m.estado) || m.estado === 'fallido')
    const entregados = cola.filter(m => ['entregado', 'leido', 'respondido'].includes(m.estado))
    const respondidos = cola.filter(m => m.estado === 'respondido')
    const tasaEntrega = procesados.length ? Math.round((entregados.length / procesados.length) * 100) : 0
    const tasaRespuesta = procesados.length ? Math.round((respondidos.length / procesados.length) * 100) : 0

    const recordatorios = cola.filter(m => m.flujo === 'recordatorio_24h' && (ENVIADO_ESTADOS.includes(m.estado) || m.estado === 'fallido'))
    const recordatoriosConfirmados = recordatorios.length
      ? Math.round((recordatorios.filter(m => m.estado === 'respondido').length / recordatorios.length) * 100)
      : 0

    const bajas = data.clientas.filter(c => c.waOptin === false).length
    const aprobadas = plantillas.filter(p => p.estadoMeta === 'aprobada').length

    return { enviadosHoy, tasaEntrega, tasaRespuesta, recordatoriosConfirmados, bajas, aprobadas, totalPlantillas: plantillas.length || 6 }
  }, [cola, data.clientas, plantillas])

  const porFlujo = useMemo(() => {
    const m = new Map<string, number>()
    cola.forEach(msg => {
      if (!ENVIADO_ESTADOS.includes(msg.estado)) return
      m.set(msg.flujo, (m.get(msg.flujo) || 0) + 1)
    })
    return [...m.entries()]
      .map(([flujo, v]) => ({ cat: FLUJO_LABEL[flujo] || (flujo === 'manual' ? 'Manual' : flujo), v, c: FLUJO_COLOR[flujo] || '#9AA0A6' }))
      .sort((a, b) => b.v - a.v)
  }, [cola])

  const ultimos7 = useMemo(() => {
    const dias: { d: string; v: number; fecha: string }[] = []
    for (let i = 6; i >= 0; i--) {
      const dt = new Date()
      dt.setDate(dt.getDate() - i)
      const fecha = fechaLocalIso(dt)
      dias.push({ d: DIAS_CORTOS[dt.getDay()], v: 0, fecha })
    }
    cola.forEach(m => {
      if (!ENVIADO_ESTADOS.includes(m.estado)) return
      const fecha = fechaMsg(m)
      const dia = dias.find(d => d.fecha === fecha)
      if (dia) dia.v++
    })
    return dias.map(({ d, v }) => ({ d, v }))
  }, [cola])

  const contarN = (n: number) => String(n)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
        <Stat icon={<Ic n="paper-plane-tilt" />} label="Enviados hoy" value={stats.enviadosHoy} />
        <Stat icon={<Ic n="check-circle" />} label="Tasa de entrega" value={stats.tasaEntrega} unit="%" />
        <Stat icon={<Ic n="chat-circle-text" />} label="Tasa de respuesta" value={stats.tasaRespuesta} unit="%" />
        <Stat icon={<Ic n="calendar-check" />} label="Recordatorios confirmados" value={stats.recordatoriosConfirmados} unit="%" />
        <Stat icon={<Ic n="user-minus" />} label="Clientas dadas de baja" value={stats.bajas} />
        <Stat icon={<Ic n="shield-check" />} label="Plantillas aprobadas" value={`${stats.aprobadas}/${stats.totalPlantillas}`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
        <div className="card card-pad">
          <CardHead title="Mensajes por flujo" sub="Solo enviados/entregados" />
          {porFlujo.length === 0 ? (
            <div className="dim" style={{ fontSize: 12.5, padding: '20px 0' }}>Aún no hay mensajes enviados.</div>
          ) : (
            <div style={{ marginTop: 10 }}><Donut data={porFlujo} fmt={contarN} /></div>
          )}
        </div>
        <div className="card card-pad">
          <CardHead title="Envíos · últimos 7 días" />
          <div style={{ marginTop: 10 }}><BarChart data={ultimos7} h={180} highlightLast fmt={contarN} /></div>
        </div>
      </div>
    </div>
  )
}

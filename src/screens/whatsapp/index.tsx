import React, { useEffect, useState } from 'react'
import { Seg } from '../../components/ui'
import { useStore } from '../../data/store'
import { db } from '../../lib/db'
import type { WaMensaje, WaPlantilla } from '../../types'
import { Resumen } from './Resumen'
import { Audiencias } from './Audiencias'
import { Conversaciones } from './Conversaciones'

const TABS = ['Resumen', 'Audiencias', 'Conversaciones']

export function ScreenWhatsApp({ onNavigate: _onNavigate }: { onNavigate: (r: string) => void }) {
  const { loadFromSupabase } = useStore()
  const [vista, setVista] = useState('Resumen')
  // Cuando Audiencias manda a ver una conversación real, guarda el teléfono
  // aquí para que Conversaciones la preseleccione al montar — así "audiencia"
  // y "conversación" son la misma vista de un contacto, no dos mundos.
  const [telAbierto, setTelAbierto] = useState<string | null>(null)

  const abrirConversacion = (tel: string) => { setTelAbierto(tel); setVista('Conversaciones') }

  // Cola de WhatsApp automático — vive aquí (no dentro de cada pestaña) para
  // que Resumen, Audiencias y Conversaciones compartan la misma fuente de
  // verdad sin recargarla cada una por su lado.
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Seg opts={TABS} value={vista} onChange={setVista} />

      {vista === 'Resumen' && <Resumen cola={cola} plantillas={plantillas} />}
      {vista === 'Audiencias' && (
        <Audiencias
          plantillas={plantillas} cola={cola} cargando={cargandoCola} setCola={setCola}
          recargar={recargarCola} onAbrirConversacion={abrirConversacion}
        />
      )}
      {vista === 'Conversaciones' && <Conversaciones cola={cola} recargar={recargarCola} openTel={telAbierto} />}
    </div>
  )
}

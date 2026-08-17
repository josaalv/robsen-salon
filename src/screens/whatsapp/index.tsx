import React, { useEffect, useState } from 'react'
import { Seg } from '../../components/ui'
import { useStore } from '../../data/store'
import { db } from '../../lib/db'
import { supabase } from '../../lib/supabase'
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

  // Realtime: un mensaje entrante o un cambio de estado (entregado/leído,
  // confirmar/cancelar por botón) escrito por el webhook del lado del
  // servidor llega aquí al instante, sin esperar a que alguien recargue la
  // página — el mismo comportamiento "vinculado al momento" que WhatsApp
  // normal. Se debounce 400ms porque el webhook puede escribir varias filas
  // seguidas (ej. mensaje + patch de estado) y no tiene caso recargar dos
  // veces por el mismo evento humano.
  useEffect(() => {
    if (!supabase) return
    let t: ReturnType<typeof setTimeout> | null = null
    const disparar = () => {
      if (t) clearTimeout(t)
      t = setTimeout(() => { recargarCola() }, 400)
    }
    const canal = supabase
      .channel('wa_mensajes_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_mensajes' }, disparar)
      .subscribe()
    return () => { if (t) clearTimeout(t); supabase.removeChannel(canal) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Respaldo: si el canal de Realtime se cae por una red intermitente,
  // este timer evita quedarse desactualizado indefinidamente.
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

import React, { useState, useMemo, useEffect } from 'react'
import { Avatar, CardHead, Modal, toast } from '../../components/ui'
import { PhosphorIcon as Ic } from '../../components/PhosphorIcon'
import { useStore } from '../../data/store'
import { useAuth } from '../../lib/auth'
import { db } from '../../lib/db'
import { mxn, descargarCSV, helpers } from '../../lib/helpers'
import type { Clienta, WaMensaje, WaPlantilla } from '../../types'
import { Item, AUTO_CONTACTADO, CAT_SEC, EST_MSG, SECS, URGCOLOR, norm10, waUrl } from './shared'
import { PanelAutomatizacion } from './Automatizacion'

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

interface AudienciasProps {
  plantillas: WaPlantilla[]; cola: WaMensaje[]; cargando: boolean
  setCola: React.Dispatch<React.SetStateAction<WaMensaje[]>>
  recargar: () => Promise<void>
  onAbrirConversacion: (tel: string) => void
}

export function Audiencias({ plantillas, cola, cargando, setCola, recargar, onAbrirConversacion }: AudienciasProps) {
  const { data } = useStore()
  const { user } = useAuth()
  const [sec, setSec] = useState('hoy_pend')
  const [selItem, setSelItem] = useState<Item|null>(null)
  const [msgEdit, setMsgEdit] = useState('')
  const [showNueva, setShowNueva] = useState(false)
  const [soloNoContactados, setSoloNoContactados] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [enviandoLote, setEnviandoLote] = useState(false)

  // "Contactado" real y compartido — vive en wa_contactos_manual, no en
  // localStorage: cualquier empleada ve el mismo estado, y queda quién lo
  // marcó y cuándo. Se recarga junto con la cola para no quedar desfasado.
  const [contactadosMap, setContactadosMap] = useState<Record<string, { por: string; at: string }>>({})
  const [confirmLimpiar, setConfirmLimpiar] = useState(false)
  const cargarContactados = () => db.getContactosManual().then(setContactadosMap)
  useEffect(() => { cargarContactados() }, [])

  // ─── Build all section items ───────────────────────────────────────────────
  const hoy = new Date()
  const mañana = new Date(hoy); mañana.setDate(hoy.getDate() + 1)
  const MANANA_STR = `${mañana.getFullYear()}-${String(mañana.getMonth()+1).padStart(2,'0')}-${String(mañana.getDate()).padStart(2,'0')}`

  const todos = useMemo((): Record<string, Item[]> => {
    const salon = data.config.nombre || 'el salón'
    const clByNombre = (nombre: string) => data.clientas.find(c => c.nombre === nombre)
    const estNombre = (id: string) => data.estilistas.find(e => e.id === id)?.nombre.split(' ')[0] || 'tu estilista'
    // Mensaje automático más reciente (no cancelado) para una clienta+flujo,
    // o una cita+flujo puntual cuando se pasa citaId. Este cruce es lo que
    // conecta cada audiencia con lo que el sistema de automatización ya hizo
    // por ese contacto — antes solo 3 de 13 secciones lo usaban.
    const automaticoDe = (flujo: string, clientaId?: string, citaId?: string): WaMensaje | undefined =>
      cola
        .filter(m => m.flujo === flujo && m.estado !== 'cancelado'
          && (citaId ? m.citaId === citaId : m.clientaId === clientaId))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0]

    const hoy_pend: Item[] = data.hoy.filter(c => c.estado === 'pend').map(c => {
      const cl = clByNombre(c.cl)
      return { id:c.id, nombre:c.cl, tel:cl?.tel||'', ini:cl?.ini||c.cl[0], urgencia:'alta',
        contexto:`${c.srv} · ${c.h}`, sub:estNombre(c.est),
        msg:`Hola ${c.cl.split(' ')[0]} 💛 Te confirmamos tu cita de *${c.srv}* hoy a las *${c.h}* con ${estNombre(c.est)}. Responde *CONFIRMO* para apartar tu lugar ✅`,
        automatico: automaticoDe('confirmacion', undefined, c.id) }
    })

    const cobros: Item[] = data.ventas.filter(v => v.estado==='parcial'||v.estado==='pendiente').map(v => {
      const saldo = Math.max(0, v.lineas.reduce((s,l)=>s+l.precio*l.cant,0) - (v.desc||0) - (v.anticipo||0))
      const cl = data.clientas.find(c=>c.id===v.clienteId)
      const srv = v.lineas.find(l=>l.tipo==='servicio')?.nombre || 'tu servicio'
      // Sin flujo automático de cobranza — se deja honestamente manual, sin
      // inventar un cruce que no existe en el backend.
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

    const post_visita: Item[] = data.clientas.filter(c => { const d=helpers.diasDesde(c.ultima); return d>=1&&d<=3 }).map(c => {
      const d = helpers.diasDesde(c.ultima)
      return { id:c.id+'_pv', nombre:c.nombre, tel:c.tel, ini:c.ini, urgencia:'media' as const,
        contexto:`Visitó hace ${d} día${d>1?'s':''}`, sub:c.fav,
        msg:`Hola ${c.nombre.split(' ')[0]} 💛 Fue un placer tenerte en ${salon}. ¿Cómo quedaste con tu ${c.fav}? Tu opinión nos importa mucho 😊`,
        automatico: automaticoDe('post_visita', c.id) }
    })

    const react = (catSec: string, buildMsg: (c:Clienta)=>string): Item[] =>
      data.clientas.filter(c => {
        const cat = data.servicios.find(s=>s.nombre===c.fav)?.cat||''
        return CAT_SEC[cat]===catSec && helpers.diasDesde(c.ultima) >= c.ciclo*7*0.85
      }).map(c => {
        const dias = helpers.diasDesde(c.ultima)
        return { id:`${c.id}_r_${catSec}`, nombre:c.nombre, tel:c.tel, ini:c.ini,
          urgencia: dias>c.ciclo*7*1.2?'alta':'media' as 'alta'|'media',
          contexto:`${c.fav} · hace ${dias} días`, sub:`Ciclo ${c.ciclo} sem`,
          msg: buildMsg(c),
          automatico: automaticoDe('reactivacion', c.id) }
      })

    const mechas      = react('mechas',      c=>`Hola ${c.nombre.split(' ')[0]} ✨ Ya casi es hora de dar mantenimiento a tu ${c.fav}. ¿Agendamos en las próximas semanas? Te esperamos en ${salon} 💇‍♀️`)
    const color       = react('color',       c=>`Hola ${c.nombre.split(' ')[0]} 💛 Ya casi es momento del retoque de ${c.fav}. ¿Cuándo te acomodamos? 🗓`)
    const tratamiento = react('tratamiento', c=>`Hola ${c.nombre.split(' ')[0]} 💛 ¿Lista para renovar tu ${c.fav}? Tu cabello lo va a agradecer 🌿`)
    const unas        = react('unas',        c=>`Hola ${c.nombre.split(' ')[0]} 💅 Ya casi es hora de tu ${c.fav}. ¿Agendamos esta semana? Te esperamos ✨`)
    const cortes      = react('cortes',      c=>`Hola ${c.nombre.split(' ')[0]} ✂️ Tu corte ya está pidiendo tijeras 😄 ¿Cuándo pasas por ${salon}?`)
    const maquillaje  = react('maquillaje',  c=>`Hola ${c.nombre.split(' ')[0]} 💛 ¿Tienes algún evento próximo? Tenemos ${c.fav} disponible. ¿Agendamos? ✨`)

    const cumples: Item[] = data.clientas.filter(c=>helpers.diasACumple(c.cumple)<=7)
      .sort((a,b)=>helpers.diasACumple(a.cumple)-helpers.diasACumple(b.cumple))
      .map(c => {
        const d = helpers.diasACumple(c.cumple)
        return { id:c.id+'_cumple', nombre:c.nombre, tel:c.tel, ini:c.ini,
          urgencia: d===0?'alta':'media' as 'alta'|'media',
          contexto: d===0?'¡Hoy es su cumpleaños!':`Cumpleaños en ${d} días`, sub:c.cumple,
          msg: d===0
            ? `¡Feliz cumpleaños ${c.nombre.split(' ')[0]}! 🎂🎉 Todo el equipo de ${salon} te desea un día increíble. ¡Eres muy especial para nosotras! 💛`
            : `Hola ${c.nombre.split(' ')[0]} 💛 Estamos a nada de tu cumpleaños 🎂 Tenemos una sorpresa especial para ti en ${salon}. ¡Ven a celebrar! ✨`,
          automatico: automaticoDe('cumpleanos', c.id) }
      })

    const nuevas: Item[] = data.clientas.filter(c=>c.visitas===1&&helpers.diasDesde(c.ultima)<=14).map(c=>{
      const d = helpers.diasDesde(c.ultima)
      return { id:c.id+'_nva', nombre:c.nombre, tel:c.tel, ini:c.ini, urgencia:'media' as const,
        contexto:`Primera visita · hace ${d} días`, sub:c.fav,
        msg:`Hola ${c.nombre.split(' ')[0]} 💛 Fue un gusto que nos visitaras en ${salon}. ¿Cómo quedaste con tu ${c.fav}? ¡Esperamos verte pronto! 😊`,
        automatico: automaticoDe('bienvenida', c.id) }
    })

    const inactivas: Item[] = data.clientas
      .filter(c=>c.estado==='Inactiva'||helpers.diasDesde(c.ultima)>c.ciclo*7*1.5)
      .map(c=>{
        const d = helpers.diasDesde(c.ultima)
        return { id:c.id+'_ina', nombre:c.nombre, tel:c.tel, ini:c.ini,
          urgencia: d>120?'alta':'media' as 'alta'|'media',
          contexto:`Sin visita hace ${d} días`, sub:c.fav,
          msg:`Hola ${c.nombre.split(' ')[0]} 💛 ¡Te extrañamos en ${salon}! Llevamos tiempo sin verte. ¿Cuándo nos visitas? Tenemos algo especial cuando regreses ✨`,
          automatico: automaticoDe('reactivacion', c.id)
        }
      })

    return { hoy_pend, cobros, manana, post_visita, mechas, color, tratamiento, unas, cortes, maquillaje, cumples, nuevas, inactivas }
  }, [data, cola]) // eslint-disable-line react-hooks/exhaustive-deps

  // "Contactado" real: un envío automático ya entregado/leído/respondido
  // cuenta como contacto hecho, igual que una marca manual compartida.
  const efectivo = (item: Item) => !!contactadosMap[item.id]
    || (!!item.automatico && AUTO_CONTACTADO.includes(item.automatico.estado))

  const items = (todos[sec] || []).filter(i => soloNoContactados ? !efectivo(i) : true)

  const marcar = async (id: string) => {
    const yaMarcado = !!contactadosMap[id]
    setContactadosMap(prev => { const next = { ...prev }; if (yaMarcado) delete next[id]; else next[id] = { por: user?.nombre || 'staff', at: new Date().toISOString() }; return next })
    try {
      if (yaMarcado) await db.desmarcarContactosManual([id])
      else await db.marcarContactosManual([id], user?.nombre || 'staff')
    } catch {
      toast('No se pudo guardar. Intenta de nuevo.')
      cargarContactados()
    }
  }

  const cambiarSec = (id: string) => { setSec(id); setSelItem(null); setSel(new Set()) }
  const selectItem = (item: Item) => { setSelItem(item); setMsgEdit(item.msg) }

  // ─── Selección múltiple + acciones en lote ─────────────────────────────────
  const toggleSel = (id: string) => setSel(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const seleccionarTodos = () => setSel(new Set(items.map(i => i.id)))
  const seleccionarNinguno = () => setSel(new Set())

  const marcarLoteContactadas = async () => {
    const ids = [...sel]
    try {
      await db.marcarContactosManual(ids, user?.nombre || 'staff')
      await cargarContactados()
      toast(`${ids.length} marcada${ids.length>1?'s':''} como contactada${ids.length>1?'s':''}.`)
      setSel(new Set())
    } catch {
      toast('No se pudo guardar. Intenta de nuevo.')
    }
  }

  const enviarLote = async () => {
    const elegidas = items.filter(i => sel.has(i.id) && i.tel)
    if (!elegidas.length) { toast('Selecciona clientas con teléfono en esta lista.'); return }
    setEnviandoLote(true)
    try {
      await db.insertWaMensajes(elegidas.map(i => {
        const cl = data.clientas.find(c => c.nombre === i.nombre)
        return {
          clientaId: cl?.id, tel: i.tel, flujo: 'manual', variables: {}, cuerpo: i.msg,
          estado: 'pendiente_aprobacion', requiereAprobacion: true, creadoPor: 'staff',
        }
      }))
      await recargar()
      toast(`${elegidas.length} mensaje${elegidas.length>1?'s':''} agregado${elegidas.length>1?'s':''} a la cola de aprobación (arriba, en Automatización).`)
      setSel(new Set())
    } catch {
      toast('No se pudo encolar el envío en lote. Intenta de nuevo.')
    } finally {
      setEnviandoLote(false)
    }
  }

  const exportarCSV = () => {
    const filas: (string|number)[][] = [['Nombre','Teléfono','Contexto','Urgencia']]
    items.forEach(i => filas.push([i.nombre, i.tel, i.contexto, i.urgencia]))
    descargarCSV(`seguimiento_${sec}`, filas)
  }

  const totalContactadosManual = Object.keys(contactadosMap).length
  const limpiarTodo = async () => {
    try {
      await db.limpiarContactosManual()
      setContactadosMap({})
      setConfirmLimpiar(false)
      toast('Marcas de contacto manual borradas.')
    } catch {
      toast('No se pudo limpiar. Intenta de nuevo.')
    }
  }

  // ¿Ya existe un hilo de conversación real con este contacto? (la clienta
  // ya respondió algo alguna vez) — si sí, tiene más sentido mandarla a la
  // conversación completa que dejarla solo con el editor de un mensaje suelto.
  const tieneHilo = (tel: string) => {
    const t10 = norm10(tel)
    return !!t10 && cola.some(m => m.creadoPor === 'clienta' && norm10(m.tel) === t10)
  }

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

      <PanelAutomatizacion plantillas={plantillas} cola={cola} cargando={cargando} setCola={setCola} recargar={recargar} />

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
                    onClick={()=>cambiarSec(s.id)}
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
              <button className="btn ghost sm" onClick={exportarCSV} title="Exportar esta audiencia a CSV">
                <Ic n="download-simple" size={13}/>CSV
              </button>
              <button
                className={'btn sm '+(soloNoContactados?'gold':'ghost')}
                onClick={()=>setSoloNoContactados(v=>!v)}
              >
                <Ic n="funnel" size={13}/>
                {soloNoContactados?'Solo pendientes':'Mostrar todos'}
              </button>
            </div>
          </div>

          {items.length > 0 && (
            <div className="between" style={{ padding:'8px 20px', borderBottom:'1px solid var(--line-soft)', background:'var(--surface-2)', flexWrap:'wrap', gap:8 }}>
              <div className="vc gap8">
                <button className="btn ghost sm" onClick={sel.size===items.length ? seleccionarNinguno : seleccionarTodos}>
                  <Ic n={sel.size===items.length?'check-square':'square'} size={13}/>
                  {sel.size===items.length?'Ninguno':'Todos'}
                </button>
                {sel.size>0 && <span className="dim" style={{ fontSize:12 }}>{sel.size} seleccionada{sel.size>1?'s':''}</span>}
              </div>
              {sel.size>0 && (
                <div className="vc gap8">
                  <button className="btn ghost sm" onClick={marcarLoteContactadas}>
                    <Ic n="check-circle" size={13}/>Marcar contactadas
                  </button>
                  <button className="btn gold sm" disabled={enviandoLote} onClick={enviarLote}>
                    <Ic n={enviandoLote?'spinner':'paper-plane-tilt'} size={13}/>
                    {enviandoLote?'Encolando…':`Encolar envío (${sel.size})`}
                  </button>
                </div>
              )}
            </div>
          )}

          {items.length === 0 ? (
            <div className="card-pad" style={{ textAlign:'center', padding:'40px 0', color:'var(--text-4)' }}>
              <Ic n="check-circle" size={32} style={{ display:'block', margin:'0 auto 10px', color:'var(--st-conf)', opacity:.6 }}/>
              <div style={{ fontWeight:600, fontSize:13.5 }}>Todo al día</div>
              <div style={{ fontSize:12.5, marginTop:4 }}>Sin pendientes en esta audiencia</div>
            </div>
          ) : (
            <div>
              {items.map((item,i)=>{
                const done = efectivo(item)
                const active = selItem?.id===item.id
                const est = item.automatico ? EST_MSG[item.automatico.estado] : undefined
                const marcaManual = contactadosMap[item.id]
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
                    {/* Selección */}
                    <input
                      type="checkbox"
                      checked={sel.has(item.id)}
                      onClick={e=>e.stopPropagation()}
                      onChange={()=>toggleSel(item.id)}
                      style={{ flexShrink:0, cursor:'pointer' }}
                    />

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
                      {est ? (
                        <div style={{ marginTop:4 }}>
                          <span className="badge" style={{ fontSize:10, color:est.color, borderColor:est.color }}>
                            Automático · {est.label}
                          </span>
                        </div>
                      ) : marcaManual ? (
                        <div style={{ marginTop:4 }}>
                          <span className="badge" style={{ fontSize:10, color:'var(--text-3)' }}>
                            Contactada por {marcaManual.por || 'staff'}
                          </span>
                        </div>
                      ) : null}
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
              {selItem.tel && tieneHilo(selItem.tel) && (
                <button className="btn ghost sm" onClick={()=>onAbrirConversacion(selItem.tel)}>
                  <Ic n="chats-circle" size={14}/>Ver conversación completa
                </button>
              )}
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
                      .replace('{dias}', String(helpers.diasDesde(cl?.ultima||'')||60))
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

          {totalContactadosManual>0 && (
            <button
              className="btn ghost sm"
              style={{ justifyContent:'center', color: confirmLimpiar ? 'var(--st-canc)' : undefined }}
              onClick={()=> confirmLimpiar ? limpiarTodo() : setConfirmLimpiar(true)}
              onMouseLeave={()=>setConfirmLimpiar(false)}
            >
              <Ic n="arrow-counter-clockwise" size={13}/>
              {confirmLimpiar ? '¿Confirmar borrar todas las marcas?' : `Limpiar ${totalContactadosManual} marcado${totalContactadosManual!==1?'s':''}`}
            </button>
          )}
        </div>

      </div>
    </div>
  )
}

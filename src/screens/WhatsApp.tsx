import React, { useState, useMemo } from 'react'
import { Avatar, CardHead, toast, Modal } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { useStore } from '../data/store'
import { mxn } from '../lib/helpers'
import type { Clienta } from '../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const HOY = new Date(2026, 5, 18)
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
}

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
function NuevaPlantillaModal({ onClose }: { onClose: () => void }) {
  const { upsertPlantilla } = useStore()
  const [nombre, setNombre] = useState('')
  const [txt, setTxt] = useState('')
  const ICONS = ['chat-text','calendar-check','clock-countdown','hand-coins','user-plus','gift','sparkle']
  const [icon, setIcon] = useState('chat-text')
  const save = () => {
    if (!nombre.trim() || !txt.trim()) { toast('Completa nombre y mensaje'); return }
    upsertPlantilla({ id:'pl'+Date.now(), nombre:nombre.trim(), icon, txt:txt.trim() })
    toast('Plantilla guardada'); onClose()
  }
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
          <div className="field"><label className="label">Mensaje</label>
            <textarea className="input" rows={5}
              placeholder="Variables: {nombre} {servicio} {fecha} {hora} {estilista} {dias}"
              value={txt} onChange={e=>setTxt(e.target.value)}
              style={{ resize:'vertical', fontFamily:'var(--sans)', lineHeight:1.6 }} />
            <div className="dim" style={{ fontSize:11,marginTop:6 }}>Variables: {'{nombre}'} {'{servicio}'} {'{hora}'} {'{dias}'}</div>
          </div>
        </div>
        <div className="between card-pad" style={{ borderTop:'1px solid var(--line-soft)', paddingTop:16 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn gold" onClick={save}><Ic n="check"/>Guardar</button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export function ScreenWhatsApp({ onNavigate: _onNavigate }: { onNavigate: (r:string)=>void }) {
  const { data } = useStore()
  const [sec, setSec] = useState('hoy_pend')
  const [contactados, setContactados] = useState<Set<string>>(new Set())
  const [selItem, setSelItem] = useState<Item|null>(null)
  const [msgEdit, setMsgEdit] = useState('')
  const [showNueva, setShowNueva] = useState(false)
  const [soloNoContactados, setSoloNoContactados] = useState(false)

  // ─── Build all section items ───────────────────────────────────────────────
  const MANANA_STR = '2026-06-19'

  const todos = useMemo((): Record<string, Item[]> => {
    const clByNombre = (nombre: string) => data.clientas.find(c => c.nombre === nombre)
    const estNombre = (id: string) => data.estilistas.find(e => e.id === id)?.nombre.split(' ')[0] || 'tu estilista'

    const hoy_pend: Item[] = data.hoy.filter(c => c.estado === 'pend').map(c => {
      const cl = clByNombre(c.cl)
      return { id:c.id, nombre:c.cl, tel:cl?.tel||'', ini:cl?.ini||c.cl[0], urgencia:'alta',
        contexto:`${c.srv} · ${c.h}`, sub:estNombre(c.est),
        msg:`Hola ${c.cl.split(' ')[0]} 💛 Te confirmamos tu cita de *${c.srv}* hoy a las *${c.h}* con ${estNombre(c.est)}. Responde *CONFIRMO* para apartar tu lugar ✅` }
    })

    const cobros: Item[] = data.ventas.filter(v => v.estado==='parcial'||v.estado==='pendiente').map(v => {
      const saldo = v.lineas.reduce((s,l)=>s+l.precio*l.cant,0) - v.desc - v.anticipo
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
        msg:`Hola ${c.cl.split(' ')[0]} 💛 Te recordamos tu cita de *${c.srv}* mañana a las *${c.h}* con ${estNombre(c.est)}. ¡Te esperamos! ✨` }
    })

    const post_visita: Item[] = data.clientas.filter(c => { const d=diasDesde(c.ultima); return d>=1&&d<=3 }).map(c => ({
      id:c.id+'_pv', nombre:c.nombre, tel:c.tel, ini:c.ini, urgencia:'media' as const,
      contexto:`Visitó hace ${diasDesde(c.ultima)} día${diasDesde(c.ultima)>1?'s':''}`, sub:c.fav,
      msg:`Hola ${c.nombre.split(' ')[0]} 💛 Fue un placer tenerte en Robsen. ¿Cómo quedaste con tu ${c.fav}? Tu opinión nos importa mucho 😊`
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

    const mechas      = react('mechas',      c=>`Hola ${c.nombre.split(' ')[0]} ✨ Ya casi es hora de dar mantenimiento a tu ${c.fav}. ¿Agendamos en las próximas semanas? Te esperamos en Robsen 💇‍♀️`)
    const color       = react('color',       c=>`Hola ${c.nombre.split(' ')[0]} 💛 Ya casi es momento del retoque de ${c.fav}. ¿Cuándo te acomodamos? 🗓`)
    const tratamiento = react('tratamiento', c=>`Hola ${c.nombre.split(' ')[0]} 💛 ¿Lista para renovar tu ${c.fav}? Tu cabello lo va a agradecer 🌿`)
    const unas        = react('unas',        c=>`Hola ${c.nombre.split(' ')[0]} 💅 Ya casi es hora de tu ${c.fav}. ¿Agendamos esta semana? Te esperamos ✨`)
    const cortes      = react('cortes',      c=>`Hola ${c.nombre.split(' ')[0]} ✂️ Tu corte ya está pidiendo tijeras 😄 ¿Cuándo pasas por Robsen?`)
    const maquillaje  = react('maquillaje',  c=>`Hola ${c.nombre.split(' ')[0]} 💛 ¿Tienes algún evento próximo? Tenemos ${c.fav} disponible. ¿Agendamos? ✨`)

    const cumples: Item[] = data.clientas.filter(c=>diasCumple(c.cumple)<=7)
      .sort((a,b)=>diasCumple(a.cumple)-diasCumple(b.cumple))
      .map(c => {
        const d = diasCumple(c.cumple)
        return { id:c.id+'_cumple', nombre:c.nombre, tel:c.tel, ini:c.ini,
          urgencia: d===0?'alta':'media' as 'alta'|'media',
          contexto: d===0?'¡Hoy es su cumpleaños!':`Cumpleaños en ${d} días`, sub:c.cumple,
          msg: d===0
            ? `¡Feliz cumpleaños ${c.nombre.split(' ')[0]}! 🎂🎉 Todo el equipo de Robsen te desea un día increíble. ¡Eres muy especial para nosotras! 💛`
            : `Hola ${c.nombre.split(' ')[0]} 💛 Estamos a nada de tu cumpleaños 🎂 Tenemos una sorpresa especial para ti en Robsen. ¡Ven a celebrar! ✨` }
      })

    const nuevas: Item[] = data.clientas.filter(c=>c.visitas===1&&diasDesde(c.ultima)<=14).map(c=>({
      id:c.id+'_nva', nombre:c.nombre, tel:c.tel, ini:c.ini, urgencia:'media' as const,
      contexto:`Primera visita · hace ${diasDesde(c.ultima)} días`, sub:c.fav,
      msg:`Hola ${c.nombre.split(' ')[0]} 💛 Fue un gusto que nos visitaras en Robsen. ¿Cómo quedaste con tu ${c.fav}? ¡Esperamos verte pronto! 😊`
    }))

    const inactivas: Item[] = data.clientas
      .filter(c=>c.estado==='Inactiva'||diasDesde(c.ultima)>c.ciclo*7*1.5)
      .map(c=>({ id:c.id+'_ina', nombre:c.nombre, tel:c.tel, ini:c.ini,
        urgencia: diasDesde(c.ultima)>120?'alta':'media' as 'alta'|'media',
        contexto:`Sin visita hace ${diasDesde(c.ultima)} días`, sub:c.fav,
        msg:`Hola ${c.nombre.split(' ')[0]} 💛 ¡Te extrañamos en Robsen! Llevamos tiempo sin verte. ¿Cuándo nos visitas? Tenemos algo especial cuando regreses ✨`
      }))

    return { hoy_pend, cobros, manana, post_visita, mechas, color, tratamiento, unas, cortes, maquillaje, cumples, nuevas, inactivas }
  }, [data])

  const items = (todos[sec] || []).filter(i => soloNoContactados ? !contactados.has(i.id) : true)

  const marcar = (id: string) => setContactados(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
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
      <div style={{ display:'grid', gridTemplateColumns:'220px 1fr 290px', gap:14, alignItems:'start' }}>

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
                const done = contactados.has(item.id)
                const active = selItem?.id===item.id
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
                        <Ic n={done?'check':'check'} size={13}/>
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
                style={{ resize:'vertical', fontSize:12.5, lineHeight:1.6, fontFamily:'var(--sans)' }}
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
            <button className="btn ghost sm" style={{ justifyContent:'center' }} onClick={()=>setContactados(new Set())}>
              <Ic n="arrow-counter-clockwise" size={13}/>Limpiar {contactados.size} marcado{contactados.size>1?'s':''}
            </button>
          )}
        </div>

      </div>
    </div>
  )
}

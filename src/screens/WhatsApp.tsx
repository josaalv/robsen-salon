import React, { useState, useEffect, useRef } from 'react'
import { Avatar, Seg, Switch, CardHead, toast } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { useStore } from '../data/store'
import { mxn } from '../lib/helpers'

interface ChatMsg { dir: 'in' | 'out'; txt: string; ts: string }

function EstadoMsg({ estado }: { estado: string }) {
  if (estado === 'enviado') return <Ic n="check" size={14} style={{ color: 'var(--text-3)' }} />
  if (estado === 'entregado') return <Ic n="checks" size={14} style={{ color: 'var(--text-2)' }} />
  if (estado === 'respondido') return <Ic n="checks" size={14} style={{ color: 'var(--st-conf)' }} />
  return null
}

export function ScreenWhatsApp({ onNavigate }: { onNavigate: (r: string) => void }) {
  const { data } = useStore()
  const mensajes = data.mensajes
  const estilistas = data.estilistas
  const plantillas = data.plantillas

  const [sel, setSel] = useState(mensajes[0])
  const [filtro, setFiltro] = useState('Pendientes')
  const [draft, setDraft] = useState('')
  const [chats, setChats] = useState<Record<string, ChatMsg[]>>({})
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = filtro === 'Todos' ? mensajes : filtro === 'Inactivas' ? mensajes.filter(m => m.tipo === 'inactiva') : mensajes.filter(m => m.estado !== 'respondido')

  const fillTpl = (txt: string) => {
    if (!sel) return
    const t = txt
      .replace('{nombre}', sel.cl.split(' ')[0])
      .replace('{servicio}', 'tu servicio')
      .replace('{fecha}', 'hoy')
      .replace('{hora}', '11:00')
      .replace('{estilista}', estilistas.find(e => e.id === sel.est)?.nombre.split(' ')[0] || '')
      .replace('{dias}', '60')
    setDraft(t)
    inputRef.current?.focus()
  }

  const enviar = () => {
    if (!draft.trim() || !sel) return
    const ts = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    setChats(c => ({ ...c, [sel.id]: [...(c[sel.id] || []), { dir: 'out', txt: draft.trim(), ts }] }))
    setDraft('')
    toast('Mensaje enviado por WhatsApp')
  }

  const extra = sel ? (chats[sel.id] || []) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {[
          { icon: 'chat-circle-dots', label: 'Mensajes pendientes', val: 7, color: 'var(--st-pend)' },
          { icon: 'calendar-check', label: 'Confirmaciones hoy', val: 14, color: 'var(--st-conf)' },
          { icon: 'clock-countdown', label: 'Sin responder', val: 3, color: 'var(--st-canc)' },
          { icon: 'user-minus', label: 'Inactivas 30/60/90', val: 8, color: 'var(--gold)' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: k.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Ic n={k.icon} size={20} style={{ color: k.color }} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--serif)', color: k.color }}>{k.val}</div>
              <div className="dim" style={{ fontSize: 11, lineHeight: 1.3 }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 3-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr 300px', gap: 14, minHeight: 0 }}>

        {/* Left: bandeja */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '14px 14px 10px' }}>
            <Seg opts={['Pendientes', 'Todos', 'Inactivas']} value={filtro} onChange={setFiltro} />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.map(m => {
              const active = sel?.id === m.id
              return (
                <div
                  key={m.id}
                  onClick={() => setSel(m)}
                  style={{
                    padding: '12px 14px',
                    cursor: 'pointer',
                    borderLeft: active ? '3px solid var(--gold)' : '3px solid transparent',
                    background: active ? 'var(--gold-soft)' : 'transparent',
                    borderBottom: '1px solid var(--line-soft)',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <Avatar ini={m.cl} />
                    {m.sin && (
                      <div style={{ position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: '50%', background: 'var(--gold)', border: '2px solid var(--panel)' }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="between" style={{ gap: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.cl}</span>
                      <span className="dim" style={{ fontSize: 11, flexShrink: 0 }}>{m.t}</span>
                    </div>
                    <div className="dim" style={{ fontSize: 12, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.prev}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                      <span className="badge" style={{ fontSize: 10, background: m.tipo === 'inactiva' ? 'var(--st-canc)22' : 'var(--st-conf)22', color: m.tipo === 'inactiva' ? 'var(--st-canc)' : 'var(--st-conf)', padding: '2px 6px', borderRadius: 4 }}>{m.tipo}</span>
                      <EstadoMsg estado={m.estado} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Center: conversation */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {sel ? (
            <>
              {/* Header */}
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar ini={sel.cl} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{sel.cl}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-3)' }}>
                    <span>WhatsApp</span>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#25D366' }} />
                    <span style={{ color: '#25D366' }}>en línea</span>
                  </div>
                </div>
                <button className="btn ghost sm" onClick={() => onNavigate('crm')}>
                  <Ic n="user" size={14} /> Ver perfil
                </button>
              </div>

              {/* Chat bubbles */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 8 }}>
                <div style={{ textAlign: 'center' }}>
                  <span className="dim" style={{ fontSize: 11, background: 'var(--surface-2)', padding: '3px 10px', borderRadius: 99 }}>Hoy</span>
                </div>

                {/* Outgoing initial bubble */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ maxWidth: '75%', background: 'var(--gold)', color: '#1a1108', borderRadius: '14px 14px 4px 14px', padding: '10px 13px', fontSize: 13, lineHeight: 1.5 }}>
                    Hola {sel.cl.split(' ')[0]} 💛 Confirmamos tu cita de {estilistas.find(e => e.id === sel.est)?.nombre.split(' ')[0] || 'tu estilista'}. Responde CONFIRMO para apartar tu lugar.
                    <div style={{ fontSize: 10, marginTop: 4, textAlign: 'right', opacity: 0.7 }}>10:24 <Ic n="checks" size={10} /></div>
                  </div>
                </div>

                {/* Incoming response if respondido */}
                {sel.estado === 'respondido' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{ maxWidth: '75%', background: 'var(--surface-2)', borderRadius: '14px 14px 14px 4px', padding: '10px 13px', fontSize: 13, lineHeight: 1.5 }}>
                      {sel.prev}
                      <div className="dim" style={{ fontSize: 10, marginTop: 4 }}>10:31</div>
                    </div>
                  </div>
                )}

                {/* Sin respuesta indicator */}
                {sel.sin && extra.length === 0 && (
                  <div style={{ textAlign: 'center', margin: '4px 0' }}>
                    <span className="dim" style={{ fontSize: 11 }}>Sin respuesta · enviado hace 2 h</span>
                  </div>
                )}

                {/* Extra bubbles */}
                {extra.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.dir === 'out' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '75%',
                      background: msg.dir === 'out' ? 'var(--gold)' : 'var(--surface-2)',
                      color: msg.dir === 'out' ? '#1a1108' : 'var(--text)',
                      borderRadius: msg.dir === 'out' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      padding: '10px 13px',
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}>
                      {msg.txt}
                      <div style={{ fontSize: 10, marginTop: 4, textAlign: 'right', opacity: 0.7 }}>{msg.ts}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input area */}
              <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line-soft)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn icon ghost" style={{ flexShrink: 0 }}>
                  <Ic n="paperclip" size={18} />
                </button>
                <input
                  ref={inputRef}
                  className="input"
                  style={{ flex: 1 }}
                  placeholder="Escribe un mensaje..."
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                />
                <button className="btn icon" style={{ background: 'var(--gold-grad)', flexShrink: 0 }} onClick={enviar}>
                  <Ic n="paper-plane" size={18} style={{ color: '#1a1108' }} />
                </button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="dim">
              Selecciona una conversación
            </div>
          )}
        </div>

        {/* Right: plantillas */}
        <div className="card" style={{ position: 'sticky', top: 92, display: 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: 'calc(100vh - 110px)' }}>
          <div style={{ padding: '14px 14px 10px' }}>
            <CardHead title="Plantillas" sub="Toca para insertar" />
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '0 14px' }}>
            {plantillas.map(p => (
              <div
                key={p.id}
                onClick={() => fillTpl(p.txt)}
                style={{ padding: '10px 12px', borderRadius: 'var(--r)', border: '1px solid var(--line-soft)', marginBottom: 8, cursor: 'pointer', background: 'var(--surface-2)' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line-soft)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Ic n={p.icon} size={16} style={{ color: 'var(--gold)' }} />
                  <span style={{ fontWeight: 600, fontSize: 12 }}>{p.nombre}</span>
                </div>
                <div className="dim" style={{ fontSize: 11, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.txt}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '10px 14px 14px' }}>
            <button className="btn ghost w100" onClick={() => toast('Función próximamente disponible')}>
              <Ic n="plus" size={14} /> Nueva plantilla
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

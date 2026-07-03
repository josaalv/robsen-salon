import React, { useState, useEffect } from 'react'
import { Avatar, Seg } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { useStore } from '../data/store'
import { mxn } from '../lib/helpers'
import type { Venta } from '../types'

interface CartItem {
  key: string
  tipo: 'servicio' | 'producto' | 'adicional'
  nombre: string
  precio: number
  sub: string
  stock?: number
  com: number
  prof?: string[]
  cant: number
  est: string | null
}

export function POSBuilder({ onClose, onConfirm, nextTicket }: {
  onClose: () => void
  onConfirm: (v: Venta) => Promise<void>
  nextTicket?: string
}) {
  const { data } = useStore()
  const DRAFT_KEY = 'rb_pos_draft'

  const [tab, setTab] = useState('Servicios')
  const [q, setQ] = useState('')
  const [cart, setCart] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY + '_cart') || '[]') } catch { return [] }
  })
  const [cliente, setCliente] = useState(() => localStorage.getItem(DRAFT_KEY + '_cliente') || '')
  const [desc, setDesc] = useState(() => Number(localStorage.getItem(DRAFT_KEY + '_desc') || '0'))
  const [anticipo, setAnticipo] = useState(() => Number(localStorage.getItem(DRAFT_KEY + '_anticipo') || '0'))

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY + '_cart', JSON.stringify(cart))
    localStorage.setItem(DRAFT_KEY + '_cliente', cliente)
    localStorage.setItem(DRAFT_KEY + '_desc', String(desc))
    localStorage.setItem(DRAFT_KEY + '_anticipo', String(anticipo))
  }, [cart, cliente, desc, anticipo])

  const clearDraft = () => {
    ;[DRAFT_KEY + '_cart', DRAFT_KEY + '_cliente', DRAFT_KEY + '_desc', DRAFT_KEY + '_anticipo'].forEach(k => localStorage.removeItem(k))
  }

  const ticket = nextTicket || ('#' + (1043 + data.ventas.length))
  const comisiones = data.config?.comisiones || {}
  const metodosPago = data.config?.metodospago
  const pagoOpts = [
    metodosPago?.tarjeta && 'Tarjeta',
    metodosPago?.efectivo && 'Efectivo',
    metodosPago?.transferencia && 'Transferencia',
    metodosPago?.credito && 'Crédito',
  ].filter(Boolean) as string[]
  const [pago, setPago] = useState(pagoOpts[0] || 'Tarjeta')

  const catalogo: Record<string, CartItem[]> = {
    Servicios: data.servicios.filter(s => s.activo !== false).map(s => ({
      tipo: 'servicio' as const,
      key: s.id,
      nombre: s.nombre,
      precio: s.precio,
      sub: s.cat + ' · ' + s.dur + ' min',
      prof: s.prof,
      com: comisiones[s.id] ?? comisiones[s.cat] ?? 30,
      cant: 1,
      est: null,
    })),
    Productos: data.productos.filter(p => p.uso === 'retail').map(p => ({
      tipo: 'producto' as const,
      key: p.id,
      nombre: p.nombre,
      precio: p.precio,
      sub: p.marca + ' · ' + p.stock + ' en stock',
      stock: p.stock,
      com: comisiones['_producto'] ?? 10,
      cant: 1,
      est: null,
    })),
    Adicionales: data.adicionales.map(a => ({
      tipo: 'adicional' as const,
      key: a.id,
      nombre: a.nombre,
      precio: a.precio,
      sub: a.cat,
      com: 0,
      cant: 1,
      est: null,
    })),
  }

  const items = (catalogo[tab] || []).filter(i => i.nombre.toLowerCase().includes(q.toLowerCase()))

  const addItem = (it: CartItem) => {
    setCart(c => {
      const ex = c.find(l => l.key === it.key)
      if (ex) return c.map(l => l.key === it.key ? { ...l, cant: l.cant + 1 } : l)
      const defEst = it.tipo === 'adicional' ? null : (it.prof && it.prof[0]) || data.estilistas[0].id
      return [...c, { ...it, cant: 1, est: defEst }]
    })
  }

  const setCant = (key: string, d: number) => setCart(c => c.map(l => l.key === key ? { ...l, cant: Math.max(1, l.cant + d) } : l))
  const del = (key: string) => setCart(c => c.filter(l => l.key !== key))
  const setLineEst = (key: string, est: string | null) => setCart(c => c.map(l => l.key === key ? { ...l, est } : l))

  const subtotal = cart.reduce((s, l) => s + l.precio * l.cant, 0)
  const total = Math.max(0, subtotal - desc)
  const saldo = Math.max(0, total - anticipo)
  const comision = cart.reduce((s, l) => s + Math.round(l.precio * l.cant * (l.com || 0) / 100), 0)

  const [confirming, setConfirming] = useState(false)
  const confirmar = async () => {
    if (!cart.length || confirming) return
    const venta: Venta = {
      id: 'v' + Date.now(),
      ticket,
      fecha: new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) + ' · ' + new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      cliente: cliente || 'Venta de mostrador',
      clienteId: data.clientas.find(c => c.nombre === cliente)?.id || '',
      pago,
      estado: anticipo > 0 && anticipo < total ? 'parcial' : 'pagada',
      desc,
      anticipo,
      lineas: cart.map(l => ({
        tipo: l.tipo,
        nombre: l.nombre,
        productoId: l.tipo === 'producto' ? l.key : undefined,
        est: l.est,
        cant: l.cant,
        precio: l.precio,
        com: l.com,
      })),
    }
    setConfirming(true)
    try {
      // clearDraft() se difiere hasta que Supabase confirme el guardado —
      // si falla, el carrito del cajero no debe perderse.
      await onConfirm(venta)
      clearDraft()
    } catch {
      // El error visible ya lo muestra el llamador (registrarVenta); aquí
      // solo evitamos perder el carrito y dejamos el modal abierto.
    } finally {
      setConfirming(false)
    }
  }

  const tipoIcon: Record<string, string> = { servicio: 'scissors', producto: 'package', adicional: 'plus' }

  return (
    <div className="rb-modal-bg" onClick={onClose}>
      <div
        className="card gold-edge rb-modal"
        onClick={e => e.stopPropagation()}
        style={{ width: 980, maxWidth: '96vw', height: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div className="card-head" style={{ flex: '0 0 auto' }}>
          <div>
            <div className="eyebrow">Punto de venta · Ticket {ticket}</div>
            <h3 style={{ marginTop: 6 }}>Nueva venta</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><Ic n="x" /></button>
        </div>

        <div className="pos-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', flex: 1, minHeight: 0 }}>
          {/* Catálogo */}
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: '1px solid var(--line-soft)' }}>
            <div style={{ padding: '14px 22px 0' }}>
              <div className="vc gap12" style={{ marginBottom: 14 }}>
                <Seg opts={['Servicios', 'Productos', 'Adicionales']} value={tab} onChange={setTab} />
                <div className="search f1">
                  <Ic n="magnifying-glass" />
                  <input placeholder={'Buscar en ' + tab.toLowerCase() + '…'} value={q} onChange={e => setQ(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="scroll-y" style={{ flex: 1, padding: '4px 22px 18px' }}>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
                {items.map(it => {
                  const agotado = it.tipo === 'producto' && (it.stock !== undefined && it.stock <= 0)
                  return (
                    <div
                      key={it.key}
                      className="opt-card"
                      style={{ padding: '13px 15px', opacity: agotado ? .4 : 1, pointerEvents: agotado ? 'none' : 'auto' }}
                      onClick={() => addItem(it)}
                    >
                      <div className="ico" style={{ width: 36, height: 36, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(200,161,74,0.08)', border: '1px solid var(--line)', color: 'var(--gold)', flex: '0 0 36px' }}>
                        <Ic n={tipoIcon[it.tipo]} />
                      </div>
                      <div className="f1" style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.25 }}>{it.nombre}</div>
                        <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>{it.sub}</div>
                      </div>
                      <div className="num gold-text" style={{ fontWeight: 600, fontSize: 14 }}>{it.precio ? mxn(it.precio) : '—'}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Ticket / carrito */}
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg-2)' }}>
            <div style={{ padding: '16px 20px 12px', flex: '0 0 auto' }}>
              <div className="field">
                <label>Clienta</label>
                <select className="select" value={cliente} onChange={e => setCliente(e.target.value)}>
                  <option value="">Venta de mostrador</option>
                  {data.clientas.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                </select>
              </div>
            </div>
            <hr className="hr" />

            <div className="scroll-y" style={{ flex: 1, padding: '8px 20px' }}>
              {cart.length > 0 && (
                <div className="between" style={{ padding: '6px 0 10px', borderBottom: '1px solid var(--line-soft)', marginBottom: 4 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{cart.length} artículo{cart.length !== 1 ? 's' : ''}</span>
                  <button className="btn ghost sm" style={{ fontSize: 11, padding: '3px 10px', color: 'var(--st-canc)' }} onClick={() => { setCart([]); setCliente(''); setDesc(0); setAnticipo(0); clearDraft() }}>
                    <Ic n="trash" size={12} />Limpiar
                  </button>
                </div>
              )}
              {!cart.length && (
                <div className="center dim" style={{ padding: '48px 12px', fontSize: 12.5 }}>
                  <div style={{ fontSize: 30, marginBottom: 10, opacity: .4 }}><Ic n="shopping-cart" /></div>
                  Agrega servicios, productos o adicionales desde el catálogo.
                </div>
              )}
              {cart.map(l => (
                <div key={l.key} style={{ padding: '12px 0', borderBottom: '1px solid var(--line-soft)' }}>
                  <div className="between" style={{ gap: 10 }}>
                    <div className="f1" style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{l.nombre}</div>
                      <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>
                        {mxn(l.precio)} c/u{l.com ? ` · com. ${l.com}%` : ''}
                      </div>
                    </div>
                    <div className="num" style={{ fontWeight: 600, fontSize: 13.5 }}>{mxn(l.precio * l.cant)}</div>
                    <button className="btn icon ghost sm" onClick={() => del(l.key)} style={{ color: 'var(--st-canc)' }}><Ic n="trash" /></button>
                  </div>
                  <div className="between mt10" style={{ gap: 10 }}>
                    <select
                      className="select"
                      value={l.est || ''}
                      onChange={ev => setLineEst(l.key, ev.target.value || null)}
                      style={{ padding: '6px 28px 6px 10px', fontSize: 12, width: 'auto', flex: 1 }}
                    >
                      <option value="">{l.tipo === 'producto' ? 'Vendido por…' : 'Sin asignar'}</option>
                      {data.estilistas.map(es => <option key={es.id} value={es.id}>{es.nombre}</option>)}
                    </select>
                    <div className="vc gap6">
                      <button className="btn icon ghost sm" onClick={() => setCant(l.key, -1)}><Ic n="minus" /></button>
                      <span className="num" style={{ minWidth: 18, textAlign: 'center', fontWeight: 600 }}>{l.cant}</span>
                      <button className="btn icon ghost sm" onClick={() => setCant(l.key, 1)}><Ic n="plus" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Totales y cobro */}
            <div style={{ flex: '0 0 auto', padding: '14px 20px', borderTop: '1px solid var(--line)' }}>
              <div className="vc gap10" style={{ marginBottom: 10 }}>
                <div className="field f1">
                  <label style={{ fontSize: 11 }}>Descuento</label>
                  <input className="input num" type="number" value={desc || ''} placeholder="0" onChange={e => setDesc(+e.target.value || 0)} style={{ padding: '8px 10px' }} />
                </div>
                <div className="field f1">
                  <label style={{ fontSize: 11 }}>Anticipo</label>
                  <input className="input num" type="number" value={anticipo || ''} placeholder="0" onChange={e => setAnticipo(+e.target.value || 0)} style={{ padding: '8px 10px' }} />
                </div>
                <div className="field f1">
                  <label style={{ fontSize: 11 }}>Pago</label>
                  <select className="select" value={pago} onChange={e => setPago(e.target.value)} style={{ padding: '8px 28px 8px 10px' }}>
                    {pagoOpts.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="between" style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 4 }}>
                <span>Subtotal</span>
                <span className="num">{mxn(subtotal)}</span>
              </div>
              {comision > 0 && (
                <div className="between" style={{ fontSize: 12, color: '#B08AC7', marginBottom: 4 }}>
                  <span className="vc gap6"><Ic n="users-three" />Comisión equipo</span>
                  <span className="num">{mxn(comision)}</span>
                </div>
              )}
              <div className="between" style={{ alignItems: 'flex-end', marginTop: 8 }}>
                <div>
                  <div className="dim" style={{ fontSize: 11 }}>{saldo < total ? 'Saldo por cobrar' : 'Total'}</div>
                  <div className="num gold-text" style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 600, lineHeight: 1 }}>{mxn(saldo)}</div>
                </div>
                <button
                  className="btn gold"
                  disabled={!cart.length || confirming}
                  style={{ opacity: cart.length && !confirming ? 1 : .4, pointerEvents: cart.length && !confirming ? 'auto' : 'none', padding: '12px 22px' }}
                  onClick={confirmar}
                >
                  <Ic n="check-circle" />{confirming ? 'Guardando…' : 'Cobrar venta'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

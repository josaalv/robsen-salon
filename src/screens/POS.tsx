import React, { useState, useEffect, useRef } from 'react'
import { Avatar, Seg, toast, useModalKeys } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { useStore } from '../data/store'
import { mxn, mxn0, resolverComision, normalizarTel, formatTel } from '../lib/helpers'
import type { Venta, Cita, Producto } from '../types'

// Sonido de confirmación/error para el escáner. Usa Web Audio (sin archivos):
// un bip agudo corto para éxito, uno grave doble para error. El AudioContext se
// crea/reactiva dentro del gesto de teclado del escáner (política de autoplay).
let _audio: AudioContext | null = null
const beep = (freq: number, durMs: number, delayMs = 0) => {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    _audio = _audio || new AC()
    if (_audio.state === 'suspended') _audio.resume()
    const t0 = _audio.currentTime + delayMs / 1000
    const osc = _audio.createOscillator()
    const gain = _audio.createGain()
    osc.type = 'square'
    osc.frequency.value = freq
    osc.connect(gain); gain.connect(_audio.destination)
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000)
    osc.start(t0); osc.stop(t0 + durMs / 1000)
  } catch { /* audio no disponible: el escáner sigue funcionando sin sonido */ }
}
const beepOk = () => beep(1050, 110)
const beepError = () => { beep(300, 140); beep(240, 160, 150) }

interface CartItem {
  key: string
  tipo: 'servicio' | 'producto' | 'adicional'
  nombre: string
  precio: number
  sub: string
  stock?: number
  com: number         // comisión en %
  comMonto?: number   // comisión fija por unidad (si está, ignora com)
  prof?: string[]
  cant: number
  est: string | null
}

// Comisión resuelta → campos de la línea (com % / comMonto fijo).
const comLinea = (servicioId: string, est: string | null, estilistas: Parameters<typeof resolverComision>[2]) => {
  const r = resolverComision(servicioId, est, estilistas)
  return r.tipo === 'monto' ? { com: 0, comMonto: r.monto } : { com: r.pct, comMonto: undefined }
}

export function POSBuilder({ onClose, onConfirm, nextTicket, citaOrigen }: {
  onClose: () => void
  onConfirm: (v: Venta) => Promise<void>
  nextTicket?: string
  citaOrigen?: Cita
}) {
  const { data } = useStore()
  const DRAFT_KEY = 'rb_pos_draft'

  const [tab, setTab] = useState('Servicios')
  const [q, setQ] = useState('')
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (citaOrigen) {
      // Una cita puede tener varios servicios (maquillaje + peinado): se
      // precarga una línea por servicio para que la venta quede desglosada.
      const servicios = citaOrigen.servicios && citaOrigen.servicios.length
        ? citaOrigen.servicios
        : [{ servicioId: citaOrigen.servicioId || ('cita-' + citaOrigen.id), nombre: citaOrigen.srv, precio: citaOrigen.total, dur: citaOrigen.dur, est: citaOrigen.est }]
      return servicios.map((s, i) => {
        // Cada servicio puede haber sido con distinto empleado — se respeta para
        // la comisión y el desglose de la venta.
        const est = s.est || citaOrigen.est
        return {
          key: (s.servicioId || 'cita') + '-' + i,
          tipo: 'servicio' as const,
          nombre: s.nombre,
          precio: s.precio,
          sub: `${s.dur} min`,
          ...comLinea(s.servicioId, est, data.estilistas),
          cant: 1,
          est,
        }
      })
    }
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY + '_cart') || '[]') } catch { return [] }
  })
  const [cliente, setCliente] = useState(() => citaOrigen ? citaOrigen.cl : (localStorage.getItem(DRAFT_KEY + '_cliente') || ''))
  const [clienteQ, setClienteQ] = useState('')
  const [clienteOpen, setClienteOpen] = useState(false)
  const [desc, setDesc] = useState(() => citaOrigen ? 0 : Number(localStorage.getItem(DRAFT_KEY + '_desc') || '0'))
  const [descModo, setDescModo] = useState<'monto' | 'pct'>('monto')   // descuento como $ fijo o %
  const [anticipo, setAnticipo] = useState(() => citaOrigen ? (citaOrigen.ant || 0) : Number(localStorage.getItem(DRAFT_KEY + '_anticipo') || '0'))

  useEffect(() => {
    // Una venta que parte de una cita no comparte el borrador genérico del POS,
    // para no pisar una venta de mostrador que ya esté en curso en Ventas.
    if (citaOrigen) return
    localStorage.setItem(DRAFT_KEY + '_cart', JSON.stringify(cart))
    localStorage.setItem(DRAFT_KEY + '_cliente', cliente)
    localStorage.setItem(DRAFT_KEY + '_desc', String(desc))
    localStorage.setItem(DRAFT_KEY + '_anticipo', String(anticipo))
  }, [cart, cliente, desc, anticipo, citaOrigen])

  const clearDraft = () => {
    if (citaOrigen) return
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
  const [recibido, setRecibido] = useState('')   // efectivo recibido (para el cambio)
  const [mixto, setMixto] = useState(false)      // dividir el cobro en varios métodos
  const [split, setSplit] = useState<{ metodo: string; monto: number }[]>([])

  // Construye el ítem de carrito para un producto (mismo shape para el catálogo
  // y para el escáner de código de barras).
  const productoItem = (p: Producto): CartItem => ({
    tipo: 'producto',
    key: p.id,
    nombre: p.nombre,
    precio: p.precio,
    sub: p.marca + ' · ' + p.stock + ' en stock',
    stock: p.stock,
    // Comisión propia del producto (monto fijo o %) o, si no tiene, la global.
    ...(p.comValor != null
      ? (p.comTipo === 'monto'
          ? { com: 0, comMonto: p.comValor }
          : { com: p.comValor, comMonto: undefined })
      : { com: comisiones['_producto'] ?? 10, comMonto: undefined }),
    cant: 1,
    est: null,
  })

  const catalogo: Record<string, CartItem[]> = {
    Servicios: data.servicios.filter(s => s.activo !== false).map(s => ({
      tipo: 'servicio' as const,
      key: s.id,
      nombre: s.nombre,
      precio: s.precio,
      sub: s.cat + ' · ' + s.dur + ' min',
      prof: s.prof,
      com: 0, // se resuelve en addItem/setLineEst según la estilista asignada
      cant: 1,
      est: null,
    })),
    Productos: data.productos.filter(p => p.uso === 'retail').map(productoItem),
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
      const com = it.tipo === 'servicio'
        ? comLinea(it.key, defEst, data.estilistas)
        : { com: it.com, comMonto: it.comMonto }
      return [...c, { ...it, cant: 1, est: defEst, ...com }]
    })
  }

  // ── Escáner de código de barras ──────────────────────────────────────────
  // Los escáneres USB/Bluetooth funcionan como un teclado: "teclean" el código
  // muy rápido y cierran con Enter. Detectamos esa ráfaga (teclas a < 80 ms) y,
  // al llegar el Enter, buscamos el producto por su SKU y lo agregamos al
  // carrito, con un bip de confirmación o de error.
  const scanBuf = useRef('')
  const scanLast = useRef(0)
  const scanHandler = useRef<(e: KeyboardEvent) => void>(() => {})
  scanHandler.current = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      const code = scanBuf.current.trim()
      scanBuf.current = ''
      if (code.length < 6) return   // demasiado corto: no es un código de barras
      e.preventDefault()
      setQ('')
      const norm = (s: string) => (s || '').trim()
      const p = data.productos.find(x => norm(x.sku) === code)
        || data.productos.find(x => norm(x.sku).toLowerCase() === code.toLowerCase())
      if (p && p.uso === 'retail') { addItem(productoItem(p)); beepOk(); toast(`✓ ${p.nombre}`) }
      else if (p) { beepError(); toast(`${p.nombre} es de uso interno, no se vende`) }
      else { beepError(); toast(`Código no reconocido: ${code}`) }
      return
    }
    if (e.key.length === 1) {
      const now = performance.now()
      if (now - scanLast.current > 80) scanBuf.current = ''  // pausa larga = tecleo humano: reinicia
      scanBuf.current += e.key
      scanLast.current = now
    }
  }
  useEffect(() => {
    const on = (e: KeyboardEvent) => scanHandler.current(e)
    document.addEventListener('keydown', on)
    return () => document.removeEventListener('keydown', on)
  }, [])

  const [customNombre, setCustomNombre] = useState('')
  const [customPrecio, setCustomPrecio] = useState('')
  const addCustomCharge = () => {
    const nombre = customNombre.trim()
    const precio = Number(customPrecio)
    if (!nombre || !precio || precio <= 0) return
    setCart(c => [...c, {
      key: 'custom-' + Date.now(),
      tipo: 'adicional',
      nombre,
      precio,
      sub: 'Cobro personalizado',
      com: 0,
      cant: 1,
      est: null,
    }])
    setCustomNombre('')
    setCustomPrecio('')
  }

  const setCant = (key: string, d: number) => setCart(c => c.map(l => l.key === key ? { ...l, cant: Math.max(1, l.cant + d) } : l))
  // Precio unitario editable por línea (p. ej. un servicio que cambió de precio).
  // La venta sigue registrándose con el mismo servicio, solo con el precio nuevo;
  // los totales y la comisión por % se recalculan solos a partir de este precio.
  const setLinePrecio = (key: string, precio: number) => setCart(c => c.map(l => l.key === key ? { ...l, precio: Math.max(0, precio) } : l))
  const del = (key: string) => setCart(c => c.filter(l => l.key !== key))

  // Buscador de clientas por nombre o teléfono.
  const clienteResultados = (() => {
    const term = clienteQ.trim().toLowerCase()
    const dig = normalizarTel(clienteQ)
    const base = !term
      ? data.clientas
      : data.clientas.filter(c =>
          c.nombre.toLowerCase().includes(term) ||
          (dig.length >= 3 && normalizarTel(c.tel).includes(dig)))
    return base.slice(0, 8)
  })()
  const setLineEst = (key: string, est: string | null) => setCart(c => c.map(l => {
    if (l.key !== key) return l
    if (l.tipo !== 'servicio') return { ...l, est }
    return { ...l, est, ...comLinea(l.key, est, data.estilistas) }
  }))

  const subtotal = cart.reduce((s, l) => s + l.precio * l.cant, 0)
  // Descuento resuelto a monto: si es %, se calcula sobre el subtotal.
  const descMonto = descModo === 'pct' ? Math.round(subtotal * Math.min(100, desc || 0) / 100) : (desc || 0)
  const total = Math.max(0, subtotal - descMonto)
  const saldo = Math.max(0, total - anticipo)
  const cambio = (Number(recibido) || 0) - saldo   // + a favor del cliente, − falta
  const splitAsignado = split.reduce((s, p) => s + (p.monto || 0), 0)
  const splitFalta = saldo - splitAsignado
  const usarMixto = mixto && split.filter(p => p.monto > 0).length >= 2
  const comision = cart.reduce((s, l) => s + (
    l.comMonto != null ? Math.round(l.comMonto * l.cant) : Math.round(l.precio * l.cant * (l.com || 0) / 100)
  ), 0)

  const [confirming, setConfirming] = useState(false)
  const confirmar = async () => {
    if (!cart.length || confirming) return
    if (usarMixto && Math.abs(splitAsignado - saldo) >= 1) {
      toast(`El desglose no cuadra con el total (${mxn(saldo)}).`); return
    }
    const venta: Venta = {
      id: 'v' + Date.now(),
      ticket,
      fecha: new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) + ' · ' + new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      cliente: cliente || 'Venta de mostrador',
      clienteId: data.clientas.find(c => c.nombre === cliente)?.id || '',
      pago: usarMixto ? 'Mixto' : pago,
      pagos: usarMixto ? split.filter(p => p.monto > 0) : undefined,
      estado: anticipo > 0 && anticipo < total ? 'parcial' : 'pagada',
      desc: descMonto,
      anticipo,
      lineas: cart.map(l => ({
        tipo: l.tipo,
        nombre: l.nombre,
        productoId: l.tipo === 'producto' ? l.key : undefined,
        est: l.est,
        cant: l.cant,
        precio: l.precio,
        com: l.com,
        comMonto: l.comMonto,
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

  const posRef = useRef<HTMLDivElement>(null)
  useModalKeys(posRef, onClose)   // Esc cierra + foco atrapado (sin Enter: el cobro es explícito)

  return (
    <div className="rb-modal-bg" onClick={onClose}>
      <div
        ref={posRef}
        className="card gold-edge rb-modal"
        onClick={e => e.stopPropagation()}
        style={{ width: 980, maxWidth: '96vw', height: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div className="card-head" style={{ flex: '0 0 auto' }}>
          <div>
            <div className="eyebrow">Punto de venta · Ticket {ticket}</div>
            <h3 style={{ marginTop: 6 }}>Nueva venta</h3>
          </div>
          <div className="vc gap12">
            <span className="vc gap6" title="Lee un producto con el escáner para agregarlo automáticamente"
              style={{ fontSize: 11.5, color: 'var(--st-conf)', border: '1px solid rgba(147,181,140,0.3)', background: 'rgba(147,181,140,0.1)', borderRadius: 20, padding: '4px 10px' }}>
              <Ic n="barcode" size={14} />Escáner activo
            </span>
            <button className="icon-btn" onClick={onClose}><Ic n="x" /></button>
          </div>
        </div>

        <div className="pos-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', flex: 1, minHeight: 0 }}>
          {/* Catálogo */}
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, borderRight: '1px solid var(--line-soft)' }}>
            <div style={{ padding: '14px 22px 0' }}>
              <div className="vc gap12" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
                <Seg opts={['Servicios', 'Productos', 'Adicionales']} value={tab} onChange={setTab} />
                {/* min-width para que el buscador baje a su propia línea a ancho
                    completo cuando no cabe junto a las pestañas, en vez de
                    aplastarse hasta desaparecer en pantallas chicas. */}
                <div className="search f1" style={{ minWidth: 'min(220px, 100%)' }}>
                  <Ic n="magnifying-glass" />
                  <input placeholder={'Buscar en ' + tab.toLowerCase() + '…'} value={q} onChange={e => setQ(e.target.value)} />
                  {q && <button className="icon-btn" onClick={() => setQ('')} title="Limpiar" style={{ width: 22, height: 22, flex: '0 0 auto' }}><Ic n="x" size={12} /></button>}
                </div>
              </div>
            </div>
            <div className="scroll-y" style={{ flex: 1, padding: '4px 22px 18px' }}>
              {tab === 'Adicionales' && (
                <div className="card" style={{ background: 'var(--surface)', padding: 12, marginBottom: 12 }}>
                  <div className="eyebrow" style={{ marginBottom: 8 }}>Cobro personalizado</div>
                  <div className="vc gap8">
                    <input
                      className="input f1" placeholder="Concepto, ej. Servicio a domicilio"
                      value={customNombre} onChange={e => setCustomNombre(e.target.value)}
                    />
                    <input
                      className="input" type="number" min="0" placeholder="$"
                      style={{ width: 100 }}
                      value={customPrecio} onFocus={e => e.currentTarget.select()} onChange={e => setCustomPrecio(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addCustomCharge()}
                    />
                    <button className="btn gold" disabled={!customNombre.trim() || !Number(customPrecio)} onClick={addCustomCharge}>
                      <Ic n="plus" />Agregar
                    </button>
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                    Para cobros fuera de catálogo por la naturaleza del servicio (ej. traslado, material extra).
                  </div>
                </div>
              )}
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
              <div className="field" style={{ position: 'relative' }}>
                <label>Clienta</label>
                <div className="vc gap6">
                  <input
                    className="input f1"
                    style={{ minWidth: 0 }}
                    value={clienteOpen ? clienteQ : (cliente || '')}
                    placeholder="Buscar por nombre o teléfono…"
                    onFocus={() => { setClienteOpen(true); setClienteQ('') }}
                    onChange={e => { setClienteQ(e.target.value); setClienteOpen(true) }}
                  />
                  {cliente && !clienteOpen && (
                    <button className="btn icon ghost sm" title="Quitar clienta"
                      onClick={() => { setCliente(''); setClienteQ('') }}><Ic n="x" /></button>
                  )}
                </div>
                {clienteOpen && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setClienteOpen(false)} />
                    <div className="card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 41, marginTop: 4, maxHeight: 260, overflowY: 'auto', padding: 4, boxShadow: 'var(--sh-lg)' }}>
                      <div className="nav-item" onClick={() => { setCliente(''); setClienteQ(''); setClienteOpen(false) }}>
                        <Ic n="storefront" />Venta de mostrador
                      </div>
                      {clienteResultados.map(c => (
                        <div key={c.id} className="nav-item" style={{ justifyContent: 'space-between', gap: 10 }}
                          onClick={() => { setCliente(c.nombre); setClienteQ(''); setClienteOpen(false) }}>
                          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</span>
                          <span className="dim num" style={{ fontSize: 11, flex: '0 0 auto' }}>{c.tel ? formatTel(c.tel) : '—'}</span>
                        </div>
                      ))}
                      {clienteResultados.length === 0 && (
                        <div className="dim" style={{ padding: '10px 12px', fontSize: 12 }}>Sin coincidencias.</div>
                      )}
                    </div>
                  </>
                )}
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span className="dim" style={{ fontSize: 12 }}>$</span>
                          <input
                            className="input num"
                            type="number"
                            min="0"
                            value={l.precio}
                            onFocus={e => e.currentTarget.select()}
                            onChange={e => setLinePrecio(l.key, +e.target.value || 0)}
                            title="Precio unitario — editable si el servicio cambió de precio"
                            style={{ width: 88, padding: '4px 8px', fontSize: 12.5 }}
                          />
                          <span className="dim" style={{ fontSize: 11 }}>c/u</span>
                        </div>
                        {(l.comMonto != null || l.com) ? (
                          <span className="dim" style={{ fontSize: 10.5 }}>· {l.comMonto != null ? `com. ${mxn(l.comMonto)}` : `com. ${l.com}%`}</span>
                        ) : null}
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
                      style={{ padding: '6px 28px 6px 10px', fontSize: 12, width: 'auto', flex: 1, minWidth: 0 }}
                    >
                      <option value="">{l.tipo === 'producto' ? 'Vendido por…' : 'Sin asignar'}</option>
                      {data.estilistas.map(es => <option key={es.id} value={es.id}>{es.nombre}</option>)}
                    </select>
                    <div className="vc gap6" style={{ flex: '0 0 auto' }}>
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
                <div className="field f1" style={{ minWidth: 0 }}>
                  <label style={{ fontSize: 11 }}>Descuento{descModo === 'pct' && descMonto > 0 ? ` (−${mxn(descMonto)})` : ''}</label>
                  <div className="vc gap6">
                    <input className="input num f1" type="number" min="0" value={desc || ''} placeholder="0" onFocus={e => e.currentTarget.select()} onChange={e => setDesc(+e.target.value || 0)} style={{ padding: '8px 10px', minWidth: 0 }} />
                    <button type="button" className="btn ghost sm" title="Alternar monto / porcentaje" style={{ flex: '0 0 auto', minWidth: 34, fontWeight: 700 }}
                      onClick={() => { setDescModo(m => m === 'monto' ? 'pct' : 'monto'); setDesc(0) }}>
                      {descModo === 'monto' ? '$' : '%'}
                    </button>
                  </div>
                </div>
                <div className="field f1" style={{ minWidth: 0 }}>
                  <label style={{ fontSize: 11 }}>Anticipo</label>
                  <input className="input num" type="number" value={anticipo || ''} placeholder="0" onFocus={e => e.currentTarget.select()} onChange={e => setAnticipo(+e.target.value || 0)} style={{ padding: '8px 10px' }} />
                </div>
                <div className="field f1" style={{ minWidth: 0 }}>
                  <label style={{ fontSize: 11 }}>Pago</label>
                  <select className="select" value={pago} onChange={e => setPago(e.target.value)} style={{ padding: '8px 28px 8px 10px', minWidth: 0 }}>
                    {pagoOpts.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <button type="button" className="btn ghost sm" onClick={() => {
                  const on = !mixto
                  setMixto(on)
                  if (on && split.length === 0) setSplit([{ metodo: pagoOpts[0] || 'Efectivo', monto: 0 }, { metodo: pagoOpts[1] || pagoOpts[0] || 'Tarjeta', monto: 0 }])
                }}>
                  <Ic n={mixto ? 'check-square' : 'square'} />Dividir pago (mixto)
                </button>
              </div>
              {mixto && (
                <div className="card" style={{ padding: 10, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--surface)' }}>
                  {split.map((p, i) => (
                    <div key={i} className="vc gap6">
                      <select className="select f1" value={p.metodo} onChange={e => setSplit(s => s.map((x, j) => j === i ? { ...x, metodo: e.target.value } : x))} style={{ padding: '6px 24px 6px 10px', fontSize: 12, minWidth: 0 }}>
                        {pagoOpts.map(m => <option key={m}>{m}</option>)}
                      </select>
                      <input className="input num" type="number" min="0" value={p.monto || ''} placeholder="0" onFocus={e => e.currentTarget.select()}
                        onChange={e => setSplit(s => s.map((x, j) => j === i ? { ...x, monto: +e.target.value || 0 } : x))} style={{ width: 96, padding: '6px 8px' }} />
                      {split.length > 2 && <button className="btn icon ghost sm" title="Quitar" onClick={() => setSplit(s => s.filter((_, j) => j !== i))}><Ic n="x" size={12} /></button>}
                    </div>
                  ))}
                  <div className="between" style={{ fontSize: 11.5 }}>
                    <button className="btn ghost sm" onClick={() => setSplit(s => [...s, { metodo: pagoOpts[0] || 'Efectivo', monto: 0 }])}><Ic n="plus" size={12} />Método</button>
                    <span style={{ color: Math.abs(splitFalta) < 1 ? 'var(--st-conf)' : 'var(--st-canc)', fontWeight: 600 }}>
                      {Math.abs(splitFalta) < 1 ? 'Completo ✓' : splitFalta > 0 ? `Falta ${mxn(splitFalta)}` : `Sobra ${mxn(-splitFalta)}`}
                    </span>
                  </div>
                </div>
              )}
              {!mixto && pago === 'Efectivo' && (
                <div className="vc gap10" style={{ marginBottom: 10 }}>
                  <div className="field f1" style={{ minWidth: 0 }}>
                    <label style={{ fontSize: 11 }}>Efectivo recibido</label>
                    <input className="input num" type="number" min="0" value={recibido} placeholder={mxn0(saldo)}
                      onFocus={e => e.currentTarget.select()} onChange={e => setRecibido(e.target.value)} style={{ padding: '8px 10px' }} />
                  </div>
                  <div className="field f1" style={{ minWidth: 0 }}>
                    <label style={{ fontSize: 11 }}>Cambio</label>
                    <div className="input num" style={{ padding: '8px 10px', fontWeight: 700, color: recibido === '' ? 'var(--text-3)' : (cambio >= 0 ? 'var(--st-conf)' : 'var(--st-canc)'), display: 'flex', alignItems: 'center' }}>
                      {recibido === '' ? '—' : (cambio >= 0 ? mxn(cambio) : `Faltan ${mxn(-cambio)}`)}
                    </div>
                  </div>
                </div>
              )}
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

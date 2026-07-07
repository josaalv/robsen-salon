import React, { useState, useEffect } from 'react'
import { Stat, Avatar, toast, Modal, ConfirmModal } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { useStore } from '../data/store'
import { useAuth } from '../lib/auth'
import { db } from '../lib/db'
import { mxn, ventaCalc } from '../lib/helpers'
import { POSBuilder } from './POS'
import type { Venta, CierreCaja } from '../types'

function waLink(tel: string, msg: string): string {
  const digits = tel.replace(/\D/g, '')
  const num = digits.startsWith('52') ? digits : '52' + digits
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
}

function VentaDetalle({ v, onClose }: { v: Venta; onClose: () => void }) {
  const { data, updateVenta } = useStore()
  const iva = data.config?.iva || 0
  const subtotal = ventaCalc.subtotal(v)
  const totalV = ventaCalc.total(v)
  const baseImponible = totalV / (1 + iva / 100)
  const ivaAmount = totalV - baseImponible
  const saldo = ventaCalc.saldo(v)
  const comision = ventaCalc.comision(v)
  const pagoOpts = Object.entries(data.config?.metodospago || {})
    .filter(([, v]) => v).map(([k]) => k.charAt(0).toUpperCase() + k.slice(1))
  const [pagoSaldo, setPagoSaldo] = useState(pagoOpts[0] || 'Efectivo')
  const clientaTel = (v.clienteId
    ? data.clientas.find(c => c.id === v.clienteId)?.tel
    : data.clientas.find(c => c.nombre === v.cliente)?.tel) || ''

  const cobrarSaldo = async () => {
    const montoCobrado = ventaCalc.saldo(v)
    try {
      await updateVenta(v.id, {
        estado: 'pagada', anticipo: ventaCalc.total(v), pago: pagoSaldo,
        saldoCobradoEn: new Date().toISOString(), saldoCobradoMonto: montoCobrado,
      })
      toast('Saldo cobrado · venta marcada como pagada')
      onClose()
    } catch {
      toast('No se pudo cobrar el saldo. Intenta de nuevo.')
    }
  }

  const imprimirTicket = () => {
    const lineas = v.lineas.map(l => `  ${l.cant > 1 ? l.cant + 'x ' : ''}${l.nombre.padEnd(28)} ${mxn(l.precio * l.cant)}`).join('\n')
    const html = `<html><head><meta charset="utf-8"><style>
      body{font-family:monospace;font-size:13px;margin:0;padding:20px;max-width:320px}
      h2{text-align:center;font-size:16px;margin:0 0 4px}
      .c{text-align:center}.hr{border-top:1px dashed #000;margin:10px 0}
      .r{display:flex;justify-content:space-between}
    </style></head><body>
      <h2>${data.config?.nombre || 'Robsen Salón & Spa'}</h2>
      <div class="c" style="font-size:11px;margin-bottom:12px">${data.config?.direccion || 'Guadalajara'}</div>
      <div class="hr"></div>
      <div class="r"><span>${v.ticket}</span><span>${v.fecha}</span></div>
      <div style="margin:4px 0 2px;font-weight:bold">${v.cliente}</div>
      <div class="hr"></div>
      <pre style="margin:0">${lineas}</pre>
      <div class="hr"></div>
      ${v.desc > 0 ? `<div class="r"><span>Descuento</span><span>-${mxn(v.desc)}</span></div>` : ''}
      ${v.anticipo > 0 ? `<div class="r"><span>Anticipo</span><span>-${mxn(v.anticipo)}</span></div>` : ''}
      <div class="r" style="font-weight:bold;font-size:15px;margin-top:6px"><span>TOTAL</span><span>${mxn(ventaCalc.total(v))}</span></div>
      <div class="r" style="margin-top:4px;font-size:11px"><span>Pago: ${v.pago}</span><span>${v.estado === 'parcial' ? 'Saldo: ' + mxn(ventaCalc.saldo(v)) : 'Pagado'}</span></div>
      <div class="hr"></div>
      <div class="c" style="font-size:11px">¡Gracias por tu visita! 💛</div>
    </body></html>`
    const win = window.open('', '_blank', 'width=360,height=600')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.onload = () => { win.print(); win.close() }
  }

  const tipoBadge: Record<string, [string, string]> = {
    servicio: ['scissors', 'pay'],
    producto: ['package', 'done'],
    adicional: ['plus', 'neutral'],
  }

  return (
    <div className="rb-modal-bg" onClick={onClose}>
      <div className="card gold-edge rb-modal" onClick={e => e.stopPropagation()} style={{ width: 560, maxWidth: '94vw' }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">Ticket {v.ticket} · {v.fecha}</div>
            <h3 style={{ marginTop: 6 }}>{v.cliente}</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><Ic n="x" /></button>
        </div>
        <div className="card-pad scroll-y" style={{ paddingTop: 14, maxHeight: '55vh' }}>
          {v.lineas.map((l, i) => {
            const [ic, bc] = tipoBadge[l.tipo] || ['question', 'neutral']
            const estilista = l.est ? data.estilistas.find(e => e.id === l.est) : null
            return (
              <div key={i} className="list-item" style={{ padding: '13px 0' }}>
                <div className="ico" style={{ width: 36, height: 36, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', border: '1px solid var(--line-soft)', color: 'var(--gold)', flex: '0 0 36px' }}>
                  <Ic n={ic} />
                </div>
                <div className="f1" style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{l.cant > 1 ? l.cant + '× ' : ''}{l.nombre}</div>
                  <div className="vc gap8" style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>
                    <span className={'badge ' + bc} style={{ fontSize: 10, padding: '2px 7px' }}>{l.tipo}</span>
                    {estilista && (
                      <span className="vc gap4">
                        <Avatar ini={estilista.ini} color={estilista.color} size="sm" />
                        {estilista.nombre.split(' ')[0]}
                      </span>
                    )}
                    {l.com ? <span>com. {l.com}%</span> : null}
                  </div>
                </div>
                <div className="num" style={{ fontWeight: 600 }}>{mxn(l.precio * l.cant)}</div>
              </div>
            )
          })}
        </div>
        <hr className="hr" />
        <div className="card-pad">
          <div className="between" style={{ fontSize: 13, marginBottom: 8 }}>
            <span className="muted">Subtotal</span><span className="num">{mxn(subtotal)}</span>
          </div>
          {v.desc > 0 && (
            <div className="between" style={{ fontSize: 13, marginBottom: 8 }}>
              <span className="muted">Descuento</span>
              <span className="num" style={{ color: 'var(--st-canc)' }}>−{mxn(v.desc)}</span>
            </div>
          )}
          {v.anticipo > 0 && (
            <div className="between" style={{ fontSize: 13, marginBottom: 8 }}>
              <span className="muted">Anticipo aplicado</span>
              <span className="num" style={{ color: 'var(--st-conf)' }}>−{mxn(v.anticipo)}</span>
            </div>
          )}
          {iva > 0 && (
            <>
              <div className="between" style={{ fontSize: 12, marginBottom: 6, color: 'var(--text-3)' }}>
                <span>Base gravable</span><span className="num">{mxn(Math.round(baseImponible))}</span>
              </div>
              <div className="between" style={{ fontSize: 12, marginBottom: 8, color: 'var(--text-3)' }}>
                <span>IVA ({iva}%) incluido</span><span className="num">{mxn(Math.round(ivaAmount))}</span>
              </div>
            </>
          )}
          <div className="between" style={{ marginBottom: 14 }}>
            <span style={{ fontWeight: 700, fontFamily: 'var(--serif)', fontSize: 16 }}>
              {v.estado === 'parcial' ? 'Saldo por cobrar' : 'Total pagado'}
            </span>
            <span className="num gold-text" style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600 }}>
              {mxn(v.estado === 'parcial' ? saldo : totalV)}
            </span>
          </div>

          {v.estado === 'parcial' && (
            <div className="card" style={{ background: 'rgba(200,161,74,0.06)', border: '1px solid var(--line)', padding: 14, marginBottom: 14 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Cobrar saldo pendiente · {mxn(saldo)}</div>
              <div className="vc gap8">
                <select className="select f1" value={pagoSaldo} onChange={e => setPagoSaldo(e.target.value)} style={{ padding: '8px 28px 8px 10px' }}>
                  {pagoOpts.map(m => <option key={m}>{m}</option>)}
                </select>
                <button className="btn gold" onClick={cobrarSaldo}><Ic n="check-circle" />Cobrar</button>
              </div>
            </div>
          )}

          <div className="card" style={{ background: 'var(--surface)', padding: 14, marginBottom: 14 }}>
            <div className="between" style={{ fontSize: 12.5 }}>
              <span className="muted vc gap8"><Ic n="users-three" />Comisión total del equipo</span>
              <span className="num" style={{ fontWeight: 600, color: '#B08AC7' }}>{mxn(comision)}</span>
            </div>
          </div>
          <div className="vc gap8">
            <button className="btn gold f1" style={{ justifyContent: 'center' }} onClick={imprimirTicket}><Ic n="printer" />Imprimir ticket</button>
            {clientaTel
              ? <a className="btn ghost" href={waLink(clientaTel, `Hola ${v.cliente.split(' ')[0]} 💛 Tu ticket ${v.ticket} por ${mxn(ventaCalc.total(v))} quedó registrado. ¡Gracias!`)} target="_blank" rel="noreferrer"><Ic n="whatsapp-logo" />Enviar</a>
              : <button className="btn ghost" style={{ opacity: .4 }} disabled><Ic n="whatsapp-logo" />Sin tel</button>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Corte de caja ────────────────────────────────────────────────────────────
const esMismaFecha = (iso: string | undefined, ref: Date) => {
  if (!iso) return false
  const d = new Date(iso)
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate()
}

function CierreCajaModal({ onClose, ventas, pendientes, usuarioNombre, usuarioId, todayStr }: {
  onClose: () => void
  ventas: Venta[]
  pendientes: Venta[]
  usuarioNombre: string
  usuarioId?: string
  todayStr: string
}) {
  const [efectivoContado, setEfectivoContado] = useState('')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [historial, setHistorial] = useState<CierreCaja[]>([])
  const [cargandoHist, setCargandoHist] = useState(true)

  useEffect(() => {
    db.getCierresCaja().then(setHistorial).finally(() => setCargandoHist(false))
  }, [])

  const hoy = new Date()
  const totalLinea = (l: { precio: number; cant: number }) => l.precio * l.cant
  const totalVenta = (v: Venta) => v.lineas.reduce((s, l) => s + totalLinea(l), 0) - (v.desc || 0)

  const creadasHoy = ventas.filter(v => v.fecha.startsWith(todayStr))
  // Saldos de citas/ventas creadas en otro día pero cobrados hoy — se cuentan aparte para no duplicar.
  const saldosHoy = ventas.filter(v => esMismaFecha(v.saldoCobradoEn, hoy) && !v.fecha.startsWith(todayStr))

  const montoRecibidoAlCrear = (v: Venta) => {
    if (v.estado === 'pagada') return totalVenta(v)
    if (v.estado === 'parcial' || v.estado === 'apartado') return v.anticipo || 0
    return 0
  }

  const porMetodo: Record<string, number> = { efectivo: 0, transferencia: 0, tarjeta: 0 }
  const sumar = (metodo: string, monto: number) => {
    const key = (metodo || '').toLowerCase()
    if (key in porMetodo) porMetodo[key] += monto
    else porMetodo[key] = (porMetodo[key] || 0) + monto
  }
  creadasHoy.forEach(v => sumar(v.pago, montoRecibidoAlCrear(v)))
  saldosHoy.forEach(v => sumar(v.pago, v.saldoCobradoMonto || 0))

  const totalEfectivo = porMetodo.efectivo
  const totalTransferencia = porMetodo.transferencia
  const totalTarjeta = porMetodo.tarjeta
  const otrosMetodos = Object.entries(porMetodo).filter(([k]) => !['efectivo', 'transferencia', 'tarjeta'].includes(k))

  const anticiposCobrados = creadasHoy
    .filter(v => v.estado === 'parcial' || v.estado === 'apartado')
    .reduce((s, v) => s + (v.anticipo || 0), 0)
  const saldosCobrados = saldosHoy.reduce((s, v) => s + (v.saldoCobradoMonto || 0), 0)
  const totalPendiente = pendientes.reduce((s, v) => s + Math.max(0, totalVenta(v) - (v.anticipo || 0)), 0)
  const ventasTotal = creadasHoy.reduce((s, v) => s + totalVenta(v), 0)
  const totalRecibidoHoy = totalEfectivo + totalTransferencia + totalTarjeta + otrosMetodos.reduce((s, [, v]) => s + v, 0)

  const efectivoNum = parseFloat(efectivoContado.replace(',', '.')) || 0
  const diferencia = efectivoContado.trim() ? efectivoNum - totalEfectivo : 0

  const guardar = async () => {
    setGuardando(true)
    try {
      await db.addCierreCaja({
        fecha: `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`,
        usuarioId, usuarioNombre,
        totalEfectivo, totalTransferencia, totalTarjeta, totalPendiente,
        anticiposCobrados, saldosCobrados, ventasTotal,
        efectivoContado: efectivoNum, diferencia,
        notas: notas.trim() || undefined,
      })
      toast('Caja cerrada correctamente')
      onClose()
    } catch {
      toast('No se pudo guardar el cierre. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  const Fila = ({ label, val, strong }: { label: string; val: string; strong?: boolean }) => (
    <div className="between" style={{ fontSize: 13, padding: '7px 0' }}>
      <span className="muted">{label}</span>
      <span className="num" style={{ fontWeight: strong ? 700 : 600 }}>{val}</span>
    </div>
  )

  return (
    <Modal onClose={onClose} width={620}>
      <div className="card-head">
        <div>
          <div className="eyebrow">Consolida las ventas del día, no las sustituye</div>
          <h3 style={{ marginTop: 4 }}>Cerrar caja de hoy</h3>
        </div>
        <button className="icon-btn" onClick={onClose}><Ic n="x" /></button>
      </div>
      <div className="card-pad scroll-y" style={{ maxHeight: '65vh' }}>
        <div className="card" style={{ background: 'var(--surface)', padding: 14, marginBottom: 16 }}>
          <Fila label="Ventas totales de hoy" val={mxn(ventasTotal)} strong />
          <hr className="hr" style={{ margin: '6px 0' }} />
          <Fila label="Efectivo" val={mxn(totalEfectivo)} />
          <Fila label="Transferencia" val={mxn(totalTransferencia)} />
          <Fila label="Tarjeta" val={mxn(totalTarjeta)} />
          {otrosMetodos.filter(([, v]) => v > 0).map(([k, v]) => (
            <Fila key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} val={mxn(v)} />
          ))}
          <hr className="hr" style={{ margin: '6px 0' }} />
          <Fila label="Anticipos recibidos hoy" val={mxn(anticiposCobrados)} />
          <Fila label="Saldos cobrados hoy (de citas de otros días)" val={mxn(saldosCobrados)} />
          <Fila label="Pendiente por cobrar (todo, a la fecha)" val={mxn(totalPendiente)} />
        </div>

        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 8 }}>
          <div className="field">
            <label>Efectivo contado en caja</label>
            <input className="input num" type="number" min="0" value={efectivoContado}
              onChange={e => setEfectivoContado(e.target.value)} placeholder={mxn(totalEfectivo)} />
          </div>
          <div className="field">
            <label>Diferencia</label>
            <div className="input" style={{ display: 'flex', alignItems: 'center', color: !efectivoContado.trim() ? 'var(--text-4)' : diferencia === 0 ? 'var(--st-conf)' : 'var(--st-canc)', fontWeight: 700 }}>
              {efectivoContado.trim() ? (diferencia > 0 ? '+' : '') + mxn(diferencia) : '—'}
            </div>
          </div>
        </div>
        <div className="field" style={{ marginBottom: 4 }}>
          <label>Notas (opcional)</label>
          <textarea className="input" rows={2} value={notas} onChange={e => setNotas(e.target.value)}
            placeholder="Ej. Faltaron $50, se dio cambio de más en el ticket #1042…" style={{ resize: 'vertical' }} />
        </div>

        <hr className="hr" style={{ margin: '18px 0 12px' }} />
        <div className="eyebrow" style={{ marginBottom: 10 }}>Historial de cierres</div>
        {cargandoHist ? (
          <div className="dim" style={{ fontSize: 12.5, padding: '8px 0' }}>Cargando…</div>
        ) : historial.length === 0 ? (
          <div className="dim" style={{ fontSize: 12.5, padding: '8px 0' }}>Sin cierres registrados todavía.</div>
        ) : (
          <table className="table" style={{ marginTop: 0 }}>
            <thead><tr><th>Fecha</th><th>Responsable</th><th className="num">Ventas</th><th className="num">Diferencia</th></tr></thead>
            <tbody>
              {historial.slice(0, 10).map(h => (
                <tr key={h.id} style={{ cursor: 'default' }}>
                  <td className="muted">{h.fecha}</td>
                  <td>{h.usuarioNombre}</td>
                  <td className="num">{mxn(h.ventasTotal)}</td>
                  <td className="num" style={{ color: h.diferencia === 0 ? 'var(--st-conf)' : 'var(--st-canc)', fontWeight: 600 }}>
                    {h.diferencia > 0 ? '+' : ''}{mxn(h.diferencia)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <hr className="hr" />
      <div className="card-pad vc gap12" style={{ justifyContent: 'flex-end' }}>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn gold" disabled={guardando} onClick={guardar}>
          <Ic n={guardando ? 'spinner' : 'check'} />{guardando ? 'Guardando…' : 'Cerrar caja'}
        </button>
      </div>
    </Modal>
  )
}

export function ScreenVentas({ onNavigate }: { onNavigate: (r: string) => void }) {
  const { data, addVenta, deleteVenta } = useStore()
  const { user } = useAuth()
  const ventas = data.ventas
  const [pos, setPos] = useState(false)
  const [detalle, setDetalle] = useState<Venta | null>(null)
  const [cierreCaja, setCierreCaja] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('Todas')
  const [filtroPeriodo, setFiltroPeriodo] = useState('Todo')
  const [q, setQ] = useState('')
  const [confirmDel, setConfirmDel] = useState<Venta | null>(null)
  const [deleting, setDeleting] = useState(false)
  // Borrar una venta es destructivo (revierte inventario y reportes): solo
  // administración.
  const puedeBorrar = !!user && ['admin', 'gerente'].includes(user.rol)

  const eliminarVenta = async () => {
    if (!confirmDel || deleting) return
    setDeleting(true)
    try {
      await deleteVenta(confirmDel.id)
      toast('Venta eliminada · inventario repuesto')
      setConfirmDel(null)
    } catch {
      toast('No se pudo eliminar la venta. Intenta de nuevo.')
    } finally {
      setDeleting(false)
    }
  }

  const totalLinea = (l: { precio: number; cant: number }) => l.precio * l.cant
  const subtotalV = (v: Venta) => v.lineas.reduce((s, l) => s + totalLinea(l), 0)
  const totalVenta = (v: Venta) => subtotalV(v) - (v.desc || 0)
  const saldo = (v: Venta) => Math.max(0, totalVenta(v) - (v.anticipo || 0))
  const comisionVenta = (v: Venta) => v.lineas.reduce((s, l) => s + Math.round(totalLinea(l) * (l.com || 0) / 100), 0)

  const todayStr = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
  const mesStr = new Date().toLocaleDateString('es-MX', { month: 'short' })
    .replace(/^./, c => c.toUpperCase())

  const hoyVentas = ventas.filter(v => v.fecha.startsWith(todayStr))
  const totalHoy = hoyVentas.reduce((s, v) => s + totalVenta(v), 0)
  const ticketProm = hoyVentas.length ? Math.round(totalHoy / hoyVentas.length) : 0
  const comisionesHoy = hoyVentas.reduce((s, v) => s + comisionVenta(v), 0)
  const pendientes = ventas.filter(v => v.estado === 'parcial' || v.estado === 'pendiente')

  const periodFilter = (v: Venta) => {
    if (filtroPeriodo === 'Hoy') return v.fecha.startsWith(todayStr)
    if (filtroPeriodo === 'Mes') return v.fecha.includes(mesStr)
    return true
  }

  const apartados = ventas.filter(v => v.estado === 'apartado')

  const lista = ventas.filter(v => {
    if (v.estado === 'apartado') return false
    if (!periodFilter(v)) return false
    if (q && !v.cliente.toLowerCase().includes(q.toLowerCase()) && !v.ticket.includes(q)) return false
    if (filtroTipo === 'Con producto') return v.lineas.some(l => l.tipo === 'producto')
    if (filtroTipo === 'Solo servicio') return v.lineas.every(l => l.tipo !== 'producto')
    if (filtroTipo === 'Con saldo') return saldo(v) > 0
    return true
  })

  const registrarVenta = async (venta: Venta) => {
    try {
      await addVenta(venta)
      setPos(false)
      toast('Venta registrada correctamente')
    } catch {
      toast('No se pudo registrar la venta. Verifica tu conexión e intenta de nuevo.')
      throw new Error('addVenta failed')
    }
  }

  const resumenItems = (v: Venta) => {
    const s = v.lineas.filter(l => l.tipo === 'servicio').length
    const p = v.lineas.filter(l => l.tipo === 'producto').length
    const a = v.lineas.filter(l => l.tipo === 'adicional').length
    return [s && `${s} servicio${s > 1 ? 's' : ''}`, p && `${p} producto${p > 1 ? 's' : ''}`, a && `${a} extra${a > 1 ? 's' : ''}`].filter(Boolean).join(' · ')
  }

  const nextTicket = '#' + (1000 + ventas.length + 1)

  return (
    <div>
      <div className="between" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="display" style={{ fontSize: 26, margin: 0 }}>Ventas</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Punto de venta · {ventas.length} tickets totales
            {pendientes.length > 0 && <> · <span style={{ color: 'var(--st-pend)' }}>{pendientes.length} con saldo pendiente</span></>}
          </div>
        </div>
        <div className="vc gap10">
          {user && ['admin', 'gerente', 'recepcion'].includes(user.rol) && (
            <button className="btn ghost" onClick={() => setCierreCaja(true)}><Ic n="lock-simple" />Cerrar caja del día</button>
          )}
          <button className="btn gold" onClick={() => setPos(true)}><Ic n="plus-circle" />Nueva venta</button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 18 }}>
        <Stat icon={<Ic n="cash-register" />} label="Ventas de hoy" value={mxn(totalHoy)} />
        <div className="card card-pad vc gap16">
          <div className="ico" style={{ width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(200,161,74,0.10)', border: '1px solid var(--line)', color: 'var(--gold)' }}>
            <Ic n="receipt" />
          </div>
          <div className="kpi-mini"><span className="l">Tickets de hoy</span><span className="v">{hoyVentas.length}</span></div>
        </div>
        <div className="card card-pad vc gap16">
          <div className="ico" style={{ width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(147,181,140,0.12)', border: '1px solid rgba(147,181,140,0.28)', color: 'var(--st-conf)' }}>
            <Ic n="chart-bar" />
          </div>
          <div className="kpi-mini"><span className="l">Ticket promedio hoy</span><span className="v">{mxn(ticketProm)}</span></div>
        </div>
        <div className="card card-pad vc gap16">
          <div className="ico" style={{ width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(176,138,199,0.12)', border: '1px solid rgba(176,138,199,0.28)', color: '#B08AC7' }}>
            <Ic n="users-three" />
          </div>
          <div className="kpi-mini"><span className="l">Comisiones hoy</span><span className="v">{mxn(comisionesHoy)}</span></div>
        </div>
      </div>

      <div className="card card-pad between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div className="search" style={{ width: 280 }}>
          <Ic n="magnifying-glass" />
          <input placeholder="Buscar por clienta o ticket…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="vc gap8" style={{ flexWrap: 'wrap' }}>
          <div className="vc gap6">
            {['Todo', 'Hoy', 'Mes'].map(f => (
              <button key={f} className="chip" style={filtroPeriodo === f ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : {}} onClick={() => setFiltroPeriodo(f)}>{f}</button>
            ))}
          </div>
          <div style={{ width: 1, height: 20, background: 'var(--line-soft)' }} />
          <div className="vc gap6">
            {['Todas', 'Con producto', 'Solo servicio', 'Con saldo'].map(f => (
              <button key={f} className="chip" style={filtroTipo === f ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : {}} onClick={() => setFiltroTipo(f)}>{f}</button>
            ))}
          </div>
        </div>
      </div>

      {apartados.length > 0 && (
        <div className="card" style={{ marginBottom: 16, border: '1px solid rgba(200,161,74,0.25)' }}>
          <div className="card-pad between" style={{ paddingBottom: 10, borderBottom: '1px solid var(--line-soft)' }}>
            <div className="vc gap8">
              <Ic n="calendar-check" style={{ color: 'var(--gold)' }} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Apartados de citas</span>
              <span className="badge pend">{apartados.length}</span>
            </div>
            <span className="muted" style={{ fontSize: 12 }}>Anticipos registrados desde Agenda · pendientes de cobro final</span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Ref.</th><th>Fecha</th><th>Clienta</th><th>Servicio</th>
                <th className="num">Total cita</th><th className="num">Anticipo</th><th className="num">Saldo</th><th></th>
              </tr>
            </thead>
            <tbody>
              {apartados.map(v => {
                const totalApt = totalVenta(v)
                const saldoApt = saldo(v)
                return (
                  <tr key={v.id} onClick={() => setDetalle(v)}>
                    <td className="num" style={{ fontWeight: 700, color: 'var(--gold)', fontSize: 12 }}>{v.ticket}</td>
                    <td className="muted">{v.fecha}</td>
                    <td style={{ fontWeight: 600 }}>{v.cliente}</td>
                    <td className="muted">{v.lineas[0]?.nombre || '—'}</td>
                    <td className="num">{mxn(totalApt)}</td>
                    <td className="num" style={{ color: 'var(--st-conf)', fontWeight: 600 }}>{mxn(v.anticipo)}</td>
                    <td className="num" style={{ color: 'var(--st-pend)', fontWeight: 600 }}>{mxn(saldoApt)}</td>
                    <td><Ic n="caret-right" /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Ticket</th><th>Fecha</th><th>Clienta</th><th>Detalle</th>
              <th>Atendió</th><th>Pago</th><th className="num">Total</th><th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody>
            {lista.map(v => {
              const ests = [...new Set(v.lineas.filter(l => l.est).map(l => l.est))]
                .map(id => data.estilistas.find(e => e.id === id)).filter(Boolean) as typeof data.estilistas
              return (
                <tr key={v.id} onClick={() => setDetalle(v)}>
                  <td className="num" style={{ fontWeight: 700, color: 'var(--gold)' }}>{v.ticket}</td>
                  <td className="muted">{v.fecha}</td>
                  <td style={{ fontWeight: 600 }}>{v.cliente}</td>
                  <td className="muted">{resumenItems(v)}</td>
                  <td>
                    <div className="vc" style={{ marginLeft: 2 }}>
                      {ests.map((e, i) => (
                        <div key={i} title={e.nombre} style={{ marginLeft: i ? -8 : 0 }}>
                          <Avatar ini={e.ini} color={e.color} size="sm" />
                        </div>
                      ))}
                      {!ests.length && <span className="dim">—</span>}
                    </div>
                  </td>
                  <td className="muted">{v.pago}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{mxn(totalVenta(v))}</td>
                  <td>
                    {v.estado === 'pagada'
                      ? <span className="badge conf"><span className="d" />Pagada</span>
                      : v.estado === 'parcial'
                      ? <span className="badge pend"><span className="d" />Saldo pendiente</span>
                      : v.estado === 'apartado'
                      ? <span className="badge gold"><span className="d" />Apartado</span>
                      : <span className="badge canc"><span className="d" />Pendiente</span>}
                  </td>
                  <td>
                    <div className="vc gap6" style={{ justifyContent: 'flex-end' }}>
                      {puedeBorrar && (
                        <button className="icon-btn" title="Eliminar venta" style={{ width: 30, height: 30, color: 'var(--st-canc)' }}
                          onClick={ev => { ev.stopPropagation(); setConfirmDel(v) }}>
                          <Ic n="trash" size={14} />
                        </button>
                      )}
                      <Ic n="caret-right" />
                    </div>
                  </td>
                </tr>
              )
            })}
            {lista.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--text-4)' }}>Sin ventas con ese filtro</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pos && <POSBuilder onClose={() => setPos(false)} onConfirm={registrarVenta} nextTicket={nextTicket} />}
      {detalle && <VentaDetalle v={detalle} onClose={() => setDetalle(null)} />}
      {confirmDel && (
        <ConfirmModal
          title="¿Eliminar venta?"
          desc={`Se eliminará el ticket ${confirmDel.ticket} de ${confirmDel.cliente} por ${mxn(totalVenta(confirmDel))}. ${confirmDel.lineas.some(l => l.tipo === 'producto') ? 'El stock de los productos se repondrá automáticamente. ' : ''}Esta acción no se puede deshacer.`}
          onConfirm={eliminarVenta}
          onCancel={() => !deleting && setConfirmDel(null)}
        />
      )}
      {cierreCaja && (
        <CierreCajaModal
          onClose={() => setCierreCaja(false)}
          ventas={ventas}
          pendientes={pendientes}
          usuarioNombre={user?.nombre || ''}
          usuarioId={user?.id}
          todayStr={todayStr}
        />
      )}
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import { Stat, Avatar, toast, Modal, ConfirmModal, useTableSort, sortRows, SortTh, Pager } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { useStore } from '../data/store'
import { useAuth } from '../lib/auth'
import { db } from '../lib/db'
import { mxn, ventaCalc, descargarCSV, desglosePagos, ventaTS, normalizarBusqueda } from '../lib/helpers'
import { POSBuilder } from './POS'
import type { Venta, CierreCaja, LineaVenta } from '../types'

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
      ${v.pagos && v.pagos.length ? v.pagos.map(p => `<div class="r" style="font-size:11px;color:#555"><span>· ${p.metodo}</span><span>${mxn(p.monto)}</span></div>`).join('') : ''}
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
                        <Avatar ini={estilista.ini} color={estilista.color} size="sm" src={estilista.foto} />
                        {estilista.nombre.split(' ')[0]}
                      </span>
                    )}
                    {l.comMonto != null ? <span>com. {mxn(l.comMonto)}</span> : l.com ? <span>com. {l.com}%</span> : null}
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

          {v.pagos && v.pagos.length > 0 && (
            <div className="card" style={{ background: 'var(--surface)', padding: 14, marginBottom: 14 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Pago mixto</div>
              {v.pagos.map((p, i) => (
                <div key={i} className="between" style={{ fontSize: 12.5, marginTop: i ? 6 : 0 }}>
                  <span className="muted">{p.metodo}</span>
                  <span className="num" style={{ fontWeight: 600 }}>{mxn(p.monto)}</span>
                </div>
              ))}
            </div>
          )}

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

  const montoRecibidoAlCrear = ventaCalc.cobrado

  const porMetodo: Record<string, number> = { efectivo: 0, transferencia: 0, tarjeta: 0 }
  const sumar = (metodo: string, monto: number) => {
    const key = (metodo || '').toLowerCase()
    if (key in porMetodo) porMetodo[key] += monto
    else porMetodo[key] = (porMetodo[key] || 0) + monto
  }
  creadasHoy.forEach(v => desglosePagos(v, montoRecibidoAlCrear(v)).forEach(p => sumar(p.metodo, p.monto)))
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
  const [filtroPago, setFiltroPago] = useState('Todos')
  const [dia, setDia] = useState('')     // 'YYYY-MM-DD' — selector por día como en la agenda
  const [desde, setDesde] = useState('') // rango de fechas (corte): desde…
  const [hasta, setHasta] = useState('') // …hasta
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
  const comisionVenta = (v: Venta) => v.lineas.reduce((s, l) => s + (
    l.comMonto != null ? Math.round(l.comMonto * l.cant) : Math.round(totalLinea(l) * (l.com || 0) / 100)
  ), 0)

  const hoyDate = new Date()
  const esMismoDia = (t: number | null, d: Date) => t != null && new Date(t).toDateString() === d.toDateString()
  const todayStr = hoyDate.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })   // para el cierre de caja del día

  const hoyVentas = ventas.filter(v => esMismoDia(ventaTS(v), hoyDate))
  // "Ventas de hoy" es dinero realmente cobrado, no lo facturado: un ticket
  // 'pendiente' o el saldo sin cobrar de un 'apartado'/'parcial' no cuenta
  // como venta del día hasta que de verdad se recibe.
  const totalHoy = hoyVentas.reduce((s, v) => s + ventaCalc.cobrado(v), 0)
  const ticketProm = hoyVentas.length ? Math.round(totalHoy / hoyVentas.length) : 0
  const comisionesHoy = hoyVentas.reduce((s, v) => s + comisionVenta(v), 0)
  const pendientes = ventas.filter(v => v.estado === 'parcial' || v.estado === 'pendiente')

  const periodFilter = (v: Venta) => {
    const t = ventaTS(v)
    if (filtroPeriodo === 'Hoy') return esMismoDia(t, hoyDate)
    if (filtroPeriodo === 'Mes') {
      if (t == null) return false
      const d = new Date(t)
      return d.getFullYear() === hoyDate.getFullYear() && d.getMonth() === hoyDate.getMonth()
    }
    return true
  }

  const diaDate = dia ? new Date(dia + 'T12:00:00') : null
  const rangoActivo = !!(desde || hasta)
  const rangoDesde = desde ? Date.parse(desde + 'T00:00:00') : -Infinity
  const rangoHasta = hasta ? Date.parse(hasta + 'T23:59:59.999') : Infinity

  const apartados = ventas.filter(v => v.estado === 'apartado')

  const lista = ventas.filter(v => {
    if (v.estado === 'apartado') return false
    // Prioridad de filtro temporal: rango de fechas > día > periodo.
    if (rangoActivo) {
      const t = ventaTS(v)
      if (t == null || t < rangoDesde || t > rangoHasta) return false
    } else if (dia && diaDate) {
      if (!esMismoDia(ventaTS(v), diaDate)) return false
    } else if (!periodFilter(v)) return false
    if (filtroPago !== 'Todos' && v.pago !== filtroPago &&
        !(v.pagos && v.pagos.some(p => p.metodo === filtroPago))) return false
    if (q && !normalizarBusqueda(v.cliente).includes(normalizarBusqueda(q)) && !v.ticket.includes(q)) return false
    if (filtroTipo === 'Con producto') return v.lineas.some(l => l.tipo === 'producto')
    if (filtroTipo === 'Solo servicio') return v.lineas.every(l => l.tipo !== 'producto')
    if (filtroTipo === 'Con saldo') return saldo(v) > 0
    return true
  })

  // Orden por columna + paginación de la lista.
  const { sort, toggle } = useTableSort()
  const ventaValor = (v: Venta, key: string): number | string => {
    switch (key) {
      case 'fecha': return ventaTS(v) ?? 0
      case 'cliente': return v.cliente.toLowerCase()
      case 'total': return totalVenta(v)
      case 'ticket': return v.ticket
      case 'pago': return v.pago
      case 'estado': return v.estado
      default: return 0
    }
  }
  const listaOrdenada = sortRows(lista, sort, ventaValor)
  const PAGE = 25
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(listaOrdenada.length / PAGE))
  useEffect(() => { setPage(1) }, [q, filtroTipo, filtroPeriodo, filtroPago, dia, desde, hasta, sort])
  const pageIdx = Math.min(page, totalPages) - 1
  const pageRows = listaOrdenada.slice(pageIdx * PAGE, pageIdx * PAGE + PAGE)

  // Totales por método de pago sobre la lista visible (separa efectivo/tarjeta).
  const totalesPorPago = lista.reduce((acc, v) => {
    desglosePagos(v, totalVenta(v)).forEach(p => { acc[p.metodo] = (acc[p.metodo] || 0) + p.monto })
    return acc
  }, {} as Record<string, number>)
  const metodosPago = ['Todos', 'Efectivo', 'Tarjeta', 'Transferencia', 'Crédito']

  // Corte del periodo mostrado (día o rango): totales para cuadrar caja.
  const corteTotal = lista.reduce((s, v) => s + totalVenta(v), 0)
  const corteComis = lista.reduce((s, v) => s + comisionVenta(v), 0)
  const corteDesc = lista.reduce((s, v) => s + (v.desc || 0), 0)
  const corteAnticipos = lista.reduce((s, v) => s + (v.anticipo || 0), 0)
  const cortePromedio = lista.length ? Math.round(corteTotal / lista.length) : 0
  const fmtDia = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) }
  const corteLabel = rangoActivo
    ? `${desde ? fmtDia(desde) : '…'} — ${hasta ? fmtDia(hasta) : '…'}`
    : dia ? fmtDia(dia) : ''

  // Exportar la lista visible a CSV (respeta filtros, día y rango).
  const exportarVentasCSV = () => {
    const filas: (string | number)[][] = [['Ticket', 'Fecha', 'Clienta', 'Detalle', 'Pago', 'Subtotal', 'Descuento', 'Anticipo', 'Total', 'Comisión', 'Estado']]
    listaOrdenada.forEach(v => filas.push([
      v.ticket, v.fecha, v.cliente, resumenItems(v), v.pago,
      subtotalV(v), v.desc || 0, v.anticipo || 0, totalVenta(v), comisionVenta(v), v.estado,
    ]))
    const suf = dia || (rangoActivo ? `${desde || 'inicio'}_a_${hasta || 'hoy'}` : filtroPeriodo.toLowerCase())
    descargarCSV(`ventas-${suf}`, filas)
  }

  // Imprimir el corte del periodo (día o rango).
  const imprimirCorte = () => {
    const fila = ([l, v]: [string, string, string?]) => `<div class="r"><span>${l}</span><span>${v}</span></div>`
    const seccion = (titulo: string, items: [string, string, string?][]) =>
      items.length ? `<div class="s">${titulo}</div>${items.map(fila).join('')}` : ''
    const itemsPorTipo = corteXTipo.flatMap(t => [
      [t.label.toUpperCase(), mxn(t.total)] as [string, string],
      ...t.items.map(i => [`  ${i.nombre}${i.cant > 1 ? ` ×${i.cant}` : ''}`, mxn(i.total)] as [string, string]),
    ])
    const rows = [
      seccion('Resumen', corteResumen),
      seccion('Por método de pago', corteXPago),
      seccion('Por tipo de venta', itemsPorTipo),
      seccion('Por estilista', corteXEstilista.map(e => [e.est.nombre, mxn(e.total)] as [string, string])),
    ].join('')
    const html = `<html><head><meta charset="utf-8"><style>
      body{font-family:sans-serif;font-size:13px;margin:0;padding:24px;max-width:420px}
      h2{font-size:18px;margin:0 0 2px}.sub{color:#666;font-size:12px;margin-bottom:14px}
      .tot{font-size:26px;font-weight:700;margin:6px 0 14px}
      .r{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee}
      .s{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#999;margin:16px 0 4px}
      </style></head><body>
      <h2>${data.config?.nombre || 'Robsen Salón & Spa'} — Corte</h2>
      <div class="sub">${corteLabel}</div>
      <div class="tot">${mxn(corteTotal)}</div>
      ${rows}
      </body></html>`
    const win = window.open('', '_blank', 'width=460,height=680')
    if (!win) return
    win.document.write(html); win.document.close()
    win.onload = () => { win.print(); win.close() }
  }

  // Resumen general del periodo mostrado.
  const corteResumen: [string, string, string?][] = [
    ['Tickets', String(lista.length)],
    ['Ticket promedio', mxn(cortePromedio)],
    ['Comisiones', mxn(corteComis), '#B08AC7'],
  ]
  if (corteDesc > 0) corteResumen.push(['Descuentos', mxn(corteDesc)])
  if (corteAnticipos > 0) corteResumen.push(['Anticipos', mxn(corteAnticipos)])

  // Parte 1: por método de pago.
  const corteXPago: [string, string, string?][] = [
    ['Efectivo', mxn(totalesPorPago['Efectivo'] || 0), 'var(--st-conf)'],
    ['Tarjeta', mxn(totalesPorPago['Tarjeta'] || 0), 'var(--gold)'],
  ]
  if (totalesPorPago['Transferencia']) corteXPago.push(['Transferencia', mxn(totalesPorPago['Transferencia'])])
  if (totalesPorPago['Crédito']) corteXPago.push(['Crédito', mxn(totalesPorPago['Crédito'])])

  // Parte 2: por tipo de venta (servicio / producto / adicional).
  const TIPOS_VENTA: { tipo: LineaVenta['tipo']; label: string; color: string }[] = [
    { tipo: 'servicio', label: 'Servicios', color: 'var(--gold)' },
    { tipo: 'producto', label: 'Productos', color: 'var(--st-conf)' },
    { tipo: 'adicional', label: 'Adicionales', color: '#6FA6B8' },
  ]
  // Cada línea con el mismo nombre dentro de un tipo se acumula en un solo
  // renglón (cantidad y total sumados) — así "Corte de dama ×5" se ve junto
  // en vez de repetido una vez por ticket.
  const itemsDe = (tipo: LineaVenta['tipo']) => {
    const acc = new Map<string, { nombre: string; cant: number; total: number }>()
    lista.forEach(v => v.lineas.filter(l => l.tipo === tipo).forEach(l => {
      const cur = acc.get(l.nombre) || { nombre: l.nombre, cant: 0, total: 0 }
      cur.cant += l.cant
      cur.total += totalLinea(l)
      acc.set(l.nombre, cur)
    }))
    return [...acc.values()].sort((a, b) => b.total - a.total)
  }
  const corteXTipo = TIPOS_VENTA
    .map(t => ({ ...t, items: itemsDe(t.tipo), total: 0 }))
    .map(t => ({ ...t, total: t.items.reduce((s, i) => s + i.total, 0) }))
    .filter(t => t.total > 0)

  // Parte 3: por estilista — quién generó qué del periodo mostrado.
  const comisionLinea = (l: LineaVenta) =>
    l.comMonto != null ? Math.round(l.comMonto * l.cant) : Math.round(totalLinea(l) * (l.com || 0) / 100)
  const corteXEstilista = (() => {
    const acc = new Map<string, { total: number; comision: number; tickets: Set<string> }>()
    lista.forEach(v => v.lineas.forEach(l => {
      if (!l.est) return
      const cur = acc.get(l.est) || { total: 0, comision: 0, tickets: new Set<string>() }
      cur.total += totalLinea(l)
      cur.comision += comisionLinea(l)
      cur.tickets.add(v.id)
      acc.set(l.est, cur)
    }))
    return [...acc.entries()]
      .map(([estId, v]) => ({ est: data.estilistas.find(e => e.id === estId), ...v }))
      .filter((x): x is typeof x & { est: NonNullable<typeof x.est> } => !!x.est)
      .sort((a, b) => b.total - a.total)
  })()

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
          <button className="btn ghost" onClick={exportarVentasCSV} title="Exportar la lista visible a CSV"><Ic n="download-simple" />Exportar</button>
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

      <div className="card card-pad" style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="between" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="search" style={{ width: 280, maxWidth: '100%' }}>
            <Ic n="magnifying-glass" />
            <input placeholder="Buscar por clienta o ticket…" value={q} onChange={e => setQ(e.target.value)} />
            {q && <button className="icon-btn" onClick={() => setQ('')} title="Limpiar" style={{ width: 22, height: 22, flex: '0 0 auto' }}><Ic n="x" size={12} /></button>}
          </div>
          <div className="vc gap8" style={{ flexWrap: 'wrap' }}>
            {/* Selector por día y por rango (corte). Son excluyentes entre sí y
                mandan sobre el filtro de periodo. */}
            <div className="vc gap6" style={{ flexWrap: 'wrap' }}>
              <span className="dim" style={{ fontSize: 11.5 }}>Día</span>
              <input type="date" className="input" value={dia}
                onChange={e => { setDia(e.target.value); if (e.target.value) { setDesde(''); setHasta('') } }}
                style={{ padding: '6px 10px', fontSize: 12.5, width: 'auto' }} />
              <span className="dim" style={{ fontSize: 11.5, marginLeft: 4 }}>Rango</span>
              <input type="date" className="input" value={desde} title="Desde"
                onChange={e => { setDesde(e.target.value); if (e.target.value) setDia('') }}
                style={{ padding: '6px 10px', fontSize: 12.5, width: 'auto' }} />
              <span className="dim">–</span>
              <input type="date" className="input" value={hasta} title="Hasta"
                onChange={e => { setHasta(e.target.value); if (e.target.value) setDia('') }}
                style={{ padding: '6px 10px', fontSize: 12.5, width: 'auto' }} />
              {(dia || desde || hasta) && (
                <button className="chip" onClick={() => { setDia(''); setDesde(''); setHasta('') }} title="Limpiar fechas"><Ic n="x" size={12} /></button>
              )}
            </div>
            <div style={{ width: 1, height: 20, background: 'var(--line-soft)' }} />
            <div className="vc gap6">
              {['Todo', 'Hoy', 'Mes'].map(f => {
                const off = !!dia || rangoActivo
                return (
                  <button key={f} className="chip" disabled={off}
                    style={{ ...(filtroPeriodo === f && !off ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : {}), ...(off ? { opacity: .4 } : {}) }}
                    onClick={() => setFiltroPeriodo(f)}>{f}</button>
                )
              })}
            </div>
            <div style={{ width: 1, height: 20, background: 'var(--line-soft)' }} />
            <div className="vc gap6">
              {['Todas', 'Con producto', 'Solo servicio', 'Con saldo'].map(f => (
                <button key={f} className="chip" style={filtroTipo === f ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : {}} onClick={() => setFiltroTipo(f)}>{f}</button>
              ))}
            </div>
          </div>
        </div>
        {/* Método de pago (menú extra): separa efectivo, tarjeta, etc. */}
        <div className="between" style={{ flexWrap: 'wrap', gap: 10, borderTop: '1px solid var(--line-soft)', paddingTop: 12 }}>
          <div className="vc gap6" style={{ flexWrap: 'wrap' }}>
            <span className="dim" style={{ fontSize: 11.5, marginRight: 2 }}>Método de pago</span>
            {metodosPago.map(f => (
              <button key={f} className="chip" style={filtroPago === f ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : {}} onClick={() => setFiltroPago(f)}>{f}</button>
            ))}
          </div>
          <div className="vc gap12" style={{ flexWrap: 'wrap', fontSize: 12 }}>
            <span className="vc gap4"><Ic n="hand-coins" style={{ color: 'var(--st-conf)' }} /><b className="num">{mxn(totalesPorPago['Efectivo'] || 0)}</b><span className="dim">efectivo</span></span>
            <span className="vc gap4"><Ic n="credit-card" style={{ color: 'var(--gold)' }} /><b className="num">{mxn(totalesPorPago['Tarjeta'] || 0)}</b><span className="dim">tarjeta</span></span>
            {(totalesPorPago['Transferencia'] || 0) > 0 && (
              <span className="vc gap4"><b className="num">{mxn(totalesPorPago['Transferencia'])}</b><span className="dim">transf.</span></span>
            )}
          </div>
        </div>
      </div>

      {(dia || rangoActivo) && (
        <div className="card card-pad" style={{ marginBottom: 16, borderTop: '3px solid var(--gold)' }}>
          <div className="between" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
            <div className="vc gap10">
              <Ic n="scissors" style={{ color: 'var(--gold)' }} />
              <div>
                <div className="eyebrow" style={{ marginBottom: 2 }}>Corte del periodo</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{corteLabel}</div>
              </div>
            </div>
            <div className="vc gap10">
              <div style={{ textAlign: 'right' }}>
                <div className="dim" style={{ fontSize: 11 }}>Total vendido</div>
                <div className="num" style={{ fontWeight: 800, fontSize: 22, color: 'var(--gold)' }}>{mxn(corteTotal)}</div>
              </div>
              <button className="btn ghost sm" onClick={imprimirCorte} title="Imprimir el corte"><Ic n="printer" />Imprimir</button>
            </div>
          </div>
          {lista.length === 0 ? (
            <div className="dim" style={{ fontSize: 12.5 }}>Sin ventas en este periodo.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Resumen */}
              <div>
                <div className="dim" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Resumen</div>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                  {corteResumen.map(([label, val, color]) => (
                    <div key={label} style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px' }}>
                      <div className="dim" style={{ fontSize: 11 }}>{label}</div>
                      <div className="num" style={{ fontWeight: 700, fontSize: 15, color: color || 'var(--text)', marginTop: 2 }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Por método de pago */}
              <div>
                <div className="dim" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Por método de pago</div>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                  {corteXPago.map(([label, val, color]) => (
                    <div key={label} style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px' }}>
                      <div className="dim" style={{ fontSize: 11 }}>{label}</div>
                      <div className="num" style={{ fontWeight: 700, fontSize: 15, color: color || 'var(--text)', marginTop: 2 }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Por tipo de venta — con el detalle de cada servicio/producto
                  que acumula ese total, no solo el número redondo. */}
              {corteXTipo.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="dim" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Por tipo de venta</div>
                  {corteXTipo.map(t => (
                    <div key={t.tipo} style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px' }}>
                      <div className="between" style={{ marginBottom: 10 }}>
                        <span className="vc gap8" style={{ fontWeight: 600, fontSize: 13.5 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                          {t.label}
                          <span className="dim" style={{ fontWeight: 400, fontSize: 11.5 }}>· {t.items.length} artículo{t.items.length !== 1 ? 's' : ''}</span>
                        </span>
                        <span className="num" style={{ fontWeight: 700, fontSize: 15, color: t.color }}>{mxn(t.total)}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {t.items.map(item => (
                          <div key={item.nombre}>
                            <div className="between" style={{ fontSize: 12.5 }}>
                              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.nombre}{item.cant > 1 && <span className="dim"> ×{item.cant}</span>}
                              </span>
                              <span className="num" style={{ fontWeight: 600, flexShrink: 0, marginLeft: 10 }}>{mxn(item.total)}</span>
                            </div>
                            <div style={{ height: 3, borderRadius: 2, background: 'var(--line-soft)', marginTop: 4, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.round((item.total / t.total) * 100)}%`, background: t.color }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Por estilista */}
              {corteXEstilista.length > 0 && (
                <div>
                  <div className="dim" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Por estilista</div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {corteXEstilista.map(e => (
                      <div key={e.est.id} className="list-item" style={{ padding: '10px 0' }}>
                        <Avatar ini={e.est.ini} size="sm" />
                        <div className="f1" style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{e.est.nombre}</div>
                          <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>{e.tickets.size} ticket{e.tickets.size !== 1 ? 's' : ''} · comisión {mxn(e.comision)}</div>
                        </div>
                        <div className="num gold-text" style={{ fontWeight: 700, fontSize: 14 }}>{mxn(e.total)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
              <SortTh label="Ticket" k="ticket" sort={sort} onSort={toggle} />
              <SortTh label="Fecha" k="fecha" sort={sort} onSort={toggle} />
              <SortTh label="Clienta" k="cliente" sort={sort} onSort={toggle} />
              <th>Detalle</th>
              <th>Atendió</th>
              <SortTh label="Pago" k="pago" sort={sort} onSort={toggle} />
              <SortTh label="Total" k="total" sort={sort} onSort={toggle} num />
              <SortTh label="Estado" k="estado" sort={sort} onSort={toggle} />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(v => {
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
                          <Avatar ini={e.ini} color={e.color} size="sm" src={e.foto} />
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
        <Pager page={Math.min(page, totalPages)} totalPages={totalPages} onPage={setPage} />
      </div>

      {pos && <POSBuilder onClose={() => setPos(false)} onConfirm={registrarVenta} />}
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

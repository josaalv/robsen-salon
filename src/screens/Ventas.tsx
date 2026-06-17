import React, { useState } from 'react'
import { Stat, Avatar, EstadoBadge, toast } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { useStore } from '../data/store'
import { mxn, ventaCalc } from '../lib/helpers'
import { POSBuilder } from './POS'
import type { Venta } from '../types'

function VentaDetalle({ v, onClose }: { v: Venta; onClose: () => void }) {
  const subtotal = ventaCalc.subtotal(v)
  const totalV = ventaCalc.total(v)
  const saldo = ventaCalc.saldo(v)
  const comision = ventaCalc.comision(v)

  const tipoBadge: Record<string, [string, string]> = {
    servicio: ['scissors', 'pay'],
    producto: ['package', 'done'],
    adicional: ['plus', 'neutral'],
  }

  return (
    <div className="rb-modal-bg" onClick={onClose}>
      <div className="card gold-edge rb-modal" onClick={e => e.stopPropagation()} style={{ width: 540, maxWidth: '94vw' }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">Ticket {v.ticket} · {v.fecha}</div>
            <h3 style={{ marginTop: 6 }}>{v.cliente}</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><Ic n="x" /></button>
        </div>
        <div className="card-pad scroll-y" style={{ paddingTop: 14, maxHeight: '60vh' }}>
          {v.lineas.map((l, i) => {
            const [ic, bc] = tipoBadge[l.tipo] || ['question', 'neutral']
            return (
              <div key={i} className="list-item" style={{ padding: '13px 0' }}>
                <div className="ico" style={{ width: 36, height: 36, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', border: '1px solid var(--line-soft)', color: 'var(--gold)', flex: '0 0 36px' }}>
                  <Ic n={ic} />
                </div>
                <div className="f1" style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{l.cant > 1 ? l.cant + '× ' : ''}{l.nombre}</div>
                  <div className="vc gap8" style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>
                    <span className={'badge ' + bc} style={{ fontSize: 10, padding: '2px 7px' }}>{l.tipo}</span>
                    {l.est && (() => {
                      return null
                    })()}
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
            <span className="muted">Subtotal</span>
            <span className="num">{mxn(subtotal)}</span>
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
          <div className="between">
            <span style={{ fontWeight: 700, fontFamily: 'var(--serif)', fontSize: 16 }}>
              {v.estado === 'parcial' ? 'Saldo por cobrar' : 'Total pagado'}
            </span>
            <span className="num gold-text" style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600 }}>
              {mxn(v.estado === 'parcial' ? saldo : totalV)}
            </span>
          </div>
          <div className="card" style={{ background: 'var(--surface)', padding: 14, marginTop: 14 }}>
            <div className="between" style={{ fontSize: 12.5 }}>
              <span className="muted vc gap8"><Ic n="users-three" />Comisión total del equipo</span>
              <span className="num" style={{ fontWeight: 600, color: '#B08AC7' }}>{mxn(comision)}</span>
            </div>
          </div>
          <div className="vc gap8 mt14">
            <button className="btn gold f1" style={{ justifyContent: 'center' }} onClick={() => toast('Imprimiendo ticket...')}><Ic n="printer" />Imprimir ticket</button>
            <button className="btn ghost" onClick={() => toast('Enviando por WhatsApp...')}><Ic n="whatsapp-logo" />Enviar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ScreenVentas({ onNavigate }: { onNavigate: (r: string) => void }) {
  const { data, addVenta } = useStore()
  const ventas = data.ventas
  const [pos, setPos] = useState(false)
  const [detalle, setDetalle] = useState<Venta | null>(null)
  const [filtro, setFiltro] = useState('Todas')

  const totalLinea = (l: { precio: number; cant: number }) => l.precio * l.cant
  const subtotal = (v: Venta) => v.lineas.reduce((s, l) => s + totalLinea(l), 0)
  const totalVenta = (v: Venta) => subtotal(v) - (v.desc || 0)
  const saldo = (v: Venta) => Math.max(0, totalVenta(v) - (v.anticipo || 0))
  const comisionVenta = (v: Venta) => v.lineas.reduce((s, l) => s + Math.round(totalLinea(l) * (l.com || 0) / 100), 0)

  const hoyVentas = ventas.filter(v => v.fecha.startsWith('15 Jun') || v.fecha.startsWith('Hoy'))
  const totalHoy = hoyVentas.reduce((s, v) => s + totalVenta(v), 0)
  const ticketProm = hoyVentas.length ? Math.round(totalHoy / hoyVentas.length) : 0
  const comisionesHoy = hoyVentas.reduce((s, v) => s + comisionVenta(v), 0)

  const lista = filtro === 'Todas' ? ventas : ventas.filter(v =>
    filtro === 'Con producto' ? v.lineas.some(l => l.tipo === 'producto') :
    filtro === 'Solo servicio' ? v.lineas.every(l => l.tipo !== 'producto') :
    filtro === 'Con saldo' ? saldo(v) > 0 : true
  )

  const registrarVenta = (venta: Venta) => {
    addVenta(venta)
    setPos(false)
    toast('Venta registrada correctamente')
  }

  const resumenItems = (v: Venta) => {
    const s = v.lineas.filter(l => l.tipo === 'servicio').length
    const p = v.lineas.filter(l => l.tipo === 'producto').length
    const a = v.lineas.filter(l => l.tipo === 'adicional').length
    return [
      s && `${s} servicio${s > 1 ? 's' : ''}`,
      p && `${p} producto${p > 1 ? 's' : ''}`,
      a && `${a} extra${a > 1 ? 's' : ''}`,
    ].filter(Boolean).join(' · ')
  }

  const nextTicket = '#' + (1043 + ventas.filter(v => v.fecha.startsWith('Hoy')).length)

  return (
    <div>
      <div className="between" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="display" style={{ fontSize: 26, margin: 0 }}>Ventas</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Punto de venta · servicios, productos y adicionales en un solo ticket</div>
        </div>
        <button className="btn gold" onClick={() => setPos(true)}><Ic n="plus-circle" />Nueva venta</button>
      </div>

      {/* KPIs */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 18 }}>
        <Stat icon={<Ic n="cash-register" />} label="Ventas de hoy" value={mxn(totalHoy)} delta="+9.2%" deltaDir="up" />
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
          <div className="kpi-mini"><span className="l">Ticket promedio</span><span className="v">{mxn(ticketProm)}</span></div>
        </div>
        <div className="card card-pad vc gap16">
          <div className="ico" style={{ width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(176,138,199,0.12)', border: '1px solid rgba(176,138,199,0.28)', color: '#B08AC7' }}>
            <Ic n="users-three" />
          </div>
          <div className="kpi-mini"><span className="l">Comisiones generadas</span><span className="v">{mxn(comisionesHoy)}</span></div>
        </div>
      </div>

      <div className="vc gap8" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        {['Todas', 'Con producto', 'Solo servicio', 'Con saldo'].map(f => (
          <button key={f} className="chip" style={filtro === f ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : {}} onClick={() => setFiltro(f)}>{f}</button>
        ))}
        <div className="spacer"></div>
        <span className="dim vc gap8" style={{ fontSize: 11.5 }}>
          <Ic n="link-simple" />Conectado con Inventario, Comisiones y Finanzas
        </span>
      </div>

      {/* Tabla de ventas */}
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Fecha</th>
              <th>Clienta</th>
              <th>Detalle</th>
              <th>Atendió</th>
              <th>Pago</th>
              <th className="num">Total</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lista.map(v => {
              const ests = [...new Set(v.lineas.filter(l => l.est).map(l => l.est))].map(id => data.estilistas.find(e => e.id === id) || data.estilistas[0])
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
                      ? <span className="badge conf"><span className="d"></span>Pagada</span>
                      : v.estado === 'parcial'
                      ? <span className="badge pend"><span className="d"></span>Saldo {mxn(saldo(v))}</span>
                      : <span className="badge canc"><span className="d"></span>Pendiente</span>}
                  </td>
                  <td><Ic n="caret-right" /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {pos && (
        <POSBuilder
          onClose={() => setPos(false)}
          onConfirm={registrarVenta}
          nextTicket={nextTicket}
        />
      )}
      {detalle && <VentaDetalle v={detalle} onClose={() => setDetalle(null)} />}
    </div>
  )
}

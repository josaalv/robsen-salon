import React, { useState, useMemo } from 'react'
import { Stat, CardHead, EstadoBadge, BarChart, Seg, toast } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { useStore } from '../data/store'
import { mxn, ventaCalc } from '../lib/helpers'
import type { Usuario } from '../types'

const DIAS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const DIAS_SHORT_ES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

export function ScreenDashboard({ onNavigate, user }: { onNavigate: (r: string) => void; user: Usuario }) {
  const { data } = useStore()
  const [periodo, setPeriodo] = useState('Semana')

  const hoy = new Date()
  const fechaStr = `${DIAS_ES[hoy.getDay()]} · ${hoy.getDate()} de ${MESES_ES[hoy.getMonth()]}, ${hoy.getFullYear()}`
  const nombre = user?.nombre?.split(' ')[0] || 'Robsen'

  // — Citas de hoy —
  const citasHoy = data.hoy
  const citasPend = citasHoy.filter(c => c.estado === 'pend')
  const citasConf = citasHoy.filter(c => ['conf', 'pay'].includes(c.estado))
  const anticiposHoy = citasHoy.reduce((s, c) => s + (c.ant || 0), 0)
  const proximas = citasHoy.filter(a => ['conf', 'pay', 'pend'].includes(a.estado)).slice(0, 6)

  // — Ventas —
  const todayStr = hoy.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
  const ventasHoy = data.ventas.filter(v => v.fecha.startsWith(todayStr))
  const totalHoy = ventasHoy.reduce((s, v) => s + ventaCalc.total(v), 0)

  // Últimos 7 días reales
  const semanaData = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(hoy); d.setDate(hoy.getDate() - (6 - i))
    const dStr = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
    const total = data.ventas
      .filter(v => v.fecha.toLowerCase().startsWith(dStr.toLowerCase()))
      .reduce((s, v) => s + ventaCalc.total(v), 0)
    return { d: DIAS_SHORT_ES[d.getDay()], v: total }
  }), [data.ventas, hoy.toDateString()])

  const totalSemana = semanaData.reduce((s, d) => s + d.v, 0)
  const mejorDia = semanaData.length > 0 ? semanaData.reduce((a, b) => b.v > a.v ? b : a) : null

  // Mes actual real
  const mesActualStr = MESES_SHORT[hoy.getMonth()]
  const ventasMesArr = data.ventas.filter(v => v.fecha.includes(mesActualStr))
  const totalMes = ventasMesArr.reduce((s, v) => s + ventaCalc.total(v), 0)
  const ticketProm = ventasMesArr.length ? Math.round(totalMes / ventasMesArr.length) : 0

  const mesData = useMemo(() => {
    const acc: Record<number, number> = {}
    ventasMesArr.forEach(v => {
      const day = parseInt(v.fecha.split(' ')[0])
      if (!isNaN(day)) acc[day] = (acc[day] || 0) + ventaCalc.total(v)
    })
    const dias = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
    return Array.from({ length: dias }, (_, i) => ({ d: String(i + 1), v: acc[i + 1] || 0 }))
  }, [data.ventas, hoy.getMonth()])

  // Servicios más vendidos (real)
  const servMasVendidos = useMemo(() => {
    const acc: Record<string, { n: number; ingreso: number }> = {}
    data.ventas.forEach(v => {
      v.lineas.filter(l => l.tipo === 'servicio').forEach(l => {
        if (!acc[l.nombre]) acc[l.nombre] = { n: 0, ingreso: 0 }
        acc[l.nombre].n++
        acc[l.nombre].ingreso += l.precio * l.cant
      })
    })
    const rows = Object.entries(acc).map(([srv, d]) => ({ srv, ...d })).sort((a, b) => b.ingreso - a.ingreso).slice(0, 5)
    return rows.length ? rows : data.servMasVendidos
  }, [data.ventas])

  const chartData = periodo === 'Semana' ? semanaData : mesData

  // — Clientas —
  const nuevas = data.clientas.filter(c => c.estado === 'Nueva').length
  const recurrentes = data.clientas.filter(c => ['VIP', 'Frecuente', 'Activa'].includes(c.estado)).length

  // — Alertas calculadas de datos reales —
  const sinConfirmar = citasHoy.filter(c => c.estado === 'pend')
  const pagosP = data.ventas.filter(v => v.estado === 'parcial' || v.estado === 'pendiente')
  const saldoPendiente = pagosP.reduce((s, v) => s + ventaCalc.saldo(v), 0)
  const inactivas = data.clientas.filter(c => c.estado === 'Inactiva')
  const stockBajo = data.productos.filter(p => p.stock <= p.min && p.stock > 0)

  const getEst = (id: string) => data.estilistas.find(e => e.id === id) || data.estilistas[0]

  return (
    <div>
      {/* Saludo */}
      <div className="between" style={{ marginBottom: 24 }}>
        <div>
          <div className="eyebrow">{fechaStr}</div>
          <h1 className="display" style={{ fontSize: 30, margin: '8px 0 0' }}>
            Buen día, <span className="gold-text">{nombre}</span>
          </h1>
          <div className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>
            Tienes <b style={{ color: 'var(--text)' }}>{citasHoy.length} citas</b> hoy
            {citasPend.length > 0 && <> · <b style={{ color: 'var(--st-pend)' }}>{citasPend.length} por confirmar</b></>}
            {pagosP.length > 0 && <> · {pagosP.length} pagos pendientes de cobro</>}
          </div>
        </div>
        <div className="vc gap12">
          <button className="btn ghost" onClick={() => {
            const enc = 'Ticket,Fecha,Cliente,Total,Pago,Estado'
            const filas = data.ventas.map(v => {
              const total = v.lineas.reduce((s,l)=>s+l.precio*l.cant,0) - v.desc
              return [v.ticket,v.fecha,`"${v.cliente}"`,total,v.pago,v.estado].join(',')
            })
            const csv = [enc,...filas].join('\n')
            const fecha = new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'})
            const a = document.createElement('a')
            a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}))
            a.download = `reporte-${fecha.replace(/\s/g,'-')}.csv`
            a.click()
            toast(`Reporte exportado · ${data.ventas.length} ventas`)
          }}>
            <Ic n="export" />Exportar CSV
          </button>
          <button className="btn gold" onClick={() => onNavigate('agenda')}>
            <Ic n="plus" />Nueva cita
          </button>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <Stat icon={<Ic n="currency-circle-dollar" />} label="Ventas de hoy"      value={mxn(totalHoy)}   spark={semanaData.map(d => d.v)} />
        <Stat icon={<Ic n="calendar-check" />}         label="Ventas de la semana" value={mxn(totalSemana)} spark={semanaData.map(d => d.v)} />
        <Stat icon={<Ic n="chart-line-up" />}          label="Ventas del mes"      value={mxn(totalMes)}   spark={mesData.slice(-6).map(d => d.v)} />
        <Stat icon={<Ic n="receipt" />}                label="Ticket promedio"     value={mxn(ticketProm)} spark={semanaData.map(d => d.v)} />
      </div>

      {/* KPIs secundarios */}
      <div className="grid mt18" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="card card-pad vc gap16">
          <div className="ico" style={{ width:44,height:44,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(147,181,140,0.12)',border:'1px solid rgba(147,181,140,0.28)',color:'var(--st-conf)' }}>
            <Ic n="check-circle" />
          </div>
          <div className="kpi-mini">
            <span className="l">Citas confirmadas</span>
            <span className="v">{citasConf.length}</span>
          </div>
        </div>
        <div className="card card-pad vc gap16">
          <div className="ico" style={{ width:44,height:44,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(217,164,65,0.12)',border:'1px solid rgba(217,164,65,0.28)',color:'var(--st-pend)' }}>
            <Ic n="clock-countdown" />
          </div>
          <div className="kpi-mini">
            <span className="l">Por confirmar</span>
            <span className="v">{citasPend.length}</span>
          </div>
        </div>
        <div className="card card-pad vc gap16">
          <div className="ico" style={{ width:44,height:44,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(200,161,74,0.12)',border:'1px solid var(--line)',color:'var(--gold)' }}>
            <Ic n="hand-coins" />
          </div>
          <div className="kpi-mini">
            <span className="l">Anticipos recibidos hoy</span>
            <span className="v">{mxn(anticiposHoy)}</span>
          </div>
        </div>
        <div className="card card-pad vc gap16">
          <div className="ico" style={{ width:44,height:44,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(111,150,184,0.12)',border:'1px solid rgba(111,150,184,0.28)',color:'#8FB2D8' }}>
            <Ic n="user-plus" />
          </div>
          <div className="kpi-mini">
            <span className="l">Clientas · nuevas / recurrentes</span>
            <span className="v">{nuevas} <span style={{ color:'var(--text-3)',fontSize:15 }}>/ {recurrentes}</span></span>
          </div>
        </div>
      </div>

      {/* Gráfica + próximas citas */}
      <div className="grid mt18" style={{ gridTemplateColumns: '1.55fr 1fr' }}>
        <div className="card">
          <CardHead
            title={periodo === 'Semana' ? 'Ventas de la semana' : 'Ventas del mes'}
            sub={periodo === 'Semana' ? 'Últimos 7 días' : 'Mes actual'}
            right={<Seg opts={['Semana', 'Mes']} value={periodo} onChange={setPeriodo} />}
          />
          <div className="card-pad" style={{ paddingTop: 14 }}>
            <div className="vc gap24" style={{ marginBottom: 6 }}>
              <div className="kpi-mini">
                <span className="l">Total</span>
                <span className="v gold-text">{mxn(periodo === 'Semana' ? totalSemana : totalMes)}</span>
              </div>
              {periodo === 'Semana' && mejorDia && (
                <div className="kpi-mini">
                  <span className="l">Mejor día</span>
                  <span className="v">{mejorDia.d}</span>
                </div>
              )}
              <div className="kpi-mini">
                <span className="l">Citas hoy</span>
                <span className="v">{citasHoy.length}</span>
              </div>
            </div>
            <BarChart data={chartData} h={210} highlightLast={false} />
          </div>
        </div>

        {/* Próximas citas */}
        <div className="card">
          <CardHead title="Próximas citas de hoy" right={<span className="badge neutral">{citasHoy.length} hoy</span>} />
          <div className="card-pad" style={{ paddingTop: 10 }}>
            <div className="list">
              {proximas.map(a => {
                const e = getEst(a.est)
                return (
                  <div key={a.id} className="list-item">
                    <div style={{ textAlign:'center', minWidth:46 }}>
                      <div className="num" style={{ fontFamily:'var(--serif)', fontSize:17, fontWeight:600 }}>{a.h}</div>
                      <div style={{ fontSize:10, color:'var(--text-4)' }}>{a.dur} min</div>
                    </div>
                    <div style={{ width:1, height:34, background:'var(--line-soft)' }} />
                    <div className="f1" style={{ minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:13.5 }}>{a.cl}</div>
                      <div className="vc" style={{ fontSize:11.5, color:'var(--text-3)', marginTop:2, gap:7 }}>
                        <span className="dotc" style={{ background: e?.color }} />{a.srv}
                      </div>
                    </div>
                    <EstadoBadge k={a.estado} />
                  </div>
                )
              })}
            </div>
            <button className="btn ghost w100 mt14" style={{ justifyContent:'center' }} onClick={() => onNavigate('agenda')}>
              Ver agenda completa <Ic n="arrow-right" />
            </button>
          </div>
        </div>
      </div>

      {/* Servicios + Alertas */}
      <div className="grid mt18" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Servicios más vendidos */}
        <div className="card">
          <CardHead title="Servicios más vendidos" sub="Este mes" />
          <div className="card-pad" style={{ paddingTop: 12 }}>
            {servMasVendidos.map((s, i) => {
              const max = servMasVendidos[0]?.ingreso || 1
              return (
                <div key={i} style={{ padding:'11px 0', borderBottom: i < servMasVendidos.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
                  <div className="between" style={{ marginBottom: 8 }}>
                    <div className="vc gap12">
                      <span style={{ fontFamily:'var(--serif)', color:'var(--gold)', fontSize:15, width:18 }}>{i + 1}</span>
                      <span style={{ fontWeight:600, fontSize:13.5 }}>{s.srv}</span>
                    </div>
                    <div className="vc gap12">
                      <span className="badge neutral">{s.n} citas</span>
                      <span className="num" style={{ fontWeight:600, minWidth:78, textAlign:'right' }}>{mxn(s.ingreso)}</span>
                    </div>
                  </div>
                  <div className="bar"><span style={{ width: (s.ingreso / max * 100) + '%' }} /></div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Alertas reales */}
        <div className="card">
          <CardHead
            title="Alertas importantes"
            right={
              <span className="badge pend">
                <span className="d" />
                {sinConfirmar.length + (pagosP.length > 0 ? 1 : 0) + (inactivas.length > 0 ? 1 : 0) + (stockBajo.length > 0 ? 1 : 0)} nuevas
              </span>
            }
          />
          <div className="card-pad" style={{ paddingTop:12, display:'flex', flexDirection:'column', gap:11 }}>

            {sinConfirmar.length > 0 && (
              <div className="alert bad">
                <div className="ai"><Ic n="warning" /></div>
                <div className="f1">
                  <div className="at">{sinConfirmar.length} cita{sinConfirmar.length > 1 ? 's' : ''} sin confirmar</div>
                  <div className="as">{sinConfirmar.map(c => c.cl).join(', ')} · hoy</div>
                </div>
                <button className="btn sm line" onClick={() => onNavigate('whatsapp')}>Confirmar</button>
              </div>
            )}

            {pagosP.length > 0 && (
              <div className="alert warn">
                <div className="ai"><Ic n="clock" /></div>
                <div className="f1">
                  <div className="at">{pagosP.length} pago{pagosP.length > 1 ? 's' : ''} pendiente{pagosP.length > 1 ? 's' : ''} de cobro</div>
                  <div className="as">Saldo por cobrar · {mxn(saldoPendiente)}</div>
                </div>
                <button className="btn sm ghost" onClick={() => onNavigate('ventas')}>Ver</button>
              </div>
            )}

            {inactivas.length > 0 && (
              <div className="alert warn">
                <div className="ai"><Ic n="user-minus" /></div>
                <div className="f1">
                  <div className="at">{inactivas.length} clienta{inactivas.length > 1 ? 's' : ''} inactiva{inactivas.length > 1 ? 's' : ''} (+60 días)</div>
                  <div className="as">{inactivas.slice(0, 2).map(c => c.nombre.split(' ')[0]).join(' y ')} entre las de mayor ticket</div>
                </div>
                <button className="btn sm line" onClick={() => onNavigate('crm')}>Ver CRM</button>
              </div>
            )}

            {stockBajo.length > 0 && (
              <div className="alert warn">
                <div className="ai"><Ic n="package" /></div>
                <div className="f1">
                  <div className="at">{stockBajo.length} producto{stockBajo.length > 1 ? 's' : ''} con stock bajo</div>
                  <div className="as">{stockBajo.slice(0, 2).map(p => p.nombre.split(' ').slice(0,2).join(' ')).join(', ')}</div>
                </div>
                <button className="btn sm ghost" onClick={() => onNavigate('productos')}>Ver inventario</button>
              </div>
            )}

            {sinConfirmar.length === 0 && pagosP.length === 0 && inactivas.length === 0 && stockBajo.length === 0 && (
              <div style={{ textAlign:'center', color:'var(--text-4)', padding:'24px 0', fontSize:13 }}>
                <Ic n="check-circle" size={28} style={{ display:'block', margin:'0 auto 8px', color:'var(--st-conf)' }} />
                Todo al día — sin alertas pendientes
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

import React, { useState, useMemo, useRef } from 'react'
import { CardHead, Seg, Donut, BarChart, toast, useModalKeys } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { useStore } from '../data/store'
import { mxn, ventaCalc } from '../lib/helpers'
import type { Gasto } from '../types'

const MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const DIAS_ES  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const HOY = new Date()

const CAT_COLORS: Record<string, string> = {
  'Colorimetría':'#C8A14A','Mechas':'#E8CE8A','Tratamientos':'#93B58C',
  'Uñas & Spa':'#6FA6B8','Maquillaje':'#C77B7B','Corte':'#8FB2D8','Otros':'#B08AC7',
}

const CATS_GASTO = ['Productos','Renta','Servicios','Nómina','Publicidad','Mantenimiento','Otros']

function GastoModal({ onClose, onSave }: { onClose: () => void; onSave: (g: Gasto) => void }) {
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [categoria, setCategoria] = useState(CATS_GASTO[0])
  const cardRef = useRef<HTMLDivElement>(null)

  const guardar = () => {
    const m = parseFloat(monto)
    if (!concepto.trim()) { toast('Escribe el concepto del gasto.'); return }
    if (isNaN(m) || m <= 0) { toast('Ingresa un monto mayor a cero.'); return }
    onSave({ id: 'g' + Date.now(), concepto: concepto.trim(), monto: m, fecha, categoria })
  }

  useModalKeys(cardRef, onClose, guardar)

  return (
    <div className="rb-modal-bg" onClick={onClose}>
      <div ref={cardRef} className="card gold-edge rb-modal" onClick={e => e.stopPropagation()} style={{ width: 440, maxWidth: '94vw' }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">Registrar</div>
            <h3 style={{ marginTop: 6 }}>Nuevo gasto</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><Ic n="x" /></button>
        </div>
        <div className="card-pad" style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label>Concepto</label>
            <input className="input" value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Ej: Renta de local…" />
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Monto</label>
              <input className="input" type="number" min="0" value={monto} onChange={e => setMonto(e.target.value)} placeholder="0.00" />
            </div>
            <div className="field">
              <label>Fecha</label>
              <input className="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Categoría</label>
            <select className="select" value={categoria} onChange={e => setCategoria(e.target.value)}>
              {CATS_GASTO.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button className="btn gold" style={{ marginTop: 4 }} onClick={guardar}>Guardar gasto</button>
        </div>
      </div>
    </div>
  )
}

function parseFecha(s: string): Date {
  const dateStr = s.split(' · ')[0].trim()
  const [dd, mon] = dateStr.split(' ')
  const m = MESES_ES.findIndex(x => x.toLowerCase() === mon?.toLowerCase())
  const year = HOY.getFullYear()
  const d = new Date(year, m < 0 ? HOY.getMonth() : m, parseInt(dd) || 1)
  if (d > HOY) d.setFullYear(year - 1)
  return d
}

export function ScreenFinanzas({ onNavigate }: { onNavigate: (r: string) => void }) {
  const { data, addGasto, deleteGasto } = useStore()
  const [periodo, setPeriodo] = useState('Mes')
  const [showGastoModal, setShowGastoModal] = useState(false)

  // Filter ventas by selected period
  const ventasFiltradas = useMemo(() => {
    return data.ventas.filter(v => {
      const d = parseFecha(v.fecha)
      if (periodo === 'Semana') {
        const diff = (HOY.getTime() - d.getTime()) / 86400000
        return diff >= 0 && diff < 7
      }
      if (periodo === 'Mes') return d.getMonth() === HOY.getMonth()
      return true
    })
  }, [data.ventas, periodo])

  // Real KPIs from filtered ventas
  const ingServicio  = ventasFiltradas.reduce((s, v) => s + ventaCalc.porTipo(v, 'servicio'),  0)
  const ingProducto  = ventasFiltradas.reduce((s, v) => s + ventaCalc.porTipo(v, 'producto'),  0)
  const ingAdicional = ventasFiltradas.reduce((s, v) => s + ventaCalc.porTipo(v, 'adicional'), 0)
  const ingTotal     = ingServicio + ingProducto + ingAdicional
  const comReal      = ventasFiltradas.reduce((s, v) => s + ventaCalc.comision(v), 0)
  const antReal      = ventasFiltradas.reduce((s, v) => s + (v.anticipo || 0), 0)

  const gastosFiltrados = useMemo(() => {
    return (data.gastos || []).filter(g => {
      const d = new Date(g.fecha + 'T12:00:00')
      if (periodo === 'Semana') return (HOY.getTime() - d.getTime()) / 86400000 < 7
      if (periodo === 'Mes') return d.getMonth() === HOY.getMonth() && d.getFullYear() === HOY.getFullYear()
      return d.getFullYear() === HOY.getFullYear()
    })
  }, [data.gastos, periodo])

  const gastos       = gastosFiltrados.reduce((s, g) => s + g.monto, 0)
  const utilidad     = Math.max(0, ingTotal - gastos - comReal)
  const margen       = ingTotal > 0 ? Math.round(utilidad / ingTotal * 100) : 0

  // Composition donut data
  const desgloseData = [
    { cat: 'Servicios',   v: ingServicio,  c: '#C8A14A' },
    { cat: 'Productos',   v: ingProducto,  c: '#93B58C' },
    { cat: 'Adicionales', v: ingAdicional, c: '#B08AC7' },
  ].filter(d => d.v > 0)

  // Top services from real ventas
  const topServicios = useMemo(() => {
    const acc: Record<string, { n: number; ingreso: number }> = {}
    ventasFiltradas.forEach(v => {
      v.lineas.filter(l => l.tipo === 'servicio').forEach(l => {
        if (!acc[l.nombre]) acc[l.nombre] = { n: 0, ingreso: 0 }
        acc[l.nombre].n += l.cant
        acc[l.nombre].ingreso += l.precio * l.cant
      })
    })
    const rows = Object.entries(acc).map(([srv, d]) => ({ srv, ...d }))
    rows.sort((a, b) => b.ingreso - a.ingreso)
    return rows.slice(0, 5)
  }, [ventasFiltradas])

  // Category breakdown from real ventas × servicios catalog
  const categorias = useMemo(() => {
    const acc: Record<string, number> = {}
    ventasFiltradas.forEach(v => {
      v.lineas.filter(l => l.tipo === 'servicio').forEach(l => {
        const srv = data.servicios.find(s => s.nombre === l.nombre)
        const cat = srv?.cat || 'Otros'
        acc[cat] = (acc[cat] || 0) + l.precio * l.cant
      })
    })
    const rows = Object.entries(acc)
      .map(([cat, v]) => ({ cat, v, c: CAT_COLORS[cat] || '#B08AC7' }))
      .sort((a, b) => b.v - a.v)
    return rows
  }, [ventasFiltradas, data.servicios])

  // Bar chart — grouped by day (semana), week (mes), month (año)
  const barData = useMemo(() => {
    if (periodo === 'Año') {
      const acc: Record<number, number> = {}
      data.ventas.forEach(v => {
        const d = parseFecha(v.fecha)
        if (d.getFullYear() === HOY.getFullYear()) {
          acc[d.getMonth()] = (acc[d.getMonth()] || 0) + ventaCalc.total(v)
        }
      })
      return MESES_ES.map((d, i) => ({ d, v: acc[i] || 0 }))
    }

    const acc: Record<string, number> = {}
    ventasFiltradas.forEach(v => {
      const d = parseFecha(v.fecha)
      const key = `${d.getMonth()}-${d.getDate()}`
      acc[key] = (acc[key] || 0) + ventaCalc.total(v)
    })

    if (periodo === 'Semana') {
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(HOY)
        d.setDate(d.getDate() - 6 + i)
        const key = `${d.getMonth()}-${d.getDate()}`
        return { d: DIAS_ES[d.getDay()], v: acc[key] || 0 }
      })
    }

    // Mes: group by calendar week
    return [1, 8, 15, 22].map((start, wi) => {
      let total = 0
      for (let day = start; day < start + 7 && day <= 30; day++) {
        total += acc[`${HOY.getMonth()}-${day}`] || 0
      }
      return { d: `Sem ${wi + 1}`, v: total }
    })
  }, [ventasFiltradas, periodo, data.ventas])

  const MESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const periodoLabel = periodo === 'Semana' ? 'Últimos 7 días' : periodo === 'Mes' ? `${MESES_LARGO[HOY.getMonth()]} ${HOY.getFullYear()}` : `Año ${HOY.getFullYear()}`

  return (
    <div>
      {/* Header */}
      <div className="between" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="display" style={{ fontSize: 26, margin: 0 }}>Finanzas</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Reportes de ingresos, costos y utilidad · {periodoLabel}</div>
        </div>
        <div className="vc gap12">
          <Seg opts={['Semana', 'Mes', 'Año']} value={periodo} onChange={setPeriodo} />
          <button className="btn ghost" onClick={() => {
            const encabezado = 'Ticket,Fecha,Cliente,Tipo,Pago,Subtotal,Descuento,Anticipo,Total,Estado'
            const filas = ventasFiltradas.map(v => {
              const sub = v.lineas.reduce((s,l)=>s+l.precio*l.cant,0)
              const total = sub - v.desc
              const tipos = [...new Set(v.lineas.map(l=>l.tipo))].join('+')
              return [v.ticket,v.fecha,`"${v.cliente}"`,tipos,v.pago,sub,v.desc,v.anticipo,total,v.estado].join(',')
            })
            const csv = [encabezado,...filas].join('\n')
            const fecha = new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'})
            const a = document.createElement('a')
            a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}))
            a.download = `finanzas-${periodo.toLowerCase()}-${fecha.replace(/\s/g,'-')}.csv`
            a.click()
            toast(`Reporte exportado · ${ventasFiltradas.length} ventas`)
          }}><Ic n="export" />Exportar CSV</button>
        </div>
      </div>

      {/* Row 1: Utilidad + Bar chart */}
      <div className="grid" style={{ gridTemplateColumns: '1fr 2fr', marginBottom: 18 }}>
        <div className="card gold-edge card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="eyebrow">Utilidad estimada</div>
          <div className="num gold-text" style={{ fontFamily: 'var(--serif)', fontSize: 40, fontWeight: 600, lineHeight: 1 }}>{mxn(utilidad)}</div>
          <div className="vc gap6" style={{ fontSize: 12.5, color: 'var(--st-conf)' }}>
            <Ic n="trend-up" size={16} />Ingresos − gastos − comisiones
          </div>
          <div style={{ marginTop: 6 }}>
            <div className="between" style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 4 }}>
              <span>Margen</span><span className="num">{margen}%</span>
            </div>
            <div className="bar"><span style={{ width: margen + '%', background: 'var(--gold-grad)' }}></span></div>
          </div>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>Margen neto sobre ingresos del periodo</div>
        </div>
        <div className="card">
          <CardHead title="Ingresos por periodo" sub={periodoLabel} />
          <div className="card-pad" style={{ paddingTop: 12 }}>
            <BarChart data={barData} highlightLast />
          </div>
        </div>
      </div>

      {/* Row 2: KPI cards */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: 18 }}>
        {[
          { ic: 'arrow-down-left', label: 'Ingresos servicios', val: ingServicio,  color: 'var(--st-conf)' },
          { ic: 'shopping-bag',   label: 'Ingresos productos', val: ingProducto,   color: 'var(--gold)' },
          { ic: 'arrow-up-right', label: 'Gastos operativos',  val: gastos,        color: 'var(--st-canc)' },
          { ic: 'hand-coins',     label: 'Anticipos recibidos',val: antReal,        color: '#8FB2D8' },
          { ic: 'users-three',    label: 'Comisiones equipo',  val: comReal,        color: 'var(--st-pend)' },
        ].map(item => (
          <div key={item.label} className="card card-pad">
            <div className="vc gap10" style={{ marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', border: '1px solid var(--line-soft)', color: item.color, flex: '0 0 36px' }}>
                <Ic n={item.ic} />
              </div>
            </div>
            <div className="dim" style={{ fontSize: 11.5, marginBottom: 4 }}>{item.label}</div>
            <div className="num" style={{ fontWeight: 700, fontSize: 18, color: item.color }}>{mxn(item.val)}</div>
          </div>
        ))}
      </div>

      {/* Row 3: Donut + Mezcla */}
      <div className="grid" style={{ gridTemplateColumns: '1fr 1.25fr', marginBottom: 18 }}>
        <div className="card">
          <CardHead title="Servicio vs. producto" sub="Composición de ventas" />
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16 }}>
            {desgloseData.length > 0
              ? <>
                  <Donut data={desgloseData} />
                  <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {desgloseData.map(d => (
                      <div key={d.cat} className="vc gap6">
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.c }} />
                        <span style={{ fontSize: 12 }}>{d.cat}</span>
                      </div>
                    ))}
                  </div>
                </>
              : <div className="center dim" style={{ padding: '48px 0', fontSize: 12.5 }}>Sin ventas en el periodo seleccionado</div>
            }
          </div>
        </div>
        <div className="card">
          <CardHead title="Mezcla de ingresos" sub="Por tipo de venta" />
          <div className="card-pad" style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {desgloseData.length > 0
              ? desgloseData.map(d => {
                  const pct = ingTotal > 0 ? Math.round(d.v / ingTotal * 100) : 0
                  return (
                    <div key={d.cat}>
                      <div className="between" style={{ marginBottom: 6 }}>
                        <div className="vc gap8">
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.c }} />
                          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{d.cat}</span>
                        </div>
                        <div className="vc gap12">
                          <span className="num" style={{ fontSize: 13.5, fontWeight: 600 }}>{mxn(d.v)}</span>
                          <span className="muted" style={{ fontSize: 12, minWidth: 36, textAlign: 'right' }}>{pct}%</span>
                        </div>
                      </div>
                      <div className="bar"><span style={{ width: pct + '%', background: d.c }} /></div>
                    </div>
                  )
                })
              : <div className="dim" style={{ fontSize: 12.5 }}>Sin ventas en el periodo seleccionado</div>
            }
            {desgloseData.length > 0 && (
              <>
                <hr className="hr" />
                <div className="between">
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Total</span>
                  <span className="num gold-text" style={{ fontWeight: 700, fontSize: 16 }}>{mxn(ingTotal)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Category donut + Top services */}
      <div className="grid" style={{ gridTemplateColumns: '1fr 1.25fr', marginBottom: 18 }}>
        <div className="card">
          <CardHead title="Ingresos por categoría" sub="Distribución de servicios" />
          {categorias.length > 0
            ? <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16 }}>
                <Donut data={categorias} />
                <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {categorias.map(d => (
                    <div key={d.cat} className="vc gap6">
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.c }} />
                      <span style={{ fontSize: 11.5 }}>{d.cat}</span>
                    </div>
                  ))}
                </div>
              </div>
            : <div className="card-pad dim" style={{ fontSize: 12.5 }}>Sin datos suficientes para este periodo.</div>
          }
        </div>
        <div className="card">
          <CardHead title="Servicios más vendidos" sub="Ingresos generados · periodo seleccionado" />
          {topServicios.length > 0
            ? <table className="table" style={{ marginTop: 6 }}>
                <thead>
                  <tr>
                    <th>Servicio</th>
                    <th className="num">Veces</th>
                    <th className="num">Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {topServicios.map((s, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{s.srv}</td>
                      <td className="num">{s.n}</td>
                      <td className="num gold-text" style={{ fontWeight: 600 }}>{mxn(s.ingreso)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            : <div className="card-pad dim" style={{ fontSize: 12.5 }}>Sin datos suficientes para este periodo.</div>
          }
        </div>
      </div>

      {/* Row 5: Gastos */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">Gastos operativos</div>
            <h3 style={{ marginTop: 4 }}>Egresos del periodo · {periodoLabel}</h3>
          </div>
          <button className="btn ghost" onClick={() => setShowGastoModal(true)}><Ic n="plus" />Registrar gasto</button>
        </div>
        {gastosFiltrados.length === 0
          ? <div className="card-pad dim" style={{ fontSize: 12.5 }}>Sin gastos registrados en el periodo. Usa el botón para agregar uno.</div>
          : <table className="table">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Categoría</th>
                  <th>Fecha</th>
                  <th className="num">Monto</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {gastosFiltrados.map(g => (
                  <tr key={g.id}>
                    <td style={{ fontWeight: 600 }}>{g.concepto}</td>
                    <td><span style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 20, background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}>{g.categoria}</span></td>
                    <td className="muted" style={{ fontSize: 12.5 }}>{g.fecha}</td>
                    <td className="num" style={{ fontWeight: 600, color: 'var(--st-canc)' }}>{mxn(g.monto)}</td>
                    <td>
                      <button className="icon-btn" style={{ color: 'var(--st-canc)' }} onClick={async () => {
                        try { await deleteGasto(g.id); toast('Gasto eliminado') }
                        catch { toast('No se pudo eliminar el gasto. Intenta de nuevo.') }
                      }}>
                        <Ic n="trash" size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
        {gastosFiltrados.length > 0 && (
          <div className="card-pad" style={{ paddingTop: 10, borderTop: '1px solid var(--line-soft)', display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 12.5 }}>Total gastos</span>
            <span className="num" style={{ fontWeight: 700, fontSize: 16, color: 'var(--st-canc)' }}>{mxn(gastos)}</span>
          </div>
        )}
      </div>

      {showGastoModal && (
        <GastoModal
          onClose={() => setShowGastoModal(false)}
          onSave={async g => {
            try { await addGasto(g); setShowGastoModal(false); toast('Gasto registrado') }
            catch { toast('No se pudo registrar el gasto. Intenta de nuevo.') }
          }}
        />
      )}

      {/* Row 6: Anticipos + Utilidad resumen */}
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card">
          <CardHead title="Anticipos del periodo" sub={periodoLabel} />
          <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, paddingTop: 14 }}>
            {(() => {
              const vConAnticipo = ventasFiltradas.filter(v => v.anticipo > 0)
              const aplicados = vConAnticipo.filter(v => v.estado === 'pagada').reduce((s, v) => s + v.anticipo, 0)
              const pendientes = vConAnticipo.filter(v => v.estado === 'parcial').reduce((s, v) => s + v.anticipo, 0)
              return [
                { label: 'Recibidos',     val: antReal,    color: 'var(--st-conf)' },
                { label: 'Aplicados',     val: aplicados,  color: 'var(--gold)' },
                { label: 'Pendientes',    val: pendientes, color: 'var(--st-pend)' },
                { label: 'Reembolsados',  val: 0,          color: 'var(--text-3)' },
              ].map(item => (
                <div key={item.label} className="card" style={{ padding: 14 }}>
                  <div className="dim" style={{ fontSize: 11.5, marginBottom: 6 }}>{item.label}</div>
                  <div className="num" style={{ fontWeight: 700, fontSize: 20, color: item.color }}>{mxn(item.val)}</div>
                </div>
              ))
            })()}
          </div>
        </div>
        <div className="card">
          <CardHead title="Resumen de utilidad" sub={periodoLabel} />
          <div className="card-pad" style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Ingresos totales',   val: ingTotal, dir: 'pos' },
              { label: 'Gastos operativos',  val: -gastos,  dir: 'neg' },
              { label: 'Comisiones equipo',  val: -comReal, dir: 'neg' },
            ].map(row => (
              <div key={row.label} className="between" style={{ fontSize: 13.5 }}>
                <span className="muted">{row.label}</span>
                <span className="num" style={{ fontWeight: 600, color: row.dir === 'neg' ? 'var(--st-canc)' : undefined }}>
                  {row.val < 0 ? '−' : ''}{mxn(Math.abs(row.val))}
                </span>
              </div>
            ))}
            <hr className="hr" />
            <div className="between">
              <span style={{ fontWeight: 700, fontFamily: 'var(--serif)', fontSize: 16 }}>Utilidad estimada</span>
              <span className="num gold-text" style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600 }}>{mxn(utilidad)}</span>
            </div>
            <div className="bar" style={{ marginTop: 4 }}>
              <span style={{ width: margen + '%', background: 'var(--gold-grad)' }} />
            </div>
            <div className="muted" style={{ fontSize: 11.5, textAlign: 'right' }}>
              {margen}% de margen neto · gastos operativos son estimados
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

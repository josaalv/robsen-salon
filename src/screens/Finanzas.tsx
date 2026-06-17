import React, { useState } from 'react'
import { CardHead, Seg, Donut, BarChart, toast } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { useStore } from '../data/store'
import { mxn, ventaCalc } from '../lib/helpers'

export function ScreenFinanzas({ onNavigate }: { onNavigate: (r: string) => void }) {
  const { data } = useStore()
  const [periodo, setPeriodo] = useState('Mes')

  const f = data.finanzas
  const total = f.ingresosServicio + f.ingresosProducto

  const desglose = data.ventas.reduce((a, v) => {
    a.servicio += ventaCalc.porTipo(v, 'servicio')
    a.producto += ventaCalc.porTipo(v, 'producto')
    a.adicional += ventaCalc.porTipo(v, 'adicional')
    return a
  }, { servicio: 0, producto: 0, adicional: 0 })

  const desgloseData = [
    { cat: 'Servicios', v: desglose.servicio, c: '#C8A14A' },
    { cat: 'Productos', v: desglose.producto, c: '#93B58C' },
    { cat: 'Adicionales', v: desglose.adicional, c: '#B08AC7' },
  ].filter(d => d.v > 0)

  const totalTickets = desglose.servicio + desglose.producto + desglose.adicional

  return (
    <div>
      {/* Header */}
      <div className="between" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="display" style={{ fontSize: 26, margin: 0 }}>Finanzas</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Reportes de ingresos, costos y utilidad · Junio 2026</div>
        </div>
        <div className="vc gap12">
          <Seg opts={['Semana', 'Mes', 'Año']} value={periodo} onChange={setPeriodo} />
          <button className="btn ghost" onClick={() => toast('Reporte exportado (PDF)')}><Ic n="export" />Exportar</button>
        </div>
      </div>

      {/* Row 1: Utilidad + Bar chart */}
      <div className="grid" style={{ gridTemplateColumns: '1fr 2fr', marginBottom: 18 }}>
        <div className="card gold-edge card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="eyebrow">Utilidad neta</div>
          <div className="num gold-text" style={{ fontFamily: 'var(--serif)', fontSize: 40, fontWeight: 600, lineHeight: 1 }}>{mxn(f.utilidad)}</div>
          <div className="vc gap6" style={{ fontSize: 12.5, color: 'var(--st-conf)' }}>
            <Ic n="trend-up" size={16} />+11.3% vs. mayo
          </div>
          <div style={{ marginTop: 6 }}>
            <div className="between" style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 4 }}>
              <span>Margen</span><span className="num">64%</span>
            </div>
            <div className="bar"><span style={{ width: '64%', background: 'var(--gold-grad)' }}></span></div>
          </div>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>Margen neto sobre ingresos totales</div>
        </div>
        <div className="card">
          <CardHead title="Ingresos vs. gastos" sub="Comparativo semanal · Junio 2026" />
          <div className="card-pad" style={{ paddingTop: 12 }}>
            <BarChart data={data.ventas7} highlightLast />
          </div>
        </div>
      </div>

      {/* Row 2: KPI cards */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: 18 }}>
        {[
          { ic: 'arrow-down-left', label: 'Ingresos servicios', val: f.ingresosServicio, color: 'var(--st-conf)' },
          { ic: 'shopping-bag', label: 'Ingresos productos', val: f.ingresosProducto, color: 'var(--gold)' },
          { ic: 'arrow-up-right', label: 'Gastos operativos', val: f.gastos, color: 'var(--st-canc)' },
          { ic: 'hand-coins', label: 'Anticipos recibidos', val: f.anticipos, color: '#8FB2D8' },
          { ic: 'users-three', label: 'Comisiones pagadas', val: f.comisiones, color: 'var(--st-pend)' },
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
            <Donut data={desgloseData} />
            <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
              {desgloseData.map(d => (
                <div key={d.cat} className="vc gap6">
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.c }} />
                  <span style={{ fontSize: 12 }}>{d.cat}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card">
          <CardHead title="Mezcla de ingresos" sub="Por tipo de venta" />
          <div className="card-pad" style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {desgloseData.map(d => {
              const pct = totalTickets > 0 ? Math.round(d.v / totalTickets * 100) : 0
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
            })}
            <hr className="hr" />
            <div className="between">
              <span style={{ fontWeight: 700, fontSize: 14 }}>Total</span>
              <span className="num gold-text" style={{ fontWeight: 700, fontSize: 16 }}>{mxn(totalTickets)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Category donut + Top services */}
      <div className="grid" style={{ gridTemplateColumns: '1fr 1.25fr', marginBottom: 18 }}>
        <div className="card">
          <CardHead title="Ingresos por categoría" sub="Distribución de servicios" />
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16 }}>
            <Donut data={data.ingresosPorCategoria.map(d => ({ cat: d.cat, v: d.v, c: d.c }))} />
            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
              {data.ingresosPorCategoria.map(d => (
                <div key={d.cat} className="vc gap6">
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.c }} />
                  <span style={{ fontSize: 11.5 }}>{d.cat}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card">
          <CardHead title="Servicios más vendidos" sub="Ingresos generados · mes actual" />
          <table className="table" style={{ marginTop: 6 }}>
            <thead>
              <tr>
                <th>Servicio</th>
                <th className="num">Veces</th>
                <th className="num">Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {data.servMasVendidos.map((s, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{s.srv}</td>
                  <td className="num">{s.n}</td>
                  <td className="num gold-text" style={{ fontWeight: 600 }}>{mxn(s.ingreso)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 5: Anticipos + Utilidad resumen */}
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card">
          <CardHead title="Anticipos del periodo" sub="Flujo de anticipos" />
          <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, paddingTop: 14 }}>
            {[
              { label: 'Recibidos', val: f.anticipos, color: 'var(--st-conf)' },
              { label: 'Aplicados', val: Math.round(f.anticipos * 0.72), color: 'var(--gold)' },
              { label: 'Pendientes', val: Math.round(f.anticipos * 0.28), color: 'var(--st-pend)' },
              { label: 'Reembolsados', val: 0, color: 'var(--text-3)' },
            ].map(item => (
              <div key={item.label} className="card" style={{ padding: 14 }}>
                <div className="dim" style={{ fontSize: 11.5, marginBottom: 6 }}>{item.label}</div>
                <div className="num" style={{ fontWeight: 700, fontSize: 20, color: item.color }}>{mxn(item.val)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <CardHead title="Resumen de utilidad" sub="Junio 2026" />
          <div className="card-pad" style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Ingresos totales', val: total, dir: 'pos' },
              { label: 'Gastos operativos', val: -f.gastos, dir: 'neg' },
              { label: 'Comisiones pagadas', val: -f.comisiones, dir: 'neg' },
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
              <span style={{ fontWeight: 700, fontFamily: 'var(--serif)', fontSize: 16 }}>Utilidad neta</span>
              <span className="num gold-text" style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600 }}>{mxn(f.utilidad)}</span>
            </div>
            <div className="bar" style={{ marginTop: 4 }}>
              <span style={{ width: (total > 0 ? f.utilidad / total * 100 : 0) + '%', background: 'var(--gold-grad)' }} />
            </div>
            <div className="muted" style={{ fontSize: 11.5, textAlign: 'right' }}>
              {total > 0 ? Math.round(f.utilidad / total * 100) : 0}% de margen neto
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ROBSEN · Finanzas y reportes */
function ScreenFinanzas() {
  const RB = window.RB, f = RB.finanzas;
  const [periodo, setPeriodo] = useState('Mes');
  window.useVentas();
  const vc = window.ventaCalc;
  // Desglose en vivo a partir de los tickets registrados en el POS
  const desglose = RB.ventas.reduce((a, v) => {
    a.servicio += vc.porTipo(v, 'servicio');
    a.producto += vc.porTipo(v, 'producto');
    a.adicional += vc.porTipo(v, 'adicional');
    return a;
  }, { servicio: 0, producto: 0, adicional: 0 });
  const desgloseData = [
    { cat: 'Servicios', v: desglose.servicio, c: '#C8A14A' },
    { cat: 'Productos', v: desglose.producto, c: '#93B58C' },
    { cat: 'Adicionales', v: desglose.adicional, c: '#B08AC7' },
  ].filter(d => d.v > 0);
  const totalTickets = desglose.servicio + desglose.producto + desglose.adicional;

  return (
    <div>
      <div className="between" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="display" style={{ fontSize: 26, margin: 0 }}>Finanzas y reportes</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Resumen de junio 2026 · corte al 12 de junio</div>
        </div>
        <div className="vc gap12">
          <Seg opts={['Semana', 'Mes', 'Año']} value={periodo} onChange={setPeriodo} />
          <button className="btn ghost" onClick={() => toast('Reporte financiero exportado (Excel)', 'export')}><Ic n="export" />Exportar reporte</button>
        </div>
      </div>

      {/* KPIs financieros */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="card card-pad">
          <div className="eyebrow">Utilidad aproximada</div>
          <div className="display gold-text" style={{ fontSize: 40, margin: '10px 0 4px' }}>{mxn(f.utilidad)}</div>
          <div className="delta up"><Ic n="trend-up" />+11.3% vs. mayo</div>
          <div className="bar mt18"><span style={{ width: '64%' }}></span></div>
          <div className="dim mt10" style={{ fontSize: 11.5 }}>Margen del 38% sobre ingresos totales</div>
        </div>
        <div className="card card-pad" style={{ gridColumn: 'span 2' }}>
          <CardHead title="Comparativo mensual" sub="Ingresos últimos 6 meses" right={<span className="badge conf"><span className="d"></span>+5.6% mes actual</span>} />
          <div style={{ paddingTop: 18 }}><BarChart data={RB.ventasMes} h={170} highlightLast={true} fmt={v => '$' + (v / 1000).toFixed(0) + 'k'} /></div>
        </div>
      </div>

      {/* Desglose ingresos / egresos */}
      <div className="grid mt18" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
        {[['arrow-down-left', 'Ingresos servicios', f.ingresosServicio, 'var(--st-conf)'], ['shopping-bag', 'Ingresos producto', f.ingresosProducto, 'var(--gold)'], ['arrow-up-right', 'Gastos', f.gastos, 'var(--st-canc)'], ['hand-coins', 'Anticipos', f.anticipos, '#8FB2D8'], ['users-three', 'Comisiones', f.comisiones, 'var(--st-pend)']].map(([ic, l, v, c]) => (
          <div key={l} className="card card-pad">
            <div className="ico" style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line-soft)', color: c, marginBottom: 12 }}><Ic n={ic} /></div>
            <div className="kpi-mini"><span className="l">{l}</span><span className="v" style={{ fontSize: 21 }}>{mxn(v)}</span></div>
          </div>
        ))}
      </div>

      {/* Desglose servicio vs producto desde los tickets del POS */}
      <div className="grid mt18" style={{ gridTemplateColumns: '1fr 1.25fr' }}>
        <div className="card">
          <CardHead title="Servicio vs. producto" sub="En vivo desde los tickets de Ventas" right={<span className="badge conf"><span className="d"></span>POS</span>} />
          <div className="card-pad" style={{ paddingTop: 18 }}>
            {desgloseData.length ? <Donut data={desgloseData} /> : <div className="dim center" style={{ padding: 30 }}>Aún no hay ventas registradas</div>}
          </div>
        </div>
        <div className="card">
          <CardHead title="Mezcla de ingresos por ticket" sub="Participación de cada concepto" />
          <div className="card-pad" style={{ paddingTop: 16 }}>
            {[['Servicios', desglose.servicio, '#C8A14A', 'scissors'], ['Productos', desglose.producto, '#93B58C', 'package'], ['Adicionales', desglose.adicional, '#B08AC7', 'plus']].map(([l, val, c, ic]) => {
              const pct = totalTickets ? Math.round(val / totalTickets * 100) : 0;
              return (
                <div key={l} style={{ padding: '12px 0', borderBottom: '1px solid var(--line-soft)' }}>
                  <div className="between" style={{ marginBottom: 8 }}>
                    <span className="vc gap10"><span style={{ color: c }}><Ic n={ic} /></span><span style={{ fontWeight: 600, fontSize: 13.5 }}>{l}</span></span>
                    <span className="vc gap12"><span className="dim num" style={{ fontSize: 11.5 }}>{pct}%</span><span className="num" style={{ fontWeight: 600, minWidth: 78, textAlign: 'right' }}>{mxn(val)}</span></span>
                  </div>
                  <div className="bar"><span style={{ width: pct + '%', background: c }}></span></div>
                </div>
              );
            })}
            <div className="between" style={{ paddingTop: 14 }}>
              <span style={{ fontWeight: 700, fontFamily: 'var(--serif)', fontSize: 15 }}>Total facturado</span>
              <span className="num gold-text" style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600 }}>{mxn(totalTickets)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Donut + ingresos por servicio */}
      <div className="grid mt18" style={{ gridTemplateColumns: '1fr 1.25fr' }}>
        <div className="card">
          <CardHead title="Ingresos por categoría" sub="Distribución del mes" />
          <div className="card-pad" style={{ paddingTop: 18 }}><Donut data={RB.ingresosPorCategoria} /></div>
        </div>
        <div className="card">
          <CardHead title="Ingresos por servicio" sub="Top servicios facturados" right={<button className="btn sm ghost" onClick={() => toast('Filtros de reporte', 'funnel')}><Ic n="funnel" />Filtrar</button>} />
          <table className="table" style={{ marginTop: 6 }}>
            <thead><tr><th>Servicio</th><th className="num">Citas</th><th className="num">Ingreso</th><th>Participación</th></tr></thead>
            <tbody>{RB.servMasVendidos.map((s, i) => {
              const tot = RB.servMasVendidos.reduce((a, b) => a + b.ingreso, 0);
              const pct = Math.round(s.ingreso / tot * 100);
              return (
                <tr key={i}><td style={{ fontWeight: 600 }}>{s.srv}</td><td className="num muted">{s.n}</td><td className="num" style={{ fontWeight: 600 }}>{mxn(s.ingreso)}</td>
                  <td><div className="vc gap8"><div className="bar" style={{ width: 90 }}><span style={{ width: pct + '%' }}></span></div><span className="dim num" style={{ fontSize: 11.5 }}>{pct}%</span></div></td></tr>
              );
            })}</tbody>
          </table>
        </div>
      </div>

      {/* Anticipos + flujo */}
      <div className="grid mt18" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card card-pad">
          <CardHead title="Anticipos del periodo" sub="Recibidos vs. aplicados" />
          <div className="grid mt18" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card" style={{ background: 'var(--surface)', padding: 16 }}><div className="kpi-mini"><span className="l">Recibidos</span><span className="v gold-text">$54,800</span></div></div>
            <div className="card" style={{ background: 'var(--surface)', padding: 16 }}><div className="kpi-mini"><span className="l">Aplicados</span><span className="v">$41,200</span></div></div>
            <div className="card" style={{ background: 'var(--surface)', padding: 16 }}><div className="kpi-mini"><span className="l">Pendientes</span><span className="v" style={{ color: 'var(--st-pend)' }}>$13,600</span></div></div>
            <div className="card" style={{ background: 'var(--surface)', padding: 16 }}><div className="kpi-mini"><span className="l">Reembolsados</span><span className="v" style={{ color: 'var(--st-canc)' }}>$1,800</span></div></div>
          </div>
        </div>
        <div className="card card-pad">
          <CardHead title="Resumen de utilidad" sub="Cómo se forma el resultado" />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[['Ingresos por servicios', f.ingresosServicio, 'pos'], ['Ingresos por producto', f.ingresosProducto, 'pos'], ['Gastos operativos', -f.gastos, 'neg'], ['Comisiones del equipo', -f.comisiones, 'neg']].map(([l, v, t]) => (
              <div key={l} className="between" style={{ padding: '13px 0', borderBottom: '1px solid var(--line-soft)' }}>
                <span className="muted" style={{ fontSize: 13.5 }}>{l}</span>
                <span className="num" style={{ fontWeight: 600, color: t === 'neg' ? 'var(--neg)' : 'var(--pos)' }}>{t === 'neg' ? '−' : '+'}{mxn(Math.abs(v))}</span>
              </div>
            ))}
            <div className="between" style={{ padding: '16px 0 0' }}>
              <span style={{ fontWeight: 700, fontSize: 15, fontFamily: 'var(--serif)' }}>Utilidad neta</span>
              <span className="num gold-text" style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600 }}>{mxn(f.utilidad)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
window.ScreenFinanzas = ScreenFinanzas;

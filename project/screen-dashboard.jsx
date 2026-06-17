/* ROBSEN · Dashboard */
function ScreenDashboard() {
  const RB = window.RB;
  const proximas = RB.hoy.filter(a => ['conf', 'pay', 'pend'].includes(a.estado)).slice(0, 6);

  return (
    <div>
      {/* Hero saludo */}
      <div className="between" style={{ marginBottom: 24 }}>
        <div>
          <div className="eyebrow">Jueves · 12 de junio, 2026</div>
          <h1 className="display" style={{ fontSize: 30, margin: '8px 0 0' }}>Buen día, <span className="gold-text">Robsen</span></h1>
          <div className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>Tienes <b style={{ color: 'var(--text)' }}>10 citas</b> hoy · 3 por confirmar · 5 anticipos pendientes de cobro.</div>
        </div>
        <div className="vc gap12">
          <button className="btn ghost" onClick={() => toast('Reporte del día exportado (PDF)', 'export')}><Ic n="export" />Exportar</button>
          <button className="btn gold" onClick={() => { window.RBnuevaCita = true; window.RBgo('agenda'); }}><Ic n="plus" />Nueva cita</button>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <Stat icon="currency-circle-dollar" label="Ventas de hoy" value="$28,450" delta="+12.4%" deltaDir="up" spark={[12, 18, 14, 22, 19, 26, 28]} />
        <Stat icon="calendar-check" label="Ventas de la semana" value="$173,300" delta="+8.1%" deltaDir="up" spark={[18, 22, 16, 27, 34, 41, 12]} />
        <Stat icon="chart-line-up" label="Ventas del mes" value="$486,000" delta="+5.6%" deltaDir="up" spark={[41, 43, 40, 47, 51, 48]} />
        <Stat icon="receipt" label="Ticket promedio" value="$1,640" delta="+3.2%" deltaDir="up" spark={[14, 15, 13, 16, 16, 17]} />
      </div>

      {/* Fila secundaria de KPIs */}
      <div className="grid mt18" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="card card-pad vc gap16">
          <div className="ico" style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(147,181,140,0.12)', border: '1px solid rgba(147,181,140,0.28)', color: 'var(--st-conf)' }}><Ic n="check-circle" /></div>
          <div className="kpi-mini"><span className="l">Citas confirmadas</span><span className="v">14</span></div>
        </div>
        <div className="card card-pad vc gap16">
          <div className="ico" style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(217,164,65,0.12)', border: '1px solid rgba(217,164,65,0.28)', color: 'var(--st-pend)' }}><Ic n="clock-countdown" /></div>
          <div className="kpi-mini"><span className="l">Por confirmar</span><span className="v">3</span></div>
        </div>
        <div className="card card-pad vc gap16">
          <div className="ico" style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(200,161,74,0.12)', border: '1px solid var(--line)', color: 'var(--gold)' }}><Ic n="hand-coins" /></div>
          <div className="kpi-mini"><span className="l">Anticipos recibidos</span><span className="v">$5,400</span></div>
        </div>
        <div className="card card-pad vc gap16">
          <div className="ico" style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(111,150,184,0.12)', border: '1px solid rgba(111,150,184,0.28)', color: '#8FB2D8' }}><Ic n="user-plus" /></div>
          <div className="kpi-mini"><span className="l">Clientas · nuevas / recurrentes</span><span className="v">6 <span style={{ color: 'var(--text-3)', fontSize: 15 }}>/ 22</span></span></div>
        </div>
      </div>

      {/* Fila gráfica + próximas citas */}
      <div className="grid mt18" style={{ gridTemplateColumns: '1.55fr 1fr' }}>
        {/* Ventas semana */}
        <div className="card">
          <CardHead title="Ventas de la semana" sub="Lun 8 – Dom 14 de junio"
            right={<Seg opts={['Semana', 'Mes']} value="Semana" onChange={() => { }} />} />
          <div className="card-pad" style={{ paddingTop: 14 }}>
            <div className="vc gap24" style={{ marginBottom: 6 }}>
              <div className="kpi-mini"><span className="l">Total semana</span><span className="v gold-text">$173,300</span></div>
              <div className="kpi-mini"><span className="l">Mejor día</span><span className="v">Sábado</span></div>
              <div className="kpi-mini"><span className="l">vs. semana previa</span><span className="v" style={{ color: 'var(--pos)' }}>+8.1%</span></div>
            </div>
            <BarChart data={RB.ventas7} h={210} highlightLast={false} />
          </div>
        </div>

        {/* Próximas citas */}
        <div className="card">
          <CardHead title="Próximas citas de hoy" right={<span className="badge neutral">{RB.hoy.length} hoy</span>} />
          <div className="card-pad" style={{ paddingTop: 10 }}>
            <div className="list">
              {proximas.map(a => {
                const e = getEst(a.est);
                return (
                  <div key={a.id} className="list-item">
                    <div style={{ textAlign: 'center', minWidth: 46 }}>
                      <div className="num" style={{ fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 600 }}>{a.h}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-4)' }}>{a.dur} min</div>
                    </div>
                    <div style={{ width: 1, height: 34, background: 'var(--line-soft)' }}></div>
                    <div className="f1" style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{a.cl}</div>
                      <div className="vc" style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, gap: 7 }}>
                        <span className="dotc" style={{ background: e.color }}></span>{a.srv}
                      </div>
                    </div>
                    <EstadoBadge k={a.estado} />
                  </div>
                );
              })}
            </div>
            <button className="btn ghost w100 mt14" style={{ justifyContent: 'center' }} onClick={() => window.RBgo('agenda')}>Ver agenda completa<Ic n="arrow-right" /></button>
          </div>
        </div>
      </div>

      {/* Fila inferior: servicios + alertas */}
      <div className="grid mt18" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Servicios más vendidos */}
        <div className="card">
          <CardHead title="Servicios más vendidos" sub="Este mes" />
          <div className="card-pad" style={{ paddingTop: 12 }}>
            {RB.servMasVendidos.map((s, i) => {
              const max = RB.servMasVendidos[0].ingreso;
              return (
                <div key={i} style={{ padding: '11px 0', borderBottom: i < 4 ? '1px solid var(--line-soft)' : 'none' }}>
                  <div className="between" style={{ marginBottom: 8 }}>
                    <div className="vc gap12">
                      <span style={{ fontFamily: 'var(--serif)', color: 'var(--gold)', fontSize: 15, width: 18 }}>{i + 1}</span>
                      <span style={{ fontWeight: 600, fontSize: 13.5 }}>{s.srv}</span>
                    </div>
                    <div className="vc gap12">
                      <span className="badge neutral">{s.n} citas</span>
                      <span className="num" style={{ fontWeight: 600, minWidth: 78, textAlign: 'right' }}>{mxn(s.ingreso)}</span>
                    </div>
                  </div>
                  <div className="bar"><span style={{ width: (s.ingreso / max * 100) + '%' }}></span></div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alertas */}
        <div className="card">
          <CardHead title="Alertas importantes" right={<span className="badge pend"><span className="d"></span>4 nuevas</span>} />
          <div className="card-pad" style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div className="alert bad">
              <div className="ai"><Ic n="warning" /></div>
              <div className="f1"><div className="at">3 citas sin confirmar</div><div className="as">Isabela Carmona, Mariana del Río y Paulina Cervantes para hoy.</div></div>
              <button className="btn sm line" onClick={() => window.RBgo('whatsapp')}>Confirmar</button>
            </div>
            <div className="alert warn">
              <div className="ai"><Ic n="hourglass-medium" /></div>
              <div className="f1"><div className="at">5 pagos pendientes de cobro</div><div className="as">Saldo por cobrar en servicios completados hoy · $7,310.</div></div>
              <button className="btn sm ghost" onClick={() => window.RBgo('ventas')}>Ver</button>
            </div>
            <div className="alert warn">
              <div className="ai"><Ic n="user-minus" /></div>
              <div className="f1"><div className="at">8 clientas inactivas (+60 días)</div><div className="as">Daniela Esquivel y Sofía Carrillo entre las VIP en riesgo.</div></div>
              <button className="btn sm line" onClick={() => window.RBgo('whatsapp')}>Reactivar</button>
            </div>
            <div className="alert info">
              <div className="ai"><Ic n="star" /></div>
              <div className="f1"><div className="at">2 reseñas nuevas de 5★</div><div className="as">Camila Núñez y Ana Sofía Beltrán dejaron reseña.</div></div>
              <button className="btn sm ghost" onClick={() => toast('Reseñas abiertas', 'star')}>Ver</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
window.ScreenDashboard = ScreenDashboard;

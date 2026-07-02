/* ROBSEN · App shell + router + autenticación por rol */
const NAV = [
  { grupo: 'Principal', items: [
    { id: 'dashboard', label: 'Dashboard', icon: 'squares-four', title: 'Dashboard', sub: 'Resumen general del salón' },
    { id: 'agenda', label: 'Agenda', icon: 'calendar-blank', title: 'Agenda', sub: 'Citas y disponibilidad' },
    { id: 'ventas', label: 'Ventas', icon: 'cash-register', title: 'Ventas', sub: 'Punto de venta y tickets' },
    { id: 'crm', label: 'Clientas', icon: 'users', title: 'CRM de clientas', sub: 'Base de clientas y perfiles' },
    { id: 'servicios', label: 'Servicios', icon: 'scissors', title: 'Servicios', sub: 'Catálogo y paquetes' },
    { id: 'productos', label: 'Productos', icon: 'package', title: 'Productos e inventario', sub: 'Inventario, ventas y movimientos' },
    { id: 'empleados', label: 'Empleados', icon: 'identification-badge', title: 'Empleados', sub: 'Equipo y comisiones' },
  ]},
  { grupo: 'Gestión', items: [
    { id: 'finanzas', label: 'Finanzas', icon: 'chart-line-up', title: 'Finanzas', sub: 'Reportes e ingresos' },
    { id: 'whatsapp', label: 'Seguimiento', icon: 'whatsapp-logo', title: 'Seguimiento', sub: 'Mensajes y recordatorios', badge: 3 },
  ]},
  { grupo: 'Sistema', items: [
    { id: 'ajustes', label: 'Ajustes', icon: 'gear-six', title: 'Ajustes', sub: 'Configuración y permisos' },
    { id: 'booking', label: 'Agendamiento en línea', icon: 'calendar-plus', title: '', sub: '' },
  ]},
];
const ALL = NAV.flatMap(g => g.items);

function App() {
  const RB = window.RB;
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rb_user') || 'null'); } catch (e) { return null; }
  });
  const [route, setRoute] = useState('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [topPop, setTopPop] = useState(null); // 'agenda' | 'notif' | null
  const [logo, setLogo] = useState(() => localStorage.getItem('rb_logo') || '');

  useEffect(() => { window.RBgo = setRoute; }, []);
  useEffect(() => {
    window.RBsetLogo = (data) => { localStorage.setItem('rb_logo', data || ''); setLogo(data || ''); };
    window.RBgetLogo = () => localStorage.getItem('rb_logo') || '';
  }, []);
  useEffect(() => { window.scrollTo(0, 0); setMenuOpen(false); setTopPop(null); }, [route]);

  const login = (u) => { localStorage.setItem('rb_user', JSON.stringify(u)); setUser(u); setRoute('dashboard'); };
  const logout = () => { localStorage.removeItem('rb_user'); setUser(null); setMenuOpen(false); };

  // Gate de autenticación
  if (!user) return <React.Fragment><ScreenLogin onLogin={login} /><ToastHost /></React.Fragment>;

  const rol = RB.roles[user.rol] || RB.roles.admin;
  const can = (id) => rol.allow === '*' || rol.allow.includes(id);

  // Si la ruta actual no está permitida para el rol, redirige
  const effRoute = can(route) ? route : 'dashboard';
  const meta = ALL.find(i => i.id === effRoute) || ALL[0];

  const Screen = {
    dashboard: window.ScreenDashboard, agenda: window.ScreenAgenda, crm: window.ScreenCRM,
    ventas: window.ScreenVentas,
    servicios: window.ScreenServicios, empleados: window.ScreenEmpleados,
    productos: window.ScreenProductos,
    finanzas: window.ScreenFinanzas, whatsapp: window.ScreenWhatsApp,
    ajustes: window.ScreenAjustes, booking: window.ScreenBooking,
  }[effRoute];

  // Vista pública a pantalla completa
  if (effRoute === 'booking') {
    return (
      <div style={{ position: 'relative' }}>
        <button className="btn ghost sm" style={{ position: 'fixed', top: 20, right: 20, zIndex: 50 }} onClick={() => setRoute('dashboard')}><Ic n="arrow-left" />Volver al panel</button>
        <Screen />
        <ToastHost />
      </div>
    );
  }

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          {logo
            ? <img src={logo} alt="Robsen" className="brand-logo-img" />
            : <div className="logo">Robsen</div>}
          <div className="sub">Salón &amp; Spa · Interno</div>
        </div>
        <nav className="nav">
          {NAV.map(g => {
            const items = g.items.filter(it => can(it.id));
            if (!items.length) return null;
            return (
              <React.Fragment key={g.grupo}>
                <div className="nav-label">{g.grupo}</div>
                {items.map(it => (
                  <div key={it.id} className={'nav-item' + (effRoute === it.id ? ' active' : '')} onClick={() => setRoute(it.id)}>
                    <Ic n={it.icon} />{it.label}
                    {it.badge && <span className="badge-dot">{it.badge}</span>}
                    {it.id === 'booking' && <Ic n="arrow-up-right" />}
                  </div>
                ))}
              </React.Fragment>
            );
          })}
        </nav>
        <div className="side-foot" style={{ position: 'relative' }}>
          {menuOpen && (
            <React.Fragment>
              <div style={{ position: 'fixed', inset: 0, zIndex: 30 }} onClick={() => setMenuOpen(false)}></div>
              <div className="card gold-edge" style={{ position: 'absolute', bottom: 70, left: 14, right: 14, zIndex: 31, padding: 6, boxShadow: 'var(--sh-lg)' }}>
                <div className="nav-item" onClick={() => setRoute('ajustes')}><Ic n="gear-six" />Ajustes</div>
                <div className="nav-item" onClick={logout}><Ic n="user-switch" />Cambiar de cuenta</div>
                <hr className="hr" style={{ margin: '4px 8px' }} />
                <div className="nav-item" style={{ color: 'var(--st-canc)' }} onClick={logout}><Ic n="sign-out" />Cerrar sesión</div>
              </div>
            </React.Fragment>
          )}
          <div className="user-chip" onClick={() => setMenuOpen(v => !v)}>
            <Avatar ini={user.ini} color={user.color} />
            <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{user.nombre}</div><div className="dim" style={{ fontSize: 11 }}>{rol.nombre}</div></div>
            <Ic n="caret-up-down" />
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="main">
        <header className="topbar">
          <div><div className="page-title">{meta.title}</div><div className="page-sub">{meta.sub}</div></div>
          <div className="spacer"></div>
          <div className="search"><Ic n="magnifying-glass" /><input placeholder="Buscar clienta, cita o servicio…" /></div>

          {/* Agenda rápida */}
          <div style={{ position: 'relative' }}>
            <button className={'icon-btn' + (topPop === 'agenda' ? ' on' : '')} title="Agenda de hoy" onClick={() => setTopPop(p => p === 'agenda' ? null : 'agenda')}><Ic n="calendar-blank" /></button>
            {topPop === 'agenda' && <AgendaPop onClose={() => setTopPop(null)} go={setRoute} />}
          </div>
          {/* Notificaciones */}
          <div style={{ position: 'relative' }}>
            <button className={'icon-btn' + (topPop === 'notif' ? ' on' : '')} title="Notificaciones" onClick={() => setTopPop(p => p === 'notif' ? null : 'notif')}><span className="dot"></span><Ic n="bell" /></button>
            {topPop === 'notif' && <NotifPop onClose={() => setTopPop(null)} go={setRoute} />}
          </div>
        </header>
        <div className="content">
          <div className="screen active">{Screen ? <Screen user={user} /> : null}</div>
        </div>
      </div>
      <ToastHost />
    </div>
  );
}
/* ===== Popover: Agenda de hoy ===== */
function AgendaPop({ onClose, go }) {
  const proximas = window.RB.hoy.slice(0, 5);
  return (
    <React.Fragment>
      <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={onClose}></div>
      <div className="card gold-edge top-pop" onClick={e => e.stopPropagation()}>
        <div className="card-head" style={{ padding: '16px 18px 0' }}><div><div className="eyebrow">Hoy · 12 jun</div><h3 style={{ marginTop: 4, fontSize: 17 }}>Próximas citas</h3></div><span className="badge neutral">{window.RB.hoy.length}</span></div>
        <div style={{ padding: '12px 18px 8px', maxHeight: 320, overflowY: 'auto' }}>
          {proximas.map(a => {
            const e = getEst(a.est);
            return (
              <div key={a.id} className="list-item" style={{ padding: '11px 0' }}>
                <div style={{ textAlign: 'center', minWidth: 42 }}><div className="num" style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600 }}>{a.h}</div></div>
                <div style={{ width: 1, height: 28, background: 'var(--line-soft)' }}></div>
                <div className="f1" style={{ minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{a.cl}</div><div className="vc" style={{ fontSize: 11, color: 'var(--text-3)', gap: 6, marginTop: 1 }}><span className="dotc" style={{ background: e.color }}></span>{a.srv}</div></div>
                <EstadoBadge k={a.estado} />
              </div>
            );
          })}
        </div>
        <hr className="hr" />
        <div style={{ padding: 12 }}><button className="btn ghost w100" style={{ justifyContent: 'center' }} onClick={() => { go('agenda'); onClose(); }}>Ver agenda completa<Ic n="arrow-right" /></button></div>
      </div>
    </React.Fragment>
  );
}

/* ===== Popover: Notificaciones ===== */
function NotifPop({ onClose, go }) {
  const [items, setItems] = useState([
    { id: 'n1', ic: 'warning', tone: 'bad', t: '3 citas sin confirmar', s: 'Para hoy · Isabela, Mariana y Paulina', to: 'whatsapp', leido: false },
    { id: 'n2', ic: 'package', tone: 'warn', t: 'Stock bajo en 2 productos', s: 'Bain Satin y Oxidante 20 vol', to: 'productos', leido: false },
    { id: 'n3', ic: 'hand-coins', tone: 'warn', t: '5 pagos pendientes de cobro', s: 'Saldo por cobrar · $7,310', to: 'ventas', leido: false },
    { id: 'n4', ic: 'cash-register', tone: 'info', t: 'Venta registrada #1042', s: 'Ana Sofía Beltrán · $3,520', to: 'ventas', leido: true },
    { id: 'n5', ic: 'user-minus', tone: 'warn', t: '8 clientas inactivas (+60 días)', s: 'Sugerencia: campaña de reactivación', to: 'whatsapp', leido: true },
  ]);
  const sinLeer = items.filter(i => !i.leido).length;
  const toneCol = { bad: 'var(--st-canc)', warn: 'var(--st-pend)', info: 'var(--gold)' };
  return (
    <React.Fragment>
      <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={onClose}></div>
      <div className="card gold-edge top-pop" onClick={e => e.stopPropagation()}>
        <div className="card-head" style={{ padding: '16px 18px 0' }}><div><div className="eyebrow">{sinLeer} sin leer</div><h3 style={{ marginTop: 4, fontSize: 17 }}>Notificaciones</h3></div><button className="btn sm ghost" onClick={() => setItems(its => its.map(i => ({ ...i, leido: true })))}>Marcar leídas</button></div>
        <div style={{ padding: '12px 12px 8px', maxHeight: 360, overflowY: 'auto' }}>
          {items.map(n => (
            <div key={n.id} onClick={() => { go(n.to); onClose(); }} style={{ display: 'flex', gap: 12, padding: '12px 10px', borderRadius: 10, cursor: 'pointer', background: n.leido ? 'transparent' : 'rgba(200,161,74,0.05)' }}>
              <div style={{ width: 34, height: 34, flex: '0 0 34px', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', border: '1px solid var(--line-soft)', color: toneCol[n.tone] }}><Ic n={n.ic} /></div>
              <div className="f1" style={{ minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{n.t}</div><div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>{n.s}</div></div>
              {!n.leido && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gold)', marginTop: 6, flex: '0 0 7px' }}></span>}
            </div>
          ))}
        </div>
      </div>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

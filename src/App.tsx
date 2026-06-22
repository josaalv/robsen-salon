import React, { useState, useEffect, useRef, useMemo } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import { PhosphorIcon as Ic } from './components/PhosphorIcon'
import { Avatar, ToastHost, toast } from './components/ui'
import { useStore } from './data/store'
import { usuarios, roles } from './data/mockData'
import type { NavGroup } from './types'

const NAV: NavGroup[] = [
  { grupo: 'Principal', items: [
    { id:'dashboard', label:'Dashboard',            icon:'squares-four',        title:'Dashboard',             sub:'Resumen general del salón' },
    { id:'agenda',    label:'Agenda',               icon:'calendar-blank',       title:'Agenda',                sub:'Citas y disponibilidad' },
    { id:'ventas',    label:'Ventas',               icon:'cash-register',        title:'Ventas',                sub:'Punto de venta y tickets' },
    { id:'crm',       label:'Clientas',             icon:'users',                title:'CRM de clientas',       sub:'Base de clientas y perfiles' },
    { id:'servicios', label:'Servicios',            icon:'scissors',             title:'Servicios',             sub:'Catálogo y paquetes' },
    { id:'productos', label:'Productos',            icon:'package',              title:'Productos e inventario',sub:'Inventario, ventas y movimientos' },
    { id:'empleados', label:'Empleados',            icon:'identification-badge', title:'Empleados',             sub:'Equipo y comisiones' },
  ]},
  { grupo: 'Gestión', items: [
    { id:'finanzas',  label:'Finanzas',             icon:'chart-line-up',        title:'Finanzas',              sub:'Reportes e ingresos' },
    { id:'whatsapp',  label:'Seguimiento',          icon:'whatsapp-logo',        title:'Seguimiento',           sub:'Mensajes y recordatorios', badge:3 },
  ]},
  { grupo: 'Sistema', items: [
    { id:'ajustes',   label:'Ajustes',              icon:'gear-six',             title:'Ajustes',               sub:'Configuración y permisos' },
    { id:'booking',   label:'Agendamiento en línea',icon:'calendar-plus',        title:'',                      sub:'' },
  ]},
]
const ALL = NAV.flatMap(g => g.items)

function AppShell() {
  const { user, logout } = useAuth()
  const { data, syncing, loadFromSupabase } = useStore()
  const [route, setRoute] = useState('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [topPop, setTopPop] = useState<'agenda' | 'notif' | null>(null)
  const [searchQ, setSearchQ] = useState('')
  const searchRef = useRef<HTMLDivElement>(null)
  const [logo, setLogo] = useState(() => localStorage.getItem('rb_logo') || '')
  const [Screen, setScreen] = useState<React.ComponentType<any> | null>(null)

  // Sincronizar desde Supabase al iniciar
  useEffect(() => {
    loadFromSupabase().catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handler = () => setLogo(localStorage.getItem('rb_logo') || '')
    window.addEventListener('rb_logo_changed', handler)
    return () => window.removeEventListener('rb_logo_changed', handler)
  }, [])

  useEffect(() => {
    if (data.config?.acento) {
      document.documentElement.style.setProperty('--gold', data.config.acento)
    }
  }, [data.config?.acento])

  useEffect(() => {
    const t = localStorage.getItem('rb_tema') || 'Oscuro'
    const root = document.documentElement
    if (t === 'Claro') root.setAttribute('data-theme', 'light')
    else if (t === 'Automático' && !window.matchMedia('(prefers-color-scheme: dark)').matches)
      root.setAttribute('data-theme', 'light')
  }, [])

  useEffect(() => { window.scrollTo(0, 0); setMenuOpen(false); setTopPop(null); setSearchQ('') }, [route])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchQ('')
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const searchResults = useMemo(() => {
    if (!searchQ.trim() || searchQ.length < 2) return []
    const q = searchQ.toLowerCase()
    const out: { tipo: string; label: string; sub: string; ruta: string; icon: string }[] = []

    data.clientas.filter(c => c.nombre.toLowerCase().includes(q)).slice(0, 3)
      .forEach(c => out.push({ tipo: 'Clienta', label: c.nombre, sub: c.tel || 'CRM', ruta: 'crm', icon: 'user' }))

    data.hoy.filter(a => a.cl.toLowerCase().includes(q) || a.srv.toLowerCase().includes(q)).slice(0, 3)
      .forEach(a => out.push({ tipo: 'Cita', label: a.cl, sub: `${a.h} · ${a.srv}`, ruta: 'agenda', icon: 'calendar-blank' }))

    data.ventas.filter(v => v.cliente.toLowerCase().includes(q) || v.ticket.toLowerCase().includes(q)).slice(0, 3)
      .forEach(v => out.push({ tipo: 'Venta', label: `${v.ticket} · ${v.cliente}`, sub: v.fecha, ruta: 'ventas', icon: 'cash-register' }))

    return out.slice(0, 8)
  }, [searchQ, data.clientas, data.hoy, data.ventas])

  // Lazy-load screen
  useEffect(() => {
    const load = async () => {
      try {
        let mod: any
        switch (route) {
          case 'dashboard': mod = await import('./screens/Dashboard'); setScreen(() => mod.ScreenDashboard); break
          case 'agenda':    mod = await import('./screens/Agenda');    setScreen(() => mod.ScreenAgenda);    break
          case 'ventas':    mod = await import('./screens/Ventas');    setScreen(() => mod.ScreenVentas);    break
          case 'crm':       mod = await import('./screens/CRM');       setScreen(() => mod.ScreenCRM);       break
          case 'servicios': mod = await import('./screens/Servicios'); setScreen(() => mod.ScreenServicios); break
          case 'productos': mod = await import('./screens/Productos'); setScreen(() => mod.ScreenProductos); break
          case 'empleados': mod = await import('./screens/Empleados'); setScreen(() => mod.ScreenEmpleados); break
          case 'finanzas':  mod = await import('./screens/Finanzas');  setScreen(() => mod.ScreenFinanzas);  break
          case 'whatsapp':  mod = await import('./screens/WhatsApp');  setScreen(() => mod.ScreenWhatsApp);  break
          case 'ajustes':   mod = await import('./screens/Ajustes');   setScreen(() => mod.ScreenAjustes);   break
          case 'booking':   mod = await import('./screens/Booking');   setScreen(() => mod.ScreenBooking);   break
          default: setScreen(null)
        }
      } catch (e) { console.error('Screen load error:', e); setScreen(null) }
    }
    load()
  }, [route])

  if (!user) return null

  const rolData = roles[user.rol] || roles.admin
  const can = (id: string) => rolData.allow === '*' || (Array.isArray(rolData.allow) && rolData.allow.includes(id))
  const effRoute = can(route) ? route : 'dashboard'
  const meta = ALL.find(i => i.id === effRoute) || ALL[0]

  // Public booking view
  if (effRoute === 'booking') {
    return (
      <div style={{ position:'relative' }}>
        <button className="btn ghost sm" style={{ position:'fixed', top:20, right:20, zIndex:50 }} onClick={() => setRoute('dashboard')}>
          <Ic n="arrow-left" /> Volver al panel
        </button>
        {Screen && <Screen />}
        <ToastHost />
      </div>
    )
  }

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          {logo
            ? <img src={logo} alt={data.config?.nombre || 'Robsen'} className="brand-logo-img" />
            : <div className="logo">{data.config?.nombre || 'Robsen'}</div>}
          <div className="sub">Salón &amp; Spa · Interno</div>
        </div>
        <nav className="nav">
          {NAV.map(g => {
            const items = g.items.filter(it => can(it.id))
            if (!items.length) return null
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
            )
          })}
        </nav>
        <div className="side-foot" style={{ position:'relative' }}>
          {menuOpen && (
            <>
              <div style={{ position:'fixed', inset:0, zIndex:30 }} onClick={() => setMenuOpen(false)} />
              <div className="card gold-edge" style={{ position:'absolute', bottom:70, left:14, right:14, zIndex:31, padding:6, boxShadow:'var(--sh-lg)' }}>
                <div className="nav-item" onClick={() => { setRoute('ajustes'); setMenuOpen(false) }}><Ic n="gear-six" />Ajustes</div>
                <div className="nav-item" onClick={logout}><Ic n="user-switch" />Cambiar de cuenta</div>
                <hr className="hr" style={{ margin:'4px 8px' }} />
                <div className="nav-item" style={{ color:'var(--st-canc)' }} onClick={logout}><Ic n="sign-out" />Cerrar sesión</div>
              </div>
            </>
          )}
          <div className="user-chip" onClick={() => setMenuOpen(v => !v)}>
            <Avatar ini={user.ini} color={user.color} />
            <div style={{ minWidth:0, flex:1 }}>
              <div style={{ fontWeight:600, fontSize:13 }}>{user.nombre}</div>
              <div className="dim" style={{ fontSize:11 }}>{rolData.nombre}</div>
            </div>
            <Ic n="caret-up-down" />
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="main">
        <header className="topbar">
          <div>
            <div className="page-title">{meta.title}</div>
            <div className="page-sub">{meta.sub}</div>
          </div>
          <div className="spacer" />
          {syncing && (
            <div className="vc gap6" style={{ fontSize: 11.5, color: 'var(--text-3)', padding: '0 8px' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" style={{ animation: 'spin 1s linear infinite' }}>
                <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="22 8" />
              </svg>
              Sincronizando…
            </div>
          )}
          <div className="search" ref={searchRef} style={{ position: 'relative' }}>
            <Ic n="magnifying-glass" />
            <input
              placeholder="Buscar clienta, cita o servicio…"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && setSearchQ('')}
            />
            {searchResults.length > 0 && (
              <div className="card gold-edge" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, minWidth: 300, zIndex: 50, boxShadow: 'var(--sh-lg)', padding: 4 }}>
                {searchResults.map((r, i) => (
                  <div
                    key={i}
                    className="nav-item"
                    style={{ padding: '10px 12px', cursor: 'pointer', borderRadius: 8, gap: 10, display: 'flex', alignItems: 'center' }}
                    onClick={() => { setRoute(r.ruta); setSearchQ('') }}
                  >
                    <Ic n={r.icon} />
                    <div className="f1" style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{r.label}</div>
                      <div className="dim" style={{ fontSize: 11, marginTop: 1 }}>{r.sub}</div>
                    </div>
                    <span className="badge neutral" style={{ fontSize: 10 }}>{r.tipo}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Agenda pop */}
          <div style={{ position:'relative' }}>
            <button className={'icon-btn' + (topPop === 'agenda' ? ' on' : '')} title="Agenda de hoy" onClick={() => setTopPop(p => p === 'agenda' ? null : 'agenda')}>
              <Ic n="calendar-blank" />
            </button>
            {topPop === 'agenda' && <AgendaPop onClose={() => setTopPop(null)} go={setRoute} citas={data.hoy} estilistas={data.estilistas} />}
          </div>
          {/* Notifications pop */}
          <div style={{ position:'relative' }}>
            <button className={'icon-btn' + (topPop === 'notif' ? ' on' : '')} title="Notificaciones" onClick={() => setTopPop(p => p === 'notif' ? null : 'notif')}>
              <span className="dot" />
              <Ic n="bell" />
            </button>
            {topPop === 'notif' && <NotifPop onClose={() => setTopPop(null)} go={setRoute} />}
          </div>
        </header>
        <div className="content">
          {Screen ? <Screen user={user} onNavigate={setRoute} /> : (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300, color:'var(--text-3)' }}>Cargando…</div>
          )}
        </div>
      </div>
      <ToastHost />
    </div>
  )
}

function AgendaPop({ onClose, go, citas, estilistas }: any) {
  const proximas = citas.slice(0, 5)
  const ESTADOS: Record<string, string> = { pend:'Pendiente', conf:'Confirmada', pay:'Anticipo pagado', done:'Completada', canc:'Cancelada' }
  const hoyStr = new Date().toLocaleDateString('es-MX', { day:'numeric', month:'short' })
  return (
    <>
      <div style={{ position:'fixed', inset:0, zIndex:40 }} onClick={onClose} />
      <div className="card gold-edge top-pop" onClick={(e) => e.stopPropagation()}>
        <div className="card-head" style={{ padding:'16px 18px 0' }}>
          <div><div className="eyebrow">Hoy · {hoyStr}</div><h3 style={{ marginTop:4, fontSize:17 }}>Próximas citas</h3></div>
          <span className="badge neutral">{citas.length}</span>
        </div>
        <div style={{ padding:'12px 18px 8px', maxHeight:320, overflowY:'auto' }}>
          {proximas.map((a: any) => {
            const e = estilistas.find((x: any) => x.id === a.est) || {}
            return (
              <div key={a.id} className="list-item" style={{ padding:'11px 0' }}>
                <div style={{ textAlign:'center', minWidth:42 }}>
                  <div className="num" style={{ fontFamily:'var(--serif)', fontSize:15, fontWeight:600 }}>{a.h}</div>
                </div>
                <div style={{ width:1, height:28, background:'var(--line-soft)' }} />
                <div className="f1" style={{ minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:13 }}>{a.cl}</div>
                  <div className="vc" style={{ fontSize:11, color:'var(--text-3)', gap:6, marginTop:1 }}>
                    <span className="dotc" style={{ background:e.color }} />
                    {a.srv}
                  </div>
                </div>
                <span className={`badge ${a.estado}`}><span className="d" />{ESTADOS[a.estado]}</span>
              </div>
            )
          })}
        </div>
        <hr className="hr" />
        <div style={{ padding:12 }}>
          <button className="btn ghost w100" style={{ justifyContent:'center' }} onClick={() => { go('agenda'); onClose() }}>
            Ver agenda completa <Ic n="arrow-right" />
          </button>
        </div>
      </div>
    </>
  )
}

function NotifPop({ onClose, go }: any) {
  const { data } = useStore()
  const [leidas, setLeidas] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('rb_notif_leidas') || '[]')) }
    catch { return new Set() }
  })

  const items = React.useMemo(() => {
    const list: { id:string; ic:string; tone:string; t:string; s:string; to:string }[] = []

    // Citas sin confirmar hoy
    const sinConf = data.hoy.filter(c => c.estado === 'pend')
    if (sinConf.length > 0) {
      const nombres = sinConf.slice(0, 3).map(c => c.cl.split(' ')[0]).join(', ')
      list.push({ id:'n_pend', ic:'warning', tone:'bad',
        t:`${sinConf.length} cita${sinConf.length > 1 ? 's' : ''} sin confirmar`,
        s:`Para hoy · ${nombres}${sinConf.length > 3 ? ' y más' : ''}`, to:'agenda' })
    }

    // Productos con stock bajo
    const stockBajo = data.productos.filter(p => p.stock <= p.min && p.min > 0)
    if (stockBajo.length > 0) {
      const nombres = stockBajo.slice(0, 2).map(p => p.nombre).join(' y ')
      list.push({ id:'n_stock', ic:'package', tone:'warn',
        t:`Stock bajo en ${stockBajo.length} producto${stockBajo.length > 1 ? 's' : ''}`,
        s:nombres + (stockBajo.length > 2 ? ` y ${stockBajo.length - 2} más` : ''), to:'productos' })
    }

    // Ventas con saldo pendiente
    const pendPago = data.ventas.filter(v => v.estado === 'parcial' || v.estado === 'pendiente')
    if (pendPago.length > 0) {
      const saldoTotal = pendPago.reduce((s, v) => {
        const total = v.lineas.reduce((a, l) => a + l.precio * l.cant, 0)
        return s + Math.max(0, total - (v.desc || 0) - (v.anticipo || 0))
      }, 0)
      list.push({ id:'n_cobro', ic:'hand-coins', tone:'warn',
        t:`${pendPago.length} pago${pendPago.length > 1 ? 's' : ''} pendiente${pendPago.length > 1 ? 's' : ''} de cobro`,
        s:`Saldo por cobrar · $${saldoTotal.toLocaleString('es-MX')}`, to:'ventas' })
    }

    // Clientas inactivas +60 días
    const ahora = Date.now()
    const inactivas = data.clientas.filter(c => {
      if (!c.ultima) return false
      const partes = c.ultima.split(' ')
      const d = parseInt(partes[0])
      const MESES: Record<string, number> = { ene:0, feb:1, mar:2, abr:3, may:4, jun:5, jul:6, ago:7, sep:8, oct:9, nov:10, dic:11 }
      const m = MESES[partes[1]?.toLowerCase()]
      const y = partes[2] ? parseInt(partes[2]) : new Date().getFullYear()
      if (isNaN(d) || m === undefined) return false
      const diff = (ahora - new Date(y, m, d).getTime()) / 86400000
      return diff > 60
    })
    if (inactivas.length > 0) {
      list.push({ id:'n_inact', ic:'user-minus', tone:'warn',
        t:`${inactivas.length} clienta${inactivas.length > 1 ? 's' : ''} inactiva${inactivas.length > 1 ? 's' : ''} (+60 días)`,
        s:'Sugerencia: campaña de reactivación', to:'whatsapp' })
    }

    // Última venta registrada
    if (data.ventas.length > 0) {
      const v = data.ventas[0]
      const total = v.lineas.reduce((s, l) => s + l.precio * l.cant, 0) - (v.desc || 0)
      list.push({ id:`n_venta_${v.id}`, ic:'cash-register', tone:'info',
        t:`Venta registrada ${v.ticket}`,
        s:`${v.cliente} · $${total.toLocaleString('es-MX')}`, to:'ventas' })
    }

    return list
  }, [data.hoy, data.ventas, data.productos, data.clientas])

  const sinLeer = items.filter(n => !leidas.has(n.id)).length
  const toneCol: Record<string, string> = { bad:'var(--st-canc)', warn:'var(--st-pend)', info:'var(--gold)' }

  const marcarLeidas = () => {
    const all = new Set(items.map(n => n.id))
    setLeidas(all)
    localStorage.setItem('rb_notif_leidas', JSON.stringify([...all]))
  }

  return (
    <>
      <div style={{ position:'fixed', inset:0, zIndex:40 }} onClick={onClose} />
      <div className="card gold-edge top-pop" onClick={e => e.stopPropagation()}>
        <div className="card-head" style={{ padding:'16px 18px 0' }}>
          <div><div className="eyebrow">{sinLeer} sin leer</div><h3 style={{ marginTop:4, fontSize:17 }}>Notificaciones</h3></div>
          <button className="btn sm ghost" onClick={marcarLeidas}>Marcar leídas</button>
        </div>
        <div style={{ padding:'12px 12px 8px', maxHeight:360, overflowY:'auto' }}>
          {items.length === 0 && (
            <div style={{ textAlign:'center', padding:'24px 0', color:'var(--text-3)', fontSize:13 }}>Todo en orden</div>
          )}
          {items.map(n => {
            const leido = leidas.has(n.id)
            return (
              <div key={n.id} onClick={() => { go(n.to); onClose() }} style={{ display:'flex', gap:12, padding:'12px 10px', borderRadius:10, cursor:'pointer', background:leido ? 'transparent' : 'rgba(200,161,74,0.05)' }}>
                <div style={{ width:34, height:34, flex:'0 0 34px', borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--surface-2)', border:'1px solid var(--line-soft)', color:toneCol[n.tone] }}>
                  <Ic n={n.ic} />
                </div>
                <div className="f1" style={{ minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:13 }}>{n.t}</div>
                  <div className="dim" style={{ fontSize:11.5, marginTop:2 }}>{n.s}</div>
                </div>
                {!leido && <span style={{ width:7, height:7, borderRadius:'50%', background:'var(--gold)', marginTop:6, flex:'0 0 7px' }} />}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

function LoginGate() {
  const { user, login } = useAuth()
  const [LoginScreen, setLoginScreen] = useState<React.ComponentType<any> | null>(null)

  useEffect(() => {
    import('./screens/Login').then(m => setLoginScreen(() => m.ScreenLogin))
  }, [])

  if (user) return <AppShell />
  if (LoginScreen) return <><LoginScreen onLogin={login} /><ToastHost /></>
  return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--text-3)' }}>Cargando…</div>
}

export default function App() {
  return (
    <AuthProvider>
      <LoginGate />
    </AuthProvider>
  )
}

import React, { useState, useEffect, useRef, useMemo, Component } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import { PhosphorIcon as Ic } from './components/PhosphorIcon'
import { Avatar, ToastHost, toast } from './components/ui'
import { useStore } from './data/store'
import { db } from './lib/db'
import { usuarios, roles } from './data/mockData'
import { rolPuede, normalizarBusqueda } from './lib/helpers'
import { hasSupabase } from './lib/supabase'
import { startSyncEngine, subscribeOutbox } from './lib/outbox'
import type { NavGroup } from './types'

class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: any) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e: Error) { return { error: e } }
  render() {
    if (this.state.error) return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:16, color:'var(--text-3)', padding:24 }}>
        <Ic n="warning-circle" size={48} />
        <div style={{ fontWeight:600, fontSize:16, color:'var(--text)' }}>Algo salió mal</div>
        <div style={{ fontSize:13, maxWidth:380, textAlign:'center' }}>{this.state.error.message}</div>
        <button className="btn gold" onClick={() => window.location.reload()}>
          <Ic n="arrows-clockwise" />Recargar la página
        </button>
      </div>
    )
    return this.props.children
  }
}

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
    { id:'whatsapp',  label:'Seguimiento',          icon:'whatsapp-logo',        title:'Seguimiento',           sub:'Mensajes y recordatorios' },
  ]},
  { grupo: 'Sistema', items: [
    { id:'ajustes',    label:'Ajustes',              icon:'gear-six',             title:'Ajustes',               sub:'Configuración y permisos' },
    { id:'conflictos', label:'Conflictos',           icon:'warning-circle',       title:'Conflictos de sincronización', sub:'Cambios sin conexión que no se sincronizaron solos' },
    { id:'booking',    label:'Agendamiento en línea',icon:'calendar-plus',        title:'',                      sub:'' },
  ]},
]
const ALL = NAV.flatMap(g => g.items)

function pathFromUrl() {
  // import.meta.env.BASE_URL refleja el `base` real del build ('/' en
  // producción, '/preview/' en preview) — sin restarlo primero, cualquier
  // URL con prefijo (ej. /preview/ventas) nunca hace match con ningún id
  // de NAV y siempre cae a 'dashboard'.
  const base = import.meta.env.BASE_URL
  let pathname = window.location.pathname
  if (pathname.startsWith(base)) pathname = pathname.slice(base.length)
  // También se quita la barra final: Apache redirige /booking a /booking/
  // cuando ese path es un directorio real con su propio index.html (el caso
  // de /agendar/booking/ en robsen.com.mx, servido así a propósito para no
  // depender de una regla de reescritura que compita con el .htaccess de
  // WordPress en el dominio raíz) — sin esto, 'booking/' nunca hace match
  // con el id 'booking' de NAV.
  return pathname.replace(/^\/+/, '').replace(/\/+$/, '')
}

function initialRoute() {
  const path = pathFromUrl()
  return ALL.some(i => i.id === path) ? path : 'dashboard'
}

// El agendamiento en línea es la única pantalla pensada para público
// anónimo (clientas reales, sin cuenta) — se detecta por URL, ANTES de
// cualquier chequeo de sesión, para que jamás dependa de estar autenticado
// ni pueda caer en la pantalla de login por una sesión vencida/inexistente.
//
// El build de /agendar/ en robsen.com.mx es el mismo bundle completo del
// CRM (no uno aparte) — sin este caso especial, solo /agendar/booking
// mostraba el formulario público y CUALQUIER otra ruta ahí (empezando por
// la raíz, /agendar/) caía en la pantalla de login normal del sistema
// interno. Justo lo que se quería evitar al mover el agendamiento a este
// dominio: que ahí no aparezca nunca nada del sistema interno, sin
// importar la ruta exacta que alguien escriba.
function isBookingRoute() {
  if (import.meta.env.VITE_APP_MODE === 'agendar') return true
  return pathFromUrl() === 'booking'
}

function AppShell() {
  const { user, logout } = useAuth()
  const { data, syncing, loadFromSupabase } = useStore()
  const [route, setRoute] = useState(initialRoute)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [topPop, setTopPop] = useState<'agenda' | 'notif' | null>(null)
  const [searchQ, setSearchQ] = useState('')
  const searchRef = useRef<HTMLDivElement>(null)
  const logo = data.config?.logo || ''
  const [Screen, setScreen] = useState<React.ComponentType<any> | null>(null)

  // Badge de "Seguimiento": mensajes de WhatsApp esperando aprobación —
  // carga aparte (no es parte del store principal) y se refresca sola
  // mientras la app esté abierta, igual que la pantalla de Seguimiento.
  const [waPend, setWaPend] = useState(0)
  useEffect(() => {
    const cargar = () => db.getWaMensajes().then(cola => {
      setWaPend(cola.filter(m => m.estado === 'pendiente_aprobacion').length)
    }).catch(() => {})
    cargar()
    const id = setInterval(cargar, 60000)
    return () => clearInterval(id)
  }, [])

  // Estado de conexión + cola de sincronización offline: online/offline real
  // (evento del navegador, con navigator.onLine como estado inicial),
  // cuántos cambios siguen pendientes de subir y cuántos quedaron en
  // conflicto (necesitan resolverse a mano en Conflictos).
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [outboxPending, setOutboxPending] = useState(0)
  const [outboxConflict, setOutboxConflict] = useState(0)
  useEffect(() => {
    startSyncEngine()
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    const unsub = subscribeOutbox(e => {
      if (e.type === 'counts') { setOutboxPending(e.pending); setOutboxConflict(e.conflict) }
    })
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      unsub()
    }
  }, [])

  // Sincronizar desde Supabase al iniciar
  useEffect(() => {
    loadFromSupabase().catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const acento = localStorage.getItem('rb_acento') || data.config?.acento
    if (acento) {
      document.documentElement.style.setProperty('--gold', acento)
    }
  }, [data.config?.acento])

  useEffect(() => {
    const t = localStorage.getItem('rb_tema') || 'Oscuro'
    const root = document.documentElement
    if (t === 'Claro') root.setAttribute('data-theme', 'light')
    else if (t === 'Automático' && !window.matchMedia('(prefers-color-scheme: dark)').matches)
      root.setAttribute('data-theme', 'light')
  }, [])

  useEffect(() => { window.scrollTo(0, 0); setMenuOpen(false); setTopPop(null); setSearchQ(''); setMobileNavOpen(false) }, [route])

  useEffect(() => {
    // Igual que initialRoute: la URL visible tiene que respetar el `base`
    // real del build, si no un click dentro de /preview/ deja la barra de
    // direcciones apuntando a la raíz del dominio principal (/ventas en vez
    // de /preview/ventas) — y un F5 en esa URL carga el bundle equivocado.
    const base = import.meta.env.BASE_URL.replace(/\/+$/, '')
    const path = base + '/' + route
    if (window.location.pathname !== path) window.history.replaceState(null, '', path)
  }, [route])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchQ('')
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Al enfocar un campo numérico, seleccionar todo su contenido para poder
  // sobrescribirlo de golpe (sin tener que borrar el valor previo). Global,
  // así todos los formularios se comportan igual que el POS.
  useEffect(() => {
    const handler = (e: FocusEvent) => {
      const t = e.target as HTMLElement
      if (t instanceof HTMLInputElement && t.type === 'number') {
        // requestAnimationFrame: deja que el navegador coloque el cursor primero
        requestAnimationFrame(() => { try { t.select() } catch { /* noop */ } })
      }
    }
    document.addEventListener('focusin', handler)
    return () => document.removeEventListener('focusin', handler)
  }, [])

  const searchResults = useMemo(() => {
    if (!searchQ.trim() || searchQ.length < 2) return []
    const q = normalizarBusqueda(searchQ)
    const qDigits = searchQ.replace(/\D/g, '')  // para buscar por teléfono sin importar el formato
    const out: { tipo: string; label: string; sub: string; ruta: string; icon: string }[] = []

    data.clientas.filter(c =>
      normalizarBusqueda(c.nombre).includes(q) ||
      (qDigits.length > 0 && (c.tel || '').replace(/\D/g, '').includes(qDigits))
    ).slice(0, 3)
      .forEach(c => out.push({ tipo: 'Clienta', label: c.nombre, sub: c.tel || 'CRM', ruta: 'crm', icon: 'user' }))

    data.hoy.filter(a => normalizarBusqueda(a.cl).includes(q) || normalizarBusqueda(a.srv).includes(q)).slice(0, 3)
      .forEach(a => out.push({ tipo: 'Cita', label: a.cl, sub: `${a.h} · ${a.srv}`, ruta: 'agenda', icon: 'calendar-blank' }))

    data.ventas.filter(v => normalizarBusqueda(v.cliente).includes(q) || v.ticket.toLowerCase().includes(q)).slice(0, 3)
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
          case 'whatsapp':  mod = await import('./screens/whatsapp'); setScreen(() => mod.ScreenWhatsApp);  break
          case 'ajustes':   mod = await import('./screens/Ajustes');   setScreen(() => mod.ScreenAjustes);   break
          case 'conflictos': mod = await import('./screens/ConflictosInbox'); setScreen(() => mod.ScreenConflictosInbox); break
          case 'booking':   mod = await import('./screens/Booking');   setScreen(() => mod.ScreenBooking);   break
          default: setScreen(null)
        }
      } catch (e) { console.error('Screen load error:', e); setScreen(null) }
    }
    load()
  }, [route])

  if (!user) return null

  const rolData = roles[user.rol] || roles.admin
  const can = (id: string) => rolPuede(user.rol, id, data.config, roles)
  // Si el rol no puede ver la ruta actual, cae al primer módulo permitido (o a
  // Ajustes, siempre accesible desde el menú de cuenta para el perfil propio).
  const primerModulo = ALL.find(i => can(i.id))?.id || 'ajustes'
  const effRoute = route === 'ajustes' || can(route) ? route : primerModulo
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
      <div className={'sidebar-backdrop' + (mobileNavOpen ? ' show' : '')} onClick={() => setMobileNavOpen(false)} />
      <aside className={'sidebar' + (mobileNavOpen ? ' mobile-open' : '')}>
        <div className="brand">
          {logo
            ? <img src={logo} alt={data.config?.nombre || 'Robsen'} className="brand-logo-img" />
            : <div className="logo">{data.config?.nombre || 'Robsen'}</div>}
          <div className="sub">Salón &amp; Spa · Interno</div>
          <div style={{ fontSize:10, color:'var(--text-3)', opacity:0.5, marginTop:2, letterSpacing:'.04em' }}>v1.057</div>
          {!hasSupabase && (
            <div style={{ fontSize:10, color:'var(--st-canc)', marginTop:2 }}>⚠ Sin BD</div>
          )}
        </div>
        <nav className="nav">
          {NAV.map(g => {
            const items = g.items.filter(it => can(it.id))
            if (!items.length) return null
            return (
              <React.Fragment key={g.grupo}>
                <div className="nav-label">{g.grupo}</div>
                {items.map(it => {
                  const badge = it.id === 'whatsapp' ? waPend : it.id === 'conflictos' ? outboxConflict : it.badge
                  return (
                    <div key={it.id} className={'nav-item' + (effRoute === it.id ? ' active' : '')} onClick={() => setRoute(it.id)}>
                      <Ic n={it.icon} />{it.label}
                      {!!badge && <span className="badge-dot">{badge}</span>}
                      {it.id === 'booking' && <Ic n="arrow-up-right" />}
                    </div>
                  )
                })}
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
            <Avatar ini={user.ini} color={user.color} src={user.avatar} />
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
          <button className="icon-btn mobile-menu-btn" onClick={() => setMobileNavOpen(v => !v)} title="Menú">
            <Ic n="list" />
          </button>
          <div>
            <div className="page-title">{meta.title}</div>
            <div className="page-sub">{meta.sub}</div>
          </div>
          <div className="spacer" />
          {!isOnline ? (
            <div className="vc gap6" style={{ fontSize: 11.5, color: 'var(--st-canc)', padding: '0 8px' }} title={outboxPending > 0 ? `${outboxPending} cambio${outboxPending !== 1 ? 's' : ''} guardado${outboxPending !== 1 ? 's' : ''} localmente, en espera de conexión` : 'Sin conexión'}>
              <Ic n="wifi-slash" size={14} />
              Sin conexión{outboxPending > 0 ? ` · ${outboxPending} pendiente${outboxPending !== 1 ? 's' : ''}` : ''}
            </div>
          ) : outboxPending > 0 ? (
            <div className="vc gap6" style={{ fontSize: 11.5, color: 'var(--text-3)', padding: '0 8px' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" style={{ animation: 'spin 1s linear infinite' }}>
                <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="22 8" />
              </svg>
              Sincronizando {outboxPending} pendiente{outboxPending !== 1 ? 's' : ''}…
            </div>
          ) : syncing && (
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

// El agendamiento público se retiró de aquí — vive en robsen.com.mx/agendar
// (el dominio que ya conoce la clientela; este dominio suena, y es,
// interno). Solo aplica a la producción real: BASE_URL === '/' es
// específicamente el deploy raíz de robseninterno.com — ni preview
// (BASE_URL '/preview/', sigue sirviendo Booking normal para pruebas) ni
// el propio deploy de /agendar/ (BASE_URL '/agendar/', se redirigiría a
// sí mismo en bucle si se comparara distinto) entran en esta condición.
const BOOKING_PUBLICO_URL = 'https://robsen.com.mx/agendar/booking'

function LoginGate() {
  const { user, loading, passwordRecovery } = useAuth()
  const [LoginScreen, setLoginScreen] = useState<React.ComponentType<any> | null>(null)
  const [BookingScreen, setBookingScreen] = useState<React.ComponentType<any> | null>(null)
  const publicBooking = isBookingRoute()
  const redirigirBookingPublico = publicBooking && import.meta.env.BASE_URL === '/'

  useEffect(() => {
    if (redirigirBookingPublico) {
      window.location.replace(BOOKING_PUBLICO_URL + window.location.search)
      return
    }
    if (publicBooking) {
      import('./screens/Booking').then(m => setBookingScreen(() => m.ScreenBooking)).catch(() => {})
      return
    }
    import('./screens/Login')
      .then(m => setLoginScreen(() => m.ScreenLogin))
      .catch(() => setLoginScreen(() => () => (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:16, color:'var(--text-3)' }}>
          <Ic n="warning-circle" size={40} />
          <div style={{ fontWeight:600 }}>Error al cargar la pantalla de acceso</div>
          <button className="btn gold" onClick={() => window.location.reload()}><Ic n="arrows-clockwise" />Reintentar</button>
        </div>
      )))
  }, [publicBooking, redirigirBookingPublico])

  if (redirigirBookingPublico) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--text-3)' }}>Redirigiendo…</div>
    )
  }

  // Se evalúa antes que loading/user/passwordRecovery a propósito: quien
  // llega aquí desde un enlace público (Google/redes) nunca debe ver la
  // pantalla de acceso, sin importar si tiene sesión, si expiró o si nunca
  // la tuvo. Solo se ofrece "Volver al panel" si YA hay sesión de staff.
  if (publicBooking) {
    return (
      <div style={{ position:'relative' }}>
        {!loading && !passwordRecovery && user && (
          <button
            className="btn ghost sm"
            style={{ position:'fixed', top:20, right:20, zIndex:50 }}
            onClick={() => { window.location.href = import.meta.env.BASE_URL }}
          >
            <Ic n="arrow-left" /> Volver al panel
          </button>
        )}
        {BookingScreen ? <BookingScreen /> : (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--text-3)' }}>Cargando…</div>
        )}
        <ToastHost />
      </div>
    )
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--text-3)' }}>Cargando…</div>
  // Un enlace de recuperación de contraseña deja una sesión válida (así
  // funciona Supabase Auth), pero eso no debe saltarse la pantalla de
  // "pon tu nueva contraseña" — se revisa antes que "user" a propósito.
  if (!passwordRecovery && user) return <AppShell />
  if (LoginScreen) return <><LoginScreen /><ToastHost /></>
  return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--text-3)' }}>Cargando…</div>
}

export default function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <LoginGate />
    </AuthProvider>
    </ErrorBoundary>
  )
}

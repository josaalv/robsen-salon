import React, { useState, useRef } from 'react'
import { Avatar, Switch, CardHead, Seg, toast } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { useStore } from '../data/store'
import type { Usuario } from '../types'

function SettingRow({ title, desc, children, last }: { title: string; desc?: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className="between" style={{ padding: '16px 0', borderBottom: last ? 'none' : '1px solid var(--line-soft)', gap: 18 }}>
      <div style={{ maxWidth: 460 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{title}</div>
        {desc && <div className="dim" style={{ fontSize: 12, marginTop: 3, lineHeight: 1.5 }}>{desc}</div>}
      </div>
      <div style={{ flex: '0 0 auto' }}>{children}</div>
    </div>
  )
}

function AjustesPerfil({ user }: { user: Usuario }) {
  const [nombre, setNombre] = useState(user.nombre)
  const [tel, setTel] = useState(user.tel || '')
  const [showPw, setShowPw] = useState(false)
  const [twofa, setTwofa] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 16 }}>Información personal</div>
        <div className="vc gap16" style={{ marginBottom: 20 }}>
          <Avatar ini={user.ini} color={user.color} size="lg" />
          <button className="btn ghost sm"><Ic n="camera" />Cambiar foto</button>
          <span className="badge vip" style={{ fontSize: 11.5 }}>{user.rol}</span>
        </div>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="field"><label>Nombre completo</label><input className="input" value={nombre} onChange={e => setNombre(e.target.value)} /></div>
          <div className="field"><label>Rol</label><input className="input" value={user.rol} disabled style={{ opacity: 0.6 }} /></div>
          <div className="field"><label>Correo electrónico</label><input className="input" value={user.email} disabled style={{ opacity: 0.6 }} /></div>
          <div className="field"><label>Teléfono</label><input className="input" value={tel} onChange={e => setTel(e.target.value)} /></div>
        </div>
      </div>
      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 16 }}>Seguridad</div>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="field"><label>Contraseña actual</label><input className="input" type={showPw ? 'text' : 'password'} placeholder="••••••••" /></div>
          <div className="field"><label>Nueva contraseña</label><input className="input" type={showPw ? 'text' : 'password'} placeholder="••••••••" /></div>
          <div className="field"><label>Confirmar contraseña</label><input className="input" type={showPw ? 'text' : 'password'} placeholder="••••••••" /></div>
        </div>
        <SettingRow title="Autenticación en 2 pasos" desc="Agrega una capa extra de seguridad a tu cuenta." last>
          <Switch on={twofa} onClick={() => setTwofa(v => !v)} />
        </SettingRow>
      </div>
      <div className="vc gap8">
        <button className="btn gold" onClick={() => toast('Cambios guardados')}><Ic n="check" />Guardar cambios</button>
        <button className="btn ghost" onClick={() => toast('Cambios descartados')}>Cancelar</button>
      </div>
    </div>
  )
}

function AjustesSalon() {
  const [logo, setLogo] = useState(() => localStorage.getItem('rb_logo') || '')
  const fileRef = useRef<HTMLInputElement>(null)
  const [horarios, setHorarios] = useState([true, true, true, true, true, true, false])
  const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const result = ev.target?.result as string
      setLogo(result)
      localStorage.setItem('rb_logo', result)
      window.dispatchEvent(new CustomEvent('rb_logo_changed'))
    }
    reader.readAsDataURL(file)
  }

  const removeLogo = () => {
    setLogo('')
    localStorage.removeItem('rb_logo')
    window.dispatchEvent(new CustomEvent('rb_logo_changed'))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 14 }}>Logo del salón</div>
        <div className="vc gap16" style={{ alignItems: 'flex-start' }}>
          <div style={{ width: 150, height: 88, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 150px' }}>
            {logo
              ? <img src={logo} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} />
              : <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--gold)', fontSize: 22 }}>Robsen</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" style={{ display: 'none' }} onChange={onFile} />
            <button className="btn gold sm" onClick={() => fileRef.current?.click()}><Ic n="upload" />{logo ? 'Cambiar logo' : 'Subir logo'}</button>
            {logo && <button className="btn ghost sm" onClick={removeLogo}><Ic n="trash" />Quitar</button>}
            <div className="dim" style={{ fontSize: 11.5 }}>PNG, SVG o JPG · máx. 2 MB</div>
          </div>
        </div>
      </div>
      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 14 }}>Datos del salón</div>
        <div className="grid" style={{ gap: 14 }}>
          <div className="field"><label>Nombre comercial</label><input className="input" defaultValue="Robsen Salón & Spa" /></div>
          <div className="field"><label>Dirección</label><input className="input" defaultValue="Av. Chapultepec 456, Col. Americana, Guadalajara, Jal." /></div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="field"><label>Teléfono</label><input className="input" defaultValue="33 3826 0774" /></div>
            <div className="field"><label>WhatsApp</label><input className="input" defaultValue="33 3826 0774" /></div>
          </div>
        </div>
      </div>
      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 14 }}>Horarios de atención</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {DIAS.map((d, i) => (
            <div key={d} className="between" style={{ fontSize: 13 }}>
              <div className="vc gap10">
                <Switch on={horarios[i]} onClick={() => setHorarios(h => h.map((v, j) => j === i ? !v : v))} />
                <span style={{ fontWeight: 600 }}>{d}</span>
              </div>
              {horarios[i]
                ? <div className="vc gap8"><input className="input" defaultValue="09:00" style={{ width: 80 }} /><span className="dim">–</span><input className="input" defaultValue={i === 5 ? '16:00' : '19:00'} style={{ width: 80 }} /></div>
                : <span className="badge neutral">Cerrado</span>}
            </div>
          ))}
        </div>
      </div>
      <div className="vc gap8">
        <button className="btn gold" onClick={() => toast('Configuración guardada')}><Ic n="check" />Guardar</button>
        <button className="btn ghost">Cancelar</button>
      </div>
    </div>
  )
}

function AjustesUsuarios({ user }: { user: Usuario }) {
  const { data } = useStore()
  const rolBadge: Record<string, string> = { admin: 'vip', gerente: 'pay', recepcion: 'conf', estilista: 'done' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Accesos al sistema</div><h3 style={{ marginTop: 4 }}>Usuarios del equipo</h3></div>
          <button className="btn gold sm" onClick={() => toast('Invitación enviada por correo')}><Ic n="user-plus" />Invitar usuario</button>
        </div>
        <table className="table" style={{ marginTop: 6 }}>
          <thead>
            <tr><th>Usuario</th><th>Rol</th><th>Último acceso</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {data.usuarios.map(u => (
              <tr key={u.id}>
                <td>
                  <div className="cell-name">
                    <Avatar ini={u.ini} color={u.color} size="sm" />
                    <div>
                      <div className="nm">{u.nombre}{u.id === user.id ? <span className="muted"> · tú</span> : ''}</div>
                      <div className="meta">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td><span className={'badge ' + (rolBadge[u.rol] || 'neutral')}>{u.rol}</span></td>
                <td className="muted">{u.ultimo || 'Nunca'}</td>
                <td>
                  <span className={'badge ' + (u.activo ? 'conf' : 'canc')}>{u.activo ? 'Activo' : 'Inactivo'}</span>
                </td>
                <td><button className="icon-btn" onClick={() => toast('Opciones de usuario')}><Ic n="dots-three-vertical" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <CardHead title="Permisos por rol" sub="Módulos disponibles por nivel de acceso" />
        <table className="table" style={{ marginTop: 6 }}>
          <thead>
            <tr>
              <th>Módulo</th>
              {Object.values(data.roles).map(r => <th key={r.id} style={{ textAlign: 'center' }}>{r.nombre}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.modulos.map(m => (
              <tr key={m.id}>
                <td style={{ fontWeight: 600 }}>{m.label}</td>
                {Object.values(data.roles).map(r => {
                  const ok = r.allow === '*' || (Array.isArray(r.allow) && r.allow.includes(m.id))
                  return (
                    <td key={r.id} style={{ textAlign: 'center' }}>
                      {ok ? <Ic n="check-circle" size={16} style={{ color: 'var(--st-conf)' }} /> : <Ic n="x-circle" size={16} style={{ color: 'var(--text-4)' }} />}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: '12px 22px' }}>
          <button className="btn ghost sm" onClick={() => toast('Edición de permisos — próximamente')}><Ic n="sliders" />Editar permisos</button>
        </div>
      </div>
    </div>
  )
}

function AjustesNotif() {
  const [notifs, setNotifs] = useState({
    citas: true, recordatorios: true, anticipos: true, stock: true, inactivas: false, cumples: true,
  })
  const toggle = (k: keyof typeof notifs) => setNotifs(n => ({ ...n, [k]: !n[k] }))
  const rows = [
    ['citas', 'Nuevas citas', 'Notificación al registrar una nueva cita o reserva online'],
    ['recordatorios', 'Recordatorios automáticos', 'Envío de recordatorio 24h antes de cada cita vía WhatsApp'],
    ['anticipos', 'Anticipos pendientes', 'Alerta cuando un anticipo lleva más de 3 días sin aplicarse'],
    ['stock', 'Stock bajo', 'Alerta cuando un producto baja del mínimo configurado'],
    ['inactivas', 'Clientas inactivas', 'Resumen semanal de clientas sin visita en más de 60 días'],
    ['cumples', 'Cumpleaños', 'Notificación el día del cumpleaños de una clienta'],
  ] as const

  return (
    <div className="card card-pad">
      <div className="eyebrow" style={{ marginBottom: 4 }}>Configuración de alertas</div>
      {rows.map(([k, title, desc], i) => (
        <SettingRow key={k} title={title} desc={desc} last={i === rows.length - 1}>
          <Switch on={notifs[k]} onClick={() => toggle(k)} />
        </SettingRow>
      ))}
    </div>
  )
}

function AjustesPagos() {
  const [requerirAnticipo, setRequerirAnticipo] = useState(true)
  const [metodoPago, setMetodoPago] = useState({ efectivo: true, tarjeta: true, transferencia: true, credito: false })
  const toggle = (k: keyof typeof metodoPago) => setMetodoPago(m => ({ ...m, [k]: !m[k] }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 4 }}>Anticipos</div>
        <SettingRow title="Requerir anticipo para servicios premium" desc="Balayage, keratina, extensiones y paquetes especiales.">
          <Switch on={requerirAnticipo} onClick={() => setRequerirAnticipo(v => !v)} />
        </SettingRow>
        <SettingRow title="Porcentaje de anticipo" desc="Porcentaje del total que se cobra al reservar." last>
          <select className="select" style={{ width: 100 }}>
            <option>30%</option><option selected>35%</option><option>50%</option>
          </select>
        </SettingRow>
      </div>
      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 4 }}>Métodos de pago</div>
        {([['efectivo', 'Efectivo'], ['tarjeta', 'Tarjeta de crédito / débito'], ['transferencia', 'Transferencia bancaria (SPEI)'], ['credito', 'Crédito de cuenta']] as const).map(([k, label], i, arr) => (
          <SettingRow key={k} title={label} last={i === arr.length - 1}>
            <Switch on={metodoPago[k]} onClick={() => toggle(k)} />
          </SettingRow>
        ))}
      </div>
      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 4 }}>Moneda e impuestos</div>
        <SettingRow title="Moneda" last={false}>
          <select className="select" style={{ width: 140 }}>
            <option selected>MXN · Peso mexicano</option><option>USD · Dólar</option>
          </select>
        </SettingRow>
        <SettingRow title="IVA aplicado" last>
          <select className="select" style={{ width: 100 }}>
            <option selected>Sin IVA</option><option>16%</option>
          </select>
        </SettingRow>
      </div>
      <button className="btn gold" style={{ alignSelf: 'flex-start' }} onClick={() => toast('Configuración de pagos guardada')}><Ic n="check" />Guardar</button>
    </div>
  )
}

function AjustesApariencia() {
  const { resetData } = useStore()
  const [tema, setTema] = useState('Oscuro')
  const [densidad, setDensidad] = useState('Cómoda')
  const ACENTOS = ['#C8A14A', '#93B58C', '#6FA6B8', '#C77B7B', '#B08AC7']
  const [acento, setAcento] = useState(ACENTOS[0])

  const handleReset = () => {
    if (confirm('¿Restablecer todos los datos de demostración? Esta acción no se puede deshacer.')) {
      resetData()
      toast('Datos de demostración restablecidos')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 4 }}>Personalización</div>
        <SettingRow title="Tema de la interfaz">
          <Seg opts={['Oscuro', 'Claro', 'Automático']} value={tema} onChange={setTema} />
        </SettingRow>
        <SettingRow title="Color de acento">
          <div className="vc gap8">
            {ACENTOS.map(c => (
              <div key={c} onClick={() => setAcento(c)} style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', outline: acento === c ? `3px solid ${c}` : '3px solid transparent', outlineOffset: 2 }} />
            ))}
          </div>
        </SettingRow>
        <SettingRow title="Densidad de la interfaz">
          <Seg opts={['Compacta', 'Cómoda']} value={densidad} onChange={setDensidad} />
        </SettingRow>
        <SettingRow title="Idioma" last>
          <select className="select" style={{ width: 160 }}>
            <option selected>Español (México)</option><option>English</option>
          </select>
        </SettingRow>
      </div>
      <div className="card card-pad" style={{ borderColor: 'rgba(199,123,123,0.3)' }}>
        <div className="eyebrow" style={{ marginBottom: 8, color: 'var(--st-canc)' }}>Zona de peligro</div>
        <div className="between">
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>Restablecer datos demo</div>
            <div className="dim" style={{ fontSize: 12, marginTop: 3 }}>Regresa todos los datos a los valores de ejemplo originales. No afecta la configuración.</div>
          </div>
          <button className="btn" style={{ background: 'rgba(199,123,123,0.12)', border: '1px solid rgba(199,123,123,0.3)', color: 'var(--st-canc)' }} onClick={handleReset}>
            <Ic n="arrow-circle-down" />Restablecer
          </button>
        </div>
      </div>
    </div>
  )
}

export function ScreenAjustes({ onNavigate, user }: { onNavigate: (r: string) => void; user: any }) {
  const esGestion = user.rol === 'admin' || user.rol === 'gerente'

  const allTabs = [
    ['Mi perfil', 'user', true],
    ['Salón', 'storefront', esGestion],
    ['Usuarios y roles', 'users-three', esGestion],
    ['Notificaciones', 'bell', esGestion],
    ['Anticipos y pagos', 'credit-card', esGestion],
    ['Apariencia', 'palette', true],
  ].filter(t => t[2]) as [string, string, boolean][]

  const [tab, setTab] = useState('Mi perfil')

  const renderTab = () => {
    switch (tab) {
      case 'Mi perfil': return <AjustesPerfil user={user} />
      case 'Salón': return <AjustesSalon />
      case 'Usuarios y roles': return <AjustesUsuarios user={user} />
      case 'Notificaciones': return <AjustesNotif />
      case 'Anticipos y pagos': return <AjustesPagos />
      case 'Apariencia': return <AjustesApariencia />
      default: return null
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 className="display" style={{ fontSize: 26, margin: 0 }}>Ajustes</h1>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Configuración del salón, usuarios y preferencias</div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: '232px 1fr', alignItems: 'start', gap: 20 }}>
        {/* Side nav */}
        <div className="card" style={{ position: 'sticky', top: 92, padding: 8 }}>
          {allTabs.map(([label, icon]) => (
            <div key={label} className={'nav-item' + (tab === label ? ' active' : '')} onClick={() => setTab(label)}>
              <Ic n={icon} />{label}
            </div>
          ))}
        </div>
        {/* Content */}
        <div>{renderTab()}</div>
      </div>
    </div>
  )
}

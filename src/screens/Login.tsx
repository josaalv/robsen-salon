import React, { useState } from 'react'
import { Avatar } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { usuarios, roles } from '../data/mockData'
import type { Usuario } from '../types'

export function ScreenLogin({ onLogin }: { onLogin: (u: Usuario) => void }) {
  const [rol, setRol] = useState<string>('admin')
  const [email, setEmail] = useState('roberto@robsen.com.mx')
  const [pass, setPass] = useState('robsen2026')
  const [ver, setVer] = useState(false)

  const usuarioPorRol = (r: string) => usuarios.find(u => u.rol === r) || usuarios[0]

  const pickRol = (r: string) => {
    setRol(r)
    const u = usuarioPorRol(r)
    setEmail(u.email)
  }

  const entrar = () => {
    const u = usuarioPorRol(rol)
    onLogin(u)
  }

  const rolActual = roles[rol]

  return (
    <div className="book-wrap">
      {/* Aside marca */}
      <div className="book-aside">
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(600px 420px at 75% 5%, rgba(200,161,74,0.12), transparent 60%)' }}></div>
        <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="logo serif" style={{ fontStyle: 'italic', fontSize: 36, background: 'var(--gold-grad)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Robsen</div>
          <div style={{ fontSize: 10, letterSpacing: '.38em', textTransform: 'uppercase', color: 'var(--text-3)', marginTop: 8 }}>Salón &amp; Spa · Sistema interno</div>

          <div style={{ marginTop: 'auto' }}>
            <h2 className="display" style={{ fontSize: 32, lineHeight: 1.14 }}>El control total<br />de tu salón,<br /><span className="gold-text">en un solo lugar.</span></h2>
            <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 16, maxWidth: 340 }}>Agenda, clientas, finanzas y seguimiento por WhatsApp. Cada miembro del equipo accede sólo a lo que necesita según su rol.</p>
          </div>

          <div style={{ marginTop: 32, display: 'flex', gap: 22, position: 'relative', zIndex: 1 }}>
            {([['lock-key', 'Acceso por roles'], ['shield-check', 'Datos protegidos'], ['users-three', '5 usuarios']] as [string, string][]).map(([ic, t]) => (
              <div key={t} className="vc gap8" style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                <span style={{ color: 'var(--gold)' }}><Ic n={ic} /></span>{t}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Formulario */}
      <div className="book-main" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div className="eyebrow">Bienvenido de nuevo</div>
          <h1 className="display" style={{ fontSize: 28, margin: '8px 0 4px' }}>Inicia sesión</h1>
          <p className="muted" style={{ fontSize: 13.5, marginBottom: 26 }}>Ingresa tus credenciales para acceder al panel.</p>

          <div className="field" style={{ marginBottom: 16 }}>
            <label>Correo electrónico</label>
            <div className="search" style={{ width: '100%', borderRadius: 'var(--r-sm)', padding: '11px 14px' }}>
              <Ic n="envelope-simple" />
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@robsen.com.mx" />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label>Contraseña</label>
            <div className="search" style={{ width: '100%', borderRadius: 'var(--r-sm)', padding: '11px 14px' }}>
              <Ic n="lock-simple" />
              <input type={ver ? 'text' : 'password'} value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" />
              <span style={{ cursor: 'pointer', color: 'var(--text-3)' }} onClick={() => setVer(v => !v)}>
                <Ic n={ver ? 'eye-slash' : 'eye'} />
              </span>
            </div>
          </div>

          <div className="between" style={{ marginBottom: 22, fontSize: 12.5 }}>
            <label className="vc gap8" style={{ cursor: 'pointer', color: 'var(--text-2)' }}>
              <span style={{ width: 16, height: 16, borderRadius: 4, border: '1px solid var(--line)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)' }}>
                <Ic n="check" w="bold" />
              </span>
              Recordarme
            </label>
            <a style={{ color: 'var(--gold)', textDecoration: 'none', cursor: 'pointer' }}>¿Olvidaste tu contraseña?</a>
          </div>

          <button className="btn gold w100" style={{ justifyContent: 'center', padding: '13px' }} onClick={entrar}>
            <Ic n="sign-in" />Entrar como {rolActual?.nombre || 'Administrador'}
          </button>

          {/* Acceso rápido demo por rol */}
          <div style={{ marginTop: 28 }}>
            <div className="vc gap12" style={{ marginBottom: 12 }}>
              <hr className="hr" style={{ flex: 1 }} />
              <span className="dim" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em' }}>Acceso demo por rol</span>
              <hr className="hr" style={{ flex: 1 }} />
            </div>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {Object.values(roles).map(r => {
                const u = usuarioPorRol(r.id)
                return (
                  <div key={r.id} className={'opt-card' + (rol === r.id ? ' sel' : '')} style={{ padding: '12px 14px' }} onClick={() => pickRol(r.id)}>
                    <Avatar ini={u.ini} color={u.color} size="sm" />
                    <div className="f1" style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{r.nombre}</div>
                      <div className="dim" style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.desc}</div>
                    </div>
                    <div className="check" style={{ width: 18, height: 18 }}><Ic n="check" w="bold" /></div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import React, { useState } from 'react'
import { Avatar } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { roles } from '../data/mockData'
import { useStore } from '../data/store'
import { db } from '../lib/db'
import type { Usuario } from '../types'

export function ScreenLogin({ onLogin }: { onLogin: (u: Usuario) => void }) {
  const { data } = useStore()
  const [email, setEmail] = useState('roberto@robsen.com.mx')
  const [pass, setPass] = useState('')
  const [ver, setVer] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const entrar = async () => {
    setError('')
    if (!email.trim() || !pass.trim()) {
      setError('Ingresa tu correo y contraseña.')
      return
    }
    setLoading(true)
    try {
      // Intentar cargar desde Supabase primero; si falla, usar datos locales
      let usuarios = data.usuarios
      try {
        const fromDb = await db.getUsuarios()
        if (fromDb.length) usuarios = fromDb
      } catch { /* usar datos locales */ }

      const u = usuarios.find(x => x.email.toLowerCase() === email.trim().toLowerCase())
      if (!u) { setError('No existe una cuenta con ese correo.'); return }
      if (!u.activo) { setError('Esta cuenta está desactivada.'); return }
      const correctPass = u.pass || 'robsen2026'
      if (pass.trim() !== correctPass) { setError('Contraseña incorrecta. Prueba: robsen2026'); return }
      onLogin(u)
    } catch (e) {
      console.error('[login]', e)
      setError('Error al iniciar sesión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') entrar() }

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
              <input value={email} onChange={e => { setEmail(e.target.value); setError('') }} onKeyDown={handleKey} placeholder="tu@robsen.com.mx" />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label>Contraseña</label>
            <div className="search" style={{ width: '100%', borderRadius: 'var(--r-sm)', padding: '11px 14px' }}>
              <Ic n="lock-simple" />
              <input type={ver ? 'text' : 'password'} value={pass} onChange={e => { setPass(e.target.value); setError('') }} onKeyDown={handleKey} placeholder="••••••••" />
              <span style={{ cursor: 'pointer', color: 'var(--text-3)' }} onClick={() => setVer(v => !v)}>
                <Ic n={ver ? 'eye-slash' : 'eye'} />
              </span>
            </div>
          </div>

          {error && (
            <div style={{ background: 'rgba(220,80,80,0.1)', border: '1px solid rgba(220,80,80,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--st-canc)', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Ic n="warning-circle" /> {error}
            </div>
          )}

          <button className="btn gold w100" style={{ justifyContent: 'center', padding: '13px', marginBottom: 8 }} onClick={entrar} disabled={loading}>
            {loading ? <><Ic n="spinner" />Verificando…</> : <><Ic n="sign-in" />Entrar</>}
          </button>

          {/* Acceso rápido demo */}
          <div style={{ marginTop: 28 }}>
            <div className="vc gap12" style={{ marginBottom: 12 }}>
              <hr className="hr" style={{ flex: 1 }} />
              <span className="dim" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em' }}>Acceso demo por rol</span>
              <hr className="hr" style={{ flex: 1 }} />
            </div>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {data.usuarios.filter(u => u.activo).map(u => {
                const r = roles[u.rol]
                return (
                  <div key={u.id} className="opt-card" style={{ padding: '12px 14px' }}
                    onClick={() => { setEmail(u.email); setPass(u.pass || 'robsen2026'); setError('') }}>
                    <Avatar ini={u.ini} color={u.color} size="sm" />
                    <div className="f1" style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{r?.nombre || u.rol}</div>
                      <div className="dim" style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.nombre}</div>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="dim" style={{ fontSize: 11, textAlign: 'center', marginTop: 10 }}>Contraseña demo: <strong>robsen2026</strong></p>
          </div>
        </div>
      </div>
    </div>
  )
}

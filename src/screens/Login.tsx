import React, { useState, useEffect } from 'react'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { db } from '../lib/db'
import { hasSupabase } from '../lib/supabase'
import type { Usuario } from '../types'

export function ScreenLogin({ onLogin }: { onLogin: (u: Usuario) => void }) {
  const [email, setEmail] = useState('')
  const [pass, setPass]   = useState('')
  const [ver, setVer]     = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Limpia los campos al montar para evitar que el navegador rellene autofill
  useEffect(() => {
    setEmail('')
    setPass('')
    setError('')
  }, [])

  const entrar = async () => {
    setError('')
    if (!email.trim() || !pass.trim()) {
      setError('Ingresa tu correo y contraseña.')
      return
    }
    if (!hasSupabase) {
      setError('No hay conexión con la base de datos. Contacta al administrador.')
      return
    }
    setLoading(true)
    try {
      const usuarios = await db.getUsuarios()
      const u = usuarios.find(x => x.email.toLowerCase() === email.trim().toLowerCase())
      if (!u)       { setError('No existe una cuenta con ese correo.'); return }
      if (!u.activo){ setError('Esta cuenta está desactivada.'); return }
      if (!u.pass || pass.trim() !== u.pass) { setError('Contraseña incorrecta.'); return }
      onLogin(u)
    } catch (e) {
      console.error('[login]', e)
      setError('Error al conectar con la base de datos. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="book-wrap">

      {/* ── Lado marca ─────────────────────────────────────────────────── */}
      <div className="book-aside">
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(600px 420px at 75% 5%, rgba(200,161,74,0.12), transparent 60%)' }} />
        <div style={{ position:'relative', zIndex:1, flex:1, display:'flex', flexDirection:'column' }}>
          <div className="logo serif" style={{ fontStyle:'italic', fontSize:36, background:'var(--gold-grad)', WebkitBackgroundClip:'text', backgroundClip:'text', WebkitTextFillColor:'transparent' }}>
            Robsen
          </div>
          <div style={{ fontSize:10, letterSpacing:'.38em', textTransform:'uppercase', color:'var(--text-3)', marginTop:8 }}>
            Salón &amp; Spa · Sistema interno
          </div>

          <div style={{ marginTop:'auto' }}>
            <h2 className="display" style={{ fontSize:32, lineHeight:1.14 }}>
              El control total<br />de tu salón,<br />
              <span className="gold-text">en un solo lugar.</span>
            </h2>
            <p className="muted" style={{ fontSize:13.5, lineHeight:1.6, marginTop:16, maxWidth:340 }}>
              Agenda, clientas, finanzas y seguimiento por WhatsApp. Cada miembro del equipo accede sólo a lo que necesita según su rol.
            </p>
          </div>

          <div style={{ marginTop:32, display:'flex', gap:22, position:'relative', zIndex:1 }}>
            {([['lock-key','Acceso por roles'],['shield-check','Datos protegidos'],['users-three','5 usuarios']] as [string,string][]).map(([ic, t]) => (
              <div key={t} className="vc gap8" style={{ fontSize:11.5, color:'var(--text-3)' }}>
                <span style={{ color:'var(--gold)' }}><Ic n={ic} /></span>{t}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Formulario ────────────────────────────────────────────────── */}
      <div className="book-main" style={{ alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:'100%', maxWidth:420 }}>
          <div className="eyebrow">Bienvenido de nuevo</div>
          <h1 className="display" style={{ fontSize:28, margin:'8px 0 4px' }}>Inicia sesión - versión nueva</h1>
          <p className="muted" style={{ fontSize:13.5, marginBottom:26 }}>
            Ingresa tus credenciales para acceder al panel.
          </p>

          {/* Trampa invisible para evitar autofill del navegador */}
          <div style={{ display:'none', height:0, overflow:'hidden', opacity:0, position:'absolute' }} aria-hidden="true">
            <input type="text" name="rb_fake_user" tabIndex={-1} />
            <input type="password" name="rb_fake_pass" tabIndex={-1} />
          </div>

          <form
            autoComplete="off"
            onSubmit={e => { e.preventDefault(); entrar() }}
            style={{ display:'contents' }}
          >
            {/* Correo */}
            <div className="field" style={{ marginBottom:16 }}>
              <label htmlFor="rb_email">Correo electrónico</label>
              <div className="search" style={{ width:'100%', borderRadius:'var(--r-sm)', padding:'11px 14px' }}>
                <Ic n="envelope-simple" />
                <input
                  id="rb_email"
                  type="text"
                  name="rb_email"
                  autoComplete="off"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  placeholder="tu@robsen.com.mx"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Contraseña */}
            <div className="field" style={{ marginBottom:12 }}>
              <label htmlFor="rb_pass">Contraseña</label>
              <div className="search" style={{ width:'100%', borderRadius:'var(--r-sm)', padding:'11px 14px' }}>
                <Ic n="lock-simple" />
                <input
                  id="rb_pass"
                  type={ver ? 'text' : 'password'}
                  name="rb_pass"
                  autoComplete="new-password"
                  value={pass}
                  onChange={e => { setPass(e.target.value); setError('') }}
                  placeholder="••••••••"
                  disabled={loading}
                />
                <span style={{ cursor:'pointer', color:'var(--text-3)' }} onClick={() => setVer(v => !v)}>
                  <Ic n={ver ? 'eye-slash' : 'eye'} />
                </span>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ background:'rgba(220,80,80,0.1)', border:'1px solid rgba(220,80,80,0.3)', borderRadius:8, padding:'10px 14px', fontSize:13, color:'var(--st-canc)', marginBottom:14, display:'flex', gap:8, alignItems:'center' }}>
                <Ic n="warning-circle" /> {error}
              </div>
            )}

            <button
              type="submit"
              className="btn gold w100"
              style={{ justifyContent:'center', padding:'13px' }}
              disabled={loading}
            >
              {loading
                ? <><Ic n="spinner" />Verificando…</>
                : <><Ic n="sign-in" />Entrar</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

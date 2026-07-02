import React, { useState, useEffect, useRef } from 'react'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { db } from '../lib/db'
import { supabase, hasSupabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Usuario } from '../types'

const ROL_LABEL: Record<string, string> = {
  admin: 'Administrador', gerente: 'Gerente',
  recepcion: 'Recepción', estilista: 'Estilista',
}

type Step = 'picker' | 'password' | 'forgot' | 'reset'

export function ScreenLogin() {
  const { passwordRecovery, clearPasswordRecovery } = useAuth()
  const [usuarios, setUsuarios]   = useState<Usuario[]>([])
  const [cargando, setCargando]   = useState(true)
  const [step, setStep]           = useState<Step>('picker')
  const [selected, setSelected]   = useState<Usuario | null>(null)
  const [pass, setPass]           = useState('')
  const [ver, setVer]             = useState(false)
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const passRef = useRef<HTMLInputElement>(null)

  const [searchQ, setSearchQ]       = useState('')
  const [searching, setSearching]   = useState(false)

  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent]   = useState(false)

  const [resetPass, setResetPass]   = useState('')
  const [resetConf, setResetConf]   = useState('')
  const [resetOk, setResetOk]       = useState(false)

  // Supabase dispara el evento PASSWORD_RECOVERY cuando la persona abre el
  // enlace de "olvidé mi contraseña" desde su correo.
  useEffect(() => {
    if (passwordRecovery) setStep('reset')
  }, [passwordRecovery])

  const cargarUsuarios = () => {
    if (!hasSupabase) { setCargando(false); return }
    setCargando(true); setError('')
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 10000)
    )
    Promise.race([db.getUsuariosPublicos(), timeout])
      .then((list: any) => setUsuarios((list as typeof usuarios).filter(u => u.activo)))
      .catch(() => setError('No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.'))
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    cargarUsuarios()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (step === 'password' && selected) {
      setPass(''); setError(''); setVer(false)
      setTimeout(() => passRef.current?.focus(), 80)
    }
  }, [step, selected])

  const seleccionar = (u: Usuario) => { setSelected(u); setStep('password') }

  const buscarPorContacto = async () => {
    if (!searchQ.trim()) return
    setSearching(true); setError('')
    try {
      const u = await db.getUsuarioByEmailOrTel(searchQ.trim())
      if (!u) { setError('No se encontró ningún usuario con ese correo o teléfono.'); return }
      seleccionar(u)
    } catch {
      setError('Error al buscar. Intenta de nuevo.')
    } finally {
      setSearching(false)
    }
  }

  const entrar = async () => {
    if (!selected || !supabase) return
    if (!pass.trim()) { setError('Ingresa tu contraseña.'); return }
    setLoading(true); setError('')
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: selected.email, password: pass,
      })
      if (authErr) { setError('Correo o contraseña incorrectos.'); return }
      // El AuthProvider detecta la sesión y carga el perfil automáticamente.
    } catch {
      setError('Error al iniciar sesión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const enviarRecuperacion = async () => {
    if (!forgotEmail.trim() || !supabase) { setError('Ingresa tu correo electrónico.'); return }
    setLoading(true); setError('')
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(
        forgotEmail.trim().toLowerCase(),
        { redirectTo: window.location.origin }
      )
      if (err) throw err
      setForgotSent(true)
    } catch (err) {
      // Supabase limita cuántos correos puede mandar en poco tiempo (más
      // estricto todavía con el servicio de correo de prueba por defecto).
      // Reintentar de inmediato solo empeora el límite, así que se avisa
      // en vez de invitar a insistir.
      const status = (err as { status?: number })?.status
      const msg = err instanceof Error ? err.message : ''
      if (status === 429 || /rate.?limit/i.test(msg)) {
        setError('Se enviaron demasiados correos en poco tiempo. Espera unos minutos antes de volver a intentarlo — no sirve de nada reintentar de inmediato.')
      } else {
        setError('No se pudo enviar el enlace. Intenta de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  const resetearPass = async () => {
    if (!resetPass || !resetConf || !supabase) { setError('Completa ambos campos.'); return }
    if (resetPass.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (resetPass !== resetConf) { setError('Las contraseñas no coinciden.'); return }
    setLoading(true); setError('')
    try {
      const { error: err } = await supabase.auth.updateUser({ password: resetPass })
      if (err) throw err
      setResetOk(true)
      // No se llama clearPasswordRecovery() aquí a propósito: mientras
      // siga en true, LoginGate mantiene esta pantalla visible para que
      // la persona vea la confirmación. Se limpia al pulsar "Volver al
      // inicio", que es cuando de verdad debe continuar a la app.
    } catch {
      setError('El enlace expiró o ya fue usado. Solicita uno nuevo.')
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
          <div style={{ fontSize:9, color:'var(--text-3)', opacity:0.45, marginTop:4, letterSpacing:'.06em' }}>v1.03</div>
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
            {([['lock-key','Acceso por roles'],['shield-check','Datos protegidos'],['users-three','Equipo']] as [string,string][]).map(([ic, t]) => (
              <div key={t} className="vc gap8" style={{ fontSize:11.5, color:'var(--text-3)' }}>
                <span style={{ color:'var(--gold)' }}><Ic n={ic} /></span>{t}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Formulario ────────────────────────────────────────────────── */}
      <div className="book-main" style={{ alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:'100%', maxWidth:460 }}>

          {/* ── RESET desde link de email ── */}
          {step === 'reset' && (
            <>
              <div className="eyebrow">Nueva contraseña</div>
              <h1 className="display" style={{ fontSize:28, margin:'8px 0 18px' }}>Restablecer contraseña</h1>
              {resetOk ? (
                <div style={{ background:'rgba(80,180,80,0.1)', border:'1px solid rgba(80,180,80,0.3)', borderRadius:8, padding:'14px 16px', fontSize:13.5, color:'#6fcf6f', display:'flex', gap:8, alignItems:'center', marginBottom:20 }}>
                  <Ic n="check-circle" /> Contraseña actualizada. Ahora puedes iniciar sesión.
                </div>
              ) : (
                <>
                  <div className="field" style={{ marginBottom:12 }}>
                    <label>Nueva contraseña</label>
                    <div className="search" style={{ width:'100%', borderRadius:'var(--r-sm)', padding:'11px 14px' }}>
                      <Ic n="lock-simple" />
                      <input type="password" value={resetPass} onChange={e => { setResetPass(e.target.value); setError('') }} placeholder="Mínimo 8 caracteres" disabled={loading} autoFocus />
                    </div>
                  </div>
                  <div className="field" style={{ marginBottom:14 }}>
                    <label>Confirmar contraseña</label>
                    <div className="search" style={{ width:'100%', borderRadius:'var(--r-sm)', padding:'11px 14px' }}>
                      <Ic n="lock-simple" />
                      <input type="password" value={resetConf} onChange={e => { setResetConf(e.target.value); setError('') }} placeholder="Repite la contraseña" disabled={loading} onKeyDown={e => e.key === 'Enter' && resetearPass()} />
                    </div>
                  </div>
                  {error && <ErrorBox msg={error} />}
                  <button className="btn gold w100" style={{ justifyContent:'center', padding:'13px' }} onClick={resetearPass} disabled={loading}>
                    {loading ? <><Ic n="spinner" />Guardando…</> : <><Ic n="check" />Guardar contraseña</>}
                  </button>
                </>
              )}
              <button onClick={() => { clearPasswordRecovery(); setStep('picker') }} style={{ marginTop:16, background:'none', border:'none', cursor:'pointer', color:'var(--text-3)', fontSize:12, display:'flex', alignItems:'center', gap:6, padding:0 }}>
                <Ic n="arrow-left" /> Volver al inicio
              </button>
            </>
          )}

          {/* ── RECUPERAR CONTRASEÑA ── */}
          {step === 'forgot' && (
            <>
              <button onClick={() => { setStep('picker'); setForgotEmail(''); setForgotSent(false); setError('') }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-3)', fontSize:12, display:'flex', alignItems:'center', gap:6, marginBottom:24, padding:0 }}>
                <Ic n="arrow-left" /> Volver
              </button>
              <div className="eyebrow">Acceso</div>
              <h1 className="display" style={{ fontSize:28, margin:'8px 0 6px' }}>Recuperar contraseña</h1>
              <p className="muted" style={{ fontSize:13.5, marginBottom:22 }}>
                Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
              </p>
              {forgotSent ? (
                <div style={{ background:'rgba(80,180,80,0.1)', border:'1px solid rgba(80,180,80,0.3)', borderRadius:8, padding:'14px 16px', fontSize:13.5, color:'#6fcf6f', display:'flex', gap:8, alignItems:'center' }}>
                  <Ic n="check-circle" /> Revisa tu correo. Si el email está registrado, recibirás el enlace en breve.
                </div>
              ) : (
                <>
                  <div className="field" style={{ marginBottom:12 }}>
                    <label>Correo electrónico</label>
                    <div className="search" style={{ width:'100%', borderRadius:'var(--r-sm)', padding:'11px 14px' }}>
                      <Ic n="envelope-simple" />
                      <input type="email" value={forgotEmail} onChange={e => { setForgotEmail(e.target.value); setError('') }} placeholder="tu@correo.com" disabled={loading} autoFocus onKeyDown={e => e.key === 'Enter' && enviarRecuperacion()} />
                    </div>
                  </div>
                  {error && <ErrorBox msg={error} />}
                  <button className="btn gold w100" style={{ justifyContent:'center', padding:'13px' }} onClick={enviarRecuperacion} disabled={loading}>
                    {loading ? <><Ic n="spinner" />Enviando…</> : <><Ic n="paper-plane-tilt" />Enviar enlace</>}
                  </button>
                </>
              )}
            </>
          )}

          {/* ── PASO 1: selector de perfiles ── */}
          {step === 'picker' && (
            <>
              <div className="eyebrow">Bienvenido de nuevo</div>
              <h1 className="display" style={{ fontSize:28, margin:'8px 0 4px' }}>¿Quién eres?</h1>
              <p className="muted" style={{ fontSize:13.5, marginBottom:18 }}>
                Selecciona tu perfil o búscate por correo / teléfono.
              </p>

              {!hasSupabase && (
                <div style={{ background:'rgba(220,80,80,0.1)', border:'1px solid rgba(220,80,80,0.3)', borderRadius:8, padding:'10px 14px', fontSize:13, color:'var(--st-canc)', marginBottom:16, display:'flex', gap:8, alignItems:'center' }}>
                  <Ic n="warning-circle" /> Sin conexión a la base de datos. Contacta al administrador.
                </div>
              )}

              {/* Buscador por correo o teléfono */}
              <div style={{ display:'flex', gap:8, marginBottom:20 }}>
                <div className="search" style={{ flex:1, borderRadius:'var(--r-sm)', padding:'9px 12px' }}>
                  <Ic n="magnifying-glass" />
                  <input
                    type="text"
                    value={searchQ}
                    onChange={e => { setSearchQ(e.target.value); setError('') }}
                    placeholder="Buscar por correo o teléfono…"
                    disabled={searching}
                    onKeyDown={e => e.key === 'Enter' && buscarPorContacto()}
                  />
                </div>
                <button className="btn ghost" style={{ padding:'9px 14px', whiteSpace:'nowrap' }} onClick={buscarPorContacto} disabled={searching || !searchQ.trim()}>
                  {searching ? <Ic n="spinner" /> : 'Buscar'}
                </button>
              </div>

              {cargando ? (
                <div className="vc" style={{ gap:10, color:'var(--text-3)', fontSize:13, justifyContent:'center', padding:'32px 0' }}>
                  <Ic n="spinner" /> Cargando perfiles…
                </div>
              ) : error ? (
                <div style={{ textAlign:'center', padding:'24px 0' }}>
                  <div style={{ color:'var(--st-canc)', fontSize:13, marginBottom:14 }}>{error}</div>
                  <button className="btn ghost" onClick={cargarUsuarios}><Ic n="arrows-clockwise" />Reintentar</button>
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px, 1fr))', gap:12 }}>
                  {usuarios.map(u => (
                    <button
                      key={u.id}
                      onClick={() => seleccionar(u)}
                      style={{
                        background:'var(--surface-2)', border:'1px solid var(--line-soft)',
                        borderRadius:14, padding:'20px 14px 16px', cursor:'pointer',
                        display:'flex', flexDirection:'column', alignItems:'center', gap:12,
                        transition:'border-color .18s, transform .18s',
                        textAlign:'center',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--line-soft)'; (e.currentTarget as HTMLElement).style.transform = '' }}
                    >
                      {u.avatar
                        ? <img src={u.avatar} alt={u.ini} style={{ width:56, height:56, borderRadius:'50%', objectFit:'cover', border:'2px solid var(--line)' }} />
                        : <div style={{ width:56, height:56, borderRadius:'50%', background: u.color || 'var(--gold)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700, color:'#1a1410', fontFamily:'var(--serif)' }}>
                            {u.ini}
                          </div>
                      }
                      <div>
                        <div style={{ fontWeight:600, fontSize:13, color:'var(--text)' }}>{u.nombre.split(' ')[0]}</div>
                        <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>{ROL_LABEL[u.rol] || u.rol}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── PASO 2: contraseña ── */}
          {step === 'password' && selected && (
            <>
              {/* Avatar + nombre seleccionado */}
              <button
                onClick={() => { setStep('picker'); setSelected(null) }}
                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-3)', fontSize:12, display:'flex', alignItems:'center', gap:6, marginBottom:24, padding:0 }}
              >
                <Ic n="arrow-left" /> Cambiar perfil
              </button>

              <div className="vc gap14" style={{ marginBottom:28 }}>
                {selected.avatar
                  ? <img src={selected.avatar} alt={selected.ini} style={{ width:64, height:64, borderRadius:'50%', objectFit:'cover', border:'2px solid var(--gold)' }} />
                  : <div style={{ width:64, height:64, borderRadius:'50%', background: selected.color || 'var(--gold)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, fontWeight:700, color:'#1a1410', fontFamily:'var(--serif)' }}>
                      {selected.ini}
                    </div>
                }
                <div>
                  <div style={{ fontWeight:700, fontSize:18 }}>{selected.nombre}</div>
                  <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>{ROL_LABEL[selected.rol] || selected.rol}</div>
                </div>
              </div>

              {/* Trampa invisible para evitar autofill del navegador */}
              <div style={{ display:'none', height:0, overflow:'hidden', opacity:0, position:'absolute' }} aria-hidden="true">
                <input type="text" name="rb_fake_user" tabIndex={-1} />
                <input type="password" name="rb_fake_pass" tabIndex={-1} />
              </div>

              <form autoComplete="off" onSubmit={e => { e.preventDefault(); entrar() }} style={{ display:'contents' }}>
                <div className="field" style={{ marginBottom:12 }}>
                  <label htmlFor="rb_pass">Contraseña</label>
                  <div className="search" style={{ width:'100%', borderRadius:'var(--r-sm)', padding:'11px 14px' }}>
                    <Ic n="lock-simple" />
                    <input
                      ref={passRef}
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

                {error && <ErrorBox msg={error} />}

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

                <button
                  type="button"
                  onClick={() => { setStep('forgot'); setError('') }}
                  style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-3)', fontSize:12, marginTop:14, display:'block', textAlign:'center', width:'100%' }}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{ background:'rgba(220,80,80,0.1)', border:'1px solid rgba(220,80,80,0.3)', borderRadius:8, padding:'10px 14px', fontSize:13, color:'var(--st-canc)', marginBottom:14, display:'flex', gap:8, alignItems:'center' }}>
      <Ic n="warning-circle" /> {msg}
    </div>
  )
}

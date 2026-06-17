import React, { useState } from 'react'
import { Avatar } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { useStore } from '../data/store'
import { mxn } from '../lib/helpers'
import type { Servicio, Estilista } from '../types'

export function ScreenBooking() {
  const { data } = useStore()
  const [step, setStep] = useState(1)
  const [srv, setSrv] = useState<Servicio | null>(null)
  const [prof, setProf] = useState<string | null>(null)
  const [dia, setDia] = useState(12)
  const [hora, setHora] = useState<string | null>(null)

  const online = data.servicios.filter(s => s.online)
  const profs: Estilista[] = srv
    ? srv.prof.map(id => data.estilistas.find(e => e.id === id)).filter((e): e is Estilista => Boolean(e))
    : []
  const anticipo = srv?.anticipo ? Math.round(srv.precio * 0.35) : 0
  const slots = ['09:00', '09:30', '10:30', '11:00', '12:30', '13:00', '14:00', '16:00', '17:00', '18:00']
  const off = ['10:30', '14:00']

  const steps: [string, string][] = [
    ['Servicio', 'scissors'],
    ['Profesional', 'user'],
    ['Fecha y hora', 'calendar-blank'],
    ['Tus datos', 'identification-card'],
    ['Confirmación', 'check-circle'],
  ]
  const next = () => setStep(s => Math.min(5, s + 1))
  const back = () => setStep(s => Math.max(1, s - 1))
  const canNext = (step === 1 && !!srv) || (step === 2 && !!prof) || (step === 3 && !!hora) || step === 4

  const reset = () => { setStep(1); setSrv(null); setProf(null); setHora(null) }

  return (
    <div className="book-wrap">
      {/* Aside brand */}
      <div className="book-aside">
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(600px 400px at 80% 0%, rgba(200,161,74,0.10), transparent 60%)' }}></div>
        <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="logo serif" style={{ fontStyle: 'italic', fontSize: 34, background: 'var(--gold-grad)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Robsen</div>
          <div style={{ fontSize: 10, letterSpacing: '.36em', textTransform: 'uppercase', color: 'var(--text-3)', marginTop: 8 }}>Salón &amp; Spa · Guadalajara</div>

          <div style={{ marginTop: 'auto' }}>
            <h2 className="display" style={{ fontSize: 30, lineHeight: 1.15 }}>
              Reserva tu<br /><span className="gold-text">experiencia de belleza</span>
            </h2>
            <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 14, maxWidth: 320 }}>
              Agenda en línea en unos pasos. Apartas tu lugar con un anticipo y nuestro equipo confirma tu cita personalmente.
            </p>
          </div>

          <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {steps.map(([t, ic], i) => {
              const n = i + 1
              const st = step === n ? 'active' : step > n ? 'done' : ''
              return (
                <div key={t} className={'step-dot ' + st}>
                  <span className="n">{step > n ? <Ic n="check" /> : n}</span>{t}
                </div>
              )
            })}
          </div>
        </div>
        <div style={{ position: 'relative', zIndex: 1, marginTop: 28, paddingTop: 18, borderTop: '1px solid var(--line)', fontSize: 11.5, color: 'var(--text-3)' }}>
          <div className="vc gap8"><Ic n="map-pin" />Av. Enrique Díaz de León Nte 2093, GDL</div>
          <div className="vc gap8 mt6"><Ic n="phone" />33 3826 0774</div>
        </div>
      </div>

      {/* Main */}
      <div className="book-main">
        <div style={{ maxWidth: 640, width: '100%', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="eyebrow">Paso {Math.min(step, 5)} de 5</div>

          {/* Step 1: Service selection */}
          {step === 1 && (
            <div className="mt14">
              <h1 className="display" style={{ fontSize: 27, margin: '0 0 4px' }}>Elige tu servicio</h1>
              <p className="muted" style={{ fontSize: 13.5, marginBottom: 22 }}>Selecciona el servicio que deseas agendar.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto', paddingRight: 6 }}>
                {online.map(s => (
                  <div key={s.id} className={'opt-card' + (srv?.id === s.id ? ' sel' : '')} onClick={() => { setSrv(s); setProf(null) }}>
                    <div className="f1">
                      <div style={{ fontWeight: 600, fontSize: 14.5 }}>{s.nombre}</div>
                      <div className="vc gap12 mt6" style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        <span className="badge neutral" style={{ fontSize: 10.5 }}>{s.cat}</span>
                        <span className="vc" style={{ gap: 4 }}><Ic n="clock" />{s.dur} min</span>
                      </div>
                    </div>
                    <div className="num gold-text serif" style={{ fontSize: 19, fontWeight: 600, marginRight: 6 }}>{mxn(s.precio)}</div>
                    <div className="check"><Ic n="check" /></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Stylist selection */}
          {step === 2 && srv && (
            <div className="mt14">
              <h1 className="display" style={{ fontSize: 27, margin: '0 0 4px' }}>Elige a tu estilista</h1>
              <p className="muted" style={{ fontSize: 13.5, marginBottom: 22 }}>Para tu {srv.nombre}. Puedes dejar que asignemos a la mejor disponible.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className={'opt-card' + (prof === 'any' ? ' sel' : '')} onClick={() => setProf('any')}>
                  <div className="avatar" style={{ background: 'rgba(200,161,74,0.12)', color: 'var(--gold)', border: '1px solid var(--line)' }}><Ic n="sparkle" /></div>
                  <div className="f1">
                    <div style={{ fontWeight: 600, fontSize: 14.5 }}>Sin preferencia</div>
                    <div className="dim" style={{ fontSize: 12, marginTop: 3 }}>Asignamos a la mejor estilista disponible</div>
                  </div>
                  <div className="check"><Ic n="check" /></div>
                </div>
                {profs.map(p => (
                  <div key={p.id} className={'opt-card' + (prof === p.id ? ' sel' : '')} onClick={() => setProf(p.id)}>
                    <Avatar ini={p.ini} color={p.color} />
                    <div className="f1">
                      <div style={{ fontWeight: 600, fontSize: 14.5 }}>{p.nombre}</div>
                      <div className="dim" style={{ fontSize: 12, marginTop: 3 }}>{p.rol} · 4.9 ★</div>
                    </div>
                    <div className="check"><Ic n="check" /></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Date & time */}
          {step === 3 && (
            <div className="mt14">
              <h1 className="display" style={{ fontSize: 27, margin: '0 0 4px' }}>Fecha y hora</h1>
              <p className="muted" style={{ fontSize: 13.5, marginBottom: 22 }}>Selecciona el día y horario de tu preferencia.</p>
              <div className="vc gap8" style={{ marginBottom: 20, flexWrap: 'wrap' }}>
                {([['Mié', 11], ['Jue', 12], ['Vie', 13], ['Sáb', 14], ['Lun', 16], ['Mar', 17]] as [string, number][]).map(([d, n]) => (
                  <div key={n} className={'timeslot' + (dia === n ? ' sel' : '')} style={{ minWidth: 64 }} onClick={() => setDia(n)}>
                    <div style={{ fontSize: 11, fontWeight: 600, opacity: .8 }}>{d}</div>
                    <div className="serif" style={{ fontSize: 18 }}>{n}</div>
                  </div>
                ))}
              </div>
              <div className="eyebrow" style={{ marginBottom: 12 }}>Horarios disponibles · Junio {dia}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
                {slots.map(s => {
                  const dis = off.includes(s)
                  return (
                    <div key={s} className={'timeslot' + (hora === s ? ' sel' : '') + (dis ? ' off' : '')} onClick={() => !dis && setHora(s)}>
                      {s}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 4: Client data */}
          {step === 4 && (
            <div className="mt14">
              <h1 className="display" style={{ fontSize: 27, margin: '0 0 4px' }}>Tus datos</h1>
              <p className="muted" style={{ fontSize: 13.5, marginBottom: 22 }}>Para confirmar tu cita y enviarte recordatorios por WhatsApp.</p>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="field"><label>Nombre completo</label><input className="input" placeholder="Tu nombre" /></div>
                <div className="field"><label>Teléfono (WhatsApp)</label><input className="input" placeholder="33 0000 0000" /></div>
                <div className="field" style={{ gridColumn: '1 / -1' }}><label>Correo (opcional)</label><input className="input" placeholder="tucorreo@mail.com" /></div>
                <div className="field" style={{ gridColumn: '1 / -1' }}><label>Notas para tu estilista (opcional)</label><textarea className="input" rows={2} placeholder="Alergias, preferencias, inspiración…"></textarea></div>
              </div>
              {anticipo > 0 && (
                <div className="card gold-edge mt18" style={{ padding: 18 }}>
                  <div className="vc gap12"><span style={{ color: 'var(--gold)' }}><Ic n="hand-coins" /></span><span style={{ fontWeight: 600 }}>Anticipo para apartar tu lugar</span></div>
                  <p className="muted" style={{ fontSize: 12.5, marginTop: 10, lineHeight: 1.55 }}>
                    Este servicio requiere un anticipo de <b className="gold-text">{mxn(anticipo)}</b>, que se descuenta del total. El resto lo pagas en el salón.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Confirmation */}
          {step === 5 && (
            <div className="center" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingTop: 20 }}>
              <div style={{ width: 76, height: 76, borderRadius: '50%', background: 'var(--gold-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#241c0c', fontSize: 36, boxShadow: '0 16px 50px -16px var(--gold-glow)' }}>
                <Ic n="check" />
              </div>
              <h1 className="display" style={{ fontSize: 30, margin: '22px 0 8px' }}>¡Solicitud recibida!</h1>
              <p className="muted" style={{ fontSize: 14, maxWidth: 420, lineHeight: 1.6 }}>
                Hemos recibido tu solicitud de cita. <b style={{ color: 'var(--gold)' }}>Tu cita será confirmada por nuestro equipo</b> vía WhatsApp en las próximas horas.
              </p>
            </div>
          )}

          {/* Summary bar (steps 2-4) */}
          {step < 5 && srv && (
            <div className="card mt24" style={{ background: 'var(--surface)', padding: '14px 18px', marginTop: 'auto' }}>
              <div className="between">
                <div className="vc gap16" style={{ flexWrap: 'wrap' }}>
                  <span className="vc gap8" style={{ fontSize: 13 }}><Ic n="scissors" />{srv.nombre}</span>
                  {prof && (
                    <span className="vc gap8" style={{ fontSize: 13, color: 'var(--text-2)' }}>
                      <Ic n="user" />{prof === 'any' ? 'Sin preferencia' : data.estilistas.find(e => e.id === prof)?.nombre.split(' ')[0]}
                    </span>
                  )}
                  {hora && (
                    <span className="vc gap8" style={{ fontSize: 13, color: 'var(--text-2)' }}>
                      <Ic n="clock" />Jun {dia} · {hora}
                    </span>
                  )}
                </div>
                <div className="num gold-text serif" style={{ fontSize: 20, fontWeight: 600 }}>{mxn(srv.precio)}</div>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="vc gap12 mt24" style={{ justifyContent: 'space-between' }}>
            {step > 1 && step < 5
              ? <button className="btn ghost" onClick={back}><Ic n="arrow-left" />Atrás</button>
              : <span></span>}
            {step < 4 && (
              <button
                className="btn gold"
                disabled={!canNext}
                style={{ opacity: canNext ? 1 : .4, pointerEvents: canNext ? 'auto' : 'none' }}
                onClick={next}
              >
                Continuar<Ic n="arrow-right" />
              </button>
            )}
            {step === 4 && (
              <button className="btn gold" onClick={next}>
                <Ic n="check" />{anticipo > 0 ? `Pagar anticipo ${mxn(anticipo)}` : 'Solicitar cita'}
              </button>
            )}
            {step === 5 && (
              <button className="btn gold w100" style={{ justifyContent: 'center' }} onClick={reset}>
                Agendar otra cita
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

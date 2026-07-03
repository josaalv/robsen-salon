import React, { useState, useMemo } from 'react'
import { Avatar } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { useStore } from '../data/store'
import { mxn, telefonoValido, telefonoError, filtrarTel } from '../lib/helpers'
import type { Servicio, Estilista } from '../types'

const DIAS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const HOY = new Date()

function generateSlots(start: number, end: number, slotMin: number): string[] {
  const slots: string[] = []
  for (let h = start; h < end; h++) {
    for (let m = 0; m < 60; m += slotMin) {
      slots.push(String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'))
    }
  }
  return slots
}

export function ScreenBooking() {
  const { data, upsertCitaFutura, upsertClienta } = useStore()
  const cfg = data.config

  const [step, setStep] = useState(1)
  const [srv, setSrv] = useState<Servicio | null>(null)
  const [prof, setProf] = useState<string | null>(null)
  const [hora, setHora] = useState<string | null>(null)

  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteTel, setClienteTel] = useState('')
  const [clienteEmail, setClienteEmail] = useState('')
  const [clienteNotas, setClienteNotas] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Next 6 open days starting from tomorrow
  const nextDays = useMemo(() => {
    const days: { label: string; n: number; date: Date }[] = []
    const d = new Date(HOY)
    d.setDate(d.getDate() + 1)
    while (days.length < 6) {
      const dayIdx = (d.getDay() + 6) % 7
      if (cfg.diasAbiertos[dayIdx]) {
        days.push({ label: DIAS_SHORT[dayIdx], n: d.getDate(), date: new Date(d) })
      }
      d.setDate(d.getDate() + 1)
    }
    return days
  }, [cfg.diasAbiertos])

  const [diaIdx, setDiaIdx] = useState(0)
  const selectedDay = nextDays[diaIdx] || nextDays[0]

  const online = data.servicios.filter(s => s.online && s.activo !== false)
  const profs: Estilista[] = srv
    ? srv.prof.map(id => data.estilistas.find(e => e.id === id)).filter((e): e is Estilista => Boolean(e))
    : []

  const anticipo = srv?.anticipo ? Math.round(srv.precio * cfg.anticipoPct / 100) : 0

  const slots = useMemo(
    () => generateSlots(cfg.agendaStart, cfg.agendaEnd, cfg.slotMin),
    [cfg.agendaStart, cfg.agendaEnd, cfg.slotMin]
  )

  const MESES_SHORT_B = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

  // Blocked slots: bloquea por duración, no solo inicio
  const off = useMemo(() => {
    if (!selectedDay) return []
    const y = selectedDay.date.getFullYear()
    const mo = String(selectedDay.date.getMonth() + 1).padStart(2, '0')
    const dy = String(selectedDay.date.getDate()).padStart(2, '0')
    const fechaStr = `${y}-${mo}-${dy}`
    const ocupadas = data.citasFuturas.filter(c => c.fecha === fechaStr && (prof === 'any' || !prof || c.est === prof))
    const bloqueados = new Set<string>()
    ocupadas.forEach(c => {
      const [hh, mm] = c.h.split(':').map(Number)
      const startMin = hh * 60 + mm
      slots.forEach(s => {
        const [sh, sm] = s.split(':').map(Number)
        const sMin = sh * 60 + sm
        if (sMin >= startMin && sMin < startMin + c.dur) bloqueados.add(s)
      })
    })
    return Array.from(bloqueados)
  }, [selectedDay, data.citasFuturas, prof, slots])

  const steps: [string, string][] = [
    ['Servicio', 'scissors'],
    ['Profesional', 'user'],
    ['Fecha y hora', 'calendar-blank'],
    ['Tus datos', 'identification-card'],
    ['Confirmación', 'check-circle'],
  ]
  const next = () => setStep(s => Math.min(5, s + 1))
  const back = () => setStep(s => Math.max(1, s - 1))
  const canNext = (step === 1 && !!srv) || (step === 2 && !!prof) || (step === 3 && !!hora)

  const telValido = telefonoValido(clienteTel)
  const emailValido = !clienteEmail.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clienteEmail.trim())
  const step4Ok = clienteNombre.trim() && telValido && emailValido

  const submitCita = async () => {
    if (!srv || !prof || !hora || !selectedDay || submitting) return
    if (!clienteNombre.trim() || !telValido || !emailValido) return
    const y = selectedDay.date.getFullYear()
    const mo = String(selectedDay.date.getMonth() + 1).padStart(2, '0')
    const dy = String(selectedDay.date.getDate()).padStart(2, '0')
    const telLimpio = clienteTel.trim() || undefined
    const emailLimpio = clienteEmail.trim() || undefined
    const estId = prof === 'any' ? (srv.prof[0] || 'e1') : prof
    setSubmitting(true)
    setSubmitError('')
    try {
      await upsertCitaFutura({
        id: 'cf' + Date.now(),
        h: hora,
        dur: srv.dur,
        cl: clienteNombre.trim(),
        tel: telLimpio,
        email: emailLimpio,
        srv: srv.nombre,
        servicioId: srv.id,
        est: estId,
        estado: 'pend',
        total: srv.precio,
        ant: anticipo,
        notas: clienteNotas.trim() || undefined,
        fecha: `${y}-${mo}-${dy}`,
      })
      // Registrar o actualizar clienta en CRM
      const nombreLimpio = clienteNombre.trim()
      const existe = data.clientas.find(c =>
        c.nombre.toLowerCase() === nombreLimpio.toLowerCase() ||
        (telLimpio && c.tel.replace(/\D/g,'') === telLimpio.replace(/\D/g,''))
      )
      if (!existe && nombreLimpio) {
        const ini = nombreLimpio.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
        upsertClienta({
          id: 'cl' + Date.now(), nombre: nombreLimpio,
          tel: telLimpio || '', email: emailLimpio, estado: 'Nueva', ultima: '',
          ticket: 0, fav: srv.nombre, est: estId,
          visitas: 0, gasto: 0, ini, cumple: '', ciclo: 4,
        }).catch(() => {})
      }
      next()
    } catch {
      setSubmitError('No se pudo agendar la cita. Verifica tu conexión e intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setStep(1); setSrv(null); setProf(null); setHora(null)
    setClienteNombre(''); setClienteTel(''); setClienteEmail(''); setClienteNotas('')
    setDiaIdx(0)
  }

  return (
    <div className="book-wrap">
      {/* Aside brand */}
      <div className="book-aside">
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(600px 400px at 80% 0%, rgba(200,161,74,0.10), transparent 60%)' }}></div>
        <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="logo serif" style={{ fontStyle: 'italic', fontSize: 34, background: 'var(--gold-grad)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{cfg.nombre}</div>
          <div style={{ fontSize: 10, letterSpacing: '.36em', textTransform: 'uppercase', color: 'var(--text-3)', marginTop: 8 }}>{cfg.direccion}</div>

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
          <div className="vc gap8"><Ic n="map-pin" />{cfg.direccion}</div>
          <div className="vc gap8 mt6"><Ic n="phone" />{cfg.tel}</div>
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
                        {s.anticipo && <span className="vc" style={{ gap: 4, color: 'var(--gold)' }}><Ic n="hand-coins" />Anticipo {cfg.anticipoPct}%</span>}
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
                      <div className="dim" style={{ fontSize: 12, marginTop: 3 }}>{p.rol}</div>
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
                {nextDays.map((d, i) => (
                  <div key={i} className={'timeslot' + (diaIdx === i ? ' sel' : '')} style={{ minWidth: 64 }} onClick={() => { setDiaIdx(i); setHora(null) }}>
                    <div style={{ fontSize: 11, fontWeight: 600, opacity: .8 }}>{d.label}</div>
                    <div className="serif" style={{ fontSize: 18 }}>{d.n}</div>
                  </div>
                ))}
              </div>
              <div className="eyebrow" style={{ marginBottom: 12 }}>
                Horarios disponibles · {selectedDay?.label} {selectedDay?.n} {selectedDay ? MESES_SHORT_B[selectedDay.date.getMonth()] : ''}
              </div>
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
                <div className="field">
                  <label>Nombre completo</label>
                  <input className="input" placeholder="Tu nombre" value={clienteNombre} onChange={e => setClienteNombre(e.target.value)} />
                </div>
                <div className="field">
                  <label>Teléfono (WhatsApp)</label>
                  <input
                    className="input"
                    placeholder="33 1234 5678"
                    value={clienteTel}
                    onChange={e => setClienteTel(filtrarTel(e.target.value))}
                    style={{ borderColor: clienteTel && !telValido ? 'var(--st-canc)' : undefined }}
                  />
                  {clienteTel && !telValido && <div style={{ fontSize: 11.5, color: 'var(--st-canc)', marginTop: 4 }}>{telefonoError(clienteTel)}</div>}
                </div>
                <div className="field" style={{ gridColumn: '1 / -1' }}>
                  <label>Correo (opcional)</label>
                  <input
                    className="input"
                    placeholder="tucorreo@mail.com"
                    value={clienteEmail}
                    onChange={e => setClienteEmail(e.target.value)}
                    style={{ borderColor: clienteEmail && !emailValido ? 'var(--st-canc)' : undefined }}
                  />
                  {clienteEmail && !emailValido && <div style={{ fontSize: 11.5, color: 'var(--st-canc)', marginTop: 4 }}>Correo inválido</div>}
                </div>
                <div className="field" style={{ gridColumn: '1 / -1' }}>
                  <label>Notas para tu estilista (opcional)</label>
                  <textarea className="input" rows={2} placeholder="Alergias, preferencias, inspiración…" value={clienteNotas} onChange={e => setClienteNotas(e.target.value)}></textarea>
                </div>
              </div>
              {anticipo > 0 && (
                <div className="card gold-edge mt18" style={{ padding: 18 }}>
                  <div className="vc gap12"><span style={{ color: 'var(--gold)' }}><Ic n="hand-coins" /></span><span style={{ fontWeight: 600 }}>Anticipo para apartar tu lugar</span></div>
                  <p className="muted" style={{ fontSize: 12.5, marginTop: 10, lineHeight: 1.55 }}>
                    Este servicio requiere un anticipo de <b className="gold-text">{mxn(anticipo)}</b> ({cfg.anticipoPct}%), que se descuenta del total. El resto lo pagas en el salón.
                  </p>
                </div>
              )}
              {submitError && (
                <div className="mt14" style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(220,80,80,0.08)', border: '1px solid rgba(220,80,80,0.25)', color: 'var(--st-canc)', fontSize: 12.5 }}>
                  {submitError}
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
                  {hora && selectedDay && (
                    <span className="vc gap8" style={{ fontSize: 13, color: 'var(--text-2)' }}>
                      <Ic n="clock" />{selectedDay.label} {selectedDay.n} · {hora}
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
              <button
                className="btn gold"
                disabled={!step4Ok || submitting}
                style={{ opacity: step4Ok && !submitting ? 1 : .4, pointerEvents: step4Ok && !submitting ? 'auto' : 'none' }}
                onClick={submitCita}
              >
                <Ic n="check" />{submitting ? 'Enviando…' : (anticipo > 0 ? `Solicitar cita · anticipo ${mxn(anticipo)}` : 'Solicitar cita')}
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

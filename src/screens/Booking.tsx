import React, { useState, useMemo, useEffect } from 'react'
import { Avatar } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { db } from '../lib/db'
import { mxn, telefonoValido, telefonoError, filtrarTel } from '../lib/helpers'
import type { Servicio, Estilista, SalonConfig } from '../types'

const DIAS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const HOY = new Date()

const CONFIG_DEFAULT: SalonConfig = {
  agendaStart: 9, agendaEnd: 20, slotMin: 15, diasAbiertos: [true, true, true, true, true, true, false],
  nombre: 'Robsen Salón & Spa', direccion: '', tel: '', whatsapp: '',
  anticipoPct: 35, requerirAnticipo: true, iva: 0,
  metodospago: { efectivo: true, tarjeta: true, transferencia: true, credito: false },
  acento: '#C8A14A', comisiones: {}, escalaComisiones: [],
} as SalonConfig

// Lo que se guarda justo antes de salir a Mercado Pago, para reconstruir el
// resumen cuando la persona regresa — en ese momento ya no hay React state
// (fue una navegación completa fuera del sitio), solo localStorage.
interface ReservaGuardada {
  citaId: string
  servicio: string
  estilistaNombre: string
  fecha: string
  hora: string
  total: number
  anticipo: number
  clienteNombre: string
}
const RESERVA_KEY = 'rb_booking_pendiente'

function generateSlots(start: number, end: number, slotMin: number): string[] {
  const slots: string[] = []
  for (let h = start; h < end; h++) {
    for (let m = 0; m < 60; m += slotMin) {
      slots.push(String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'))
    }
  }
  return slots
}

const MESES_SHORT_B = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// reCAPTCHA v3 (H-12 de la auditoría): sin VITE_RECAPTCHA_SITE_KEY
// configurada, estas funciones no hacen nada (recaptchaToken llega null) —
// el agendamiento sigue funcionando igual, solo sin la capa de protección
// contra spam hasta que se agregue la llave.
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined
let recaptchaCargando: Promise<void> | null = null

function cargarRecaptcha(): Promise<void> {
  if (!RECAPTCHA_SITE_KEY) return Promise.resolve()
  if ((window as any).grecaptcha) return Promise.resolve()
  if (!recaptchaCargando) {
    recaptchaCargando = new Promise(resolve => {
      const s = document.createElement('script')
      s.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`
      s.onload = () => resolve()
      s.onerror = () => resolve() // si falla cargar, se sigue sin recaptcha — nunca bloquea el agendamiento
      document.head.appendChild(s)
    })
  }
  return recaptchaCargando
}

async function obtenerRecaptchaToken(accion: string): Promise<string | null> {
  if (!RECAPTCHA_SITE_KEY) return null
  await cargarRecaptcha()
  const g = (window as any).grecaptcha
  if (!g) return null
  return new Promise(resolve => {
    g.ready(() => {
      g.execute(RECAPTCHA_SITE_KEY, { action: accion }).then(resolve).catch(() => resolve(null))
    })
  })
}

export function ScreenBooking() {
  // Booking es una pantalla pública real (sin sesión) — a propósito no usa
  // useStore()/loadFromSupabase (esas rutas mezclan datos que 'anon' no
  // puede leer, como usuarios/ventas). Trae solo lo que necesita, con sus
  // propias llamadas — servicios/estilistas/config ya son de lectura anónima
  // (ver 017_close_open_policies.sql); disponibilidad y creación de la
  // reserva pasan por RPCs acotados (ver 060_booking_publico.sql) que nunca
  // exponen la tabla de clientas completa.
  const [cfg, setCfg] = useState<SalonConfig>(CONFIG_DEFAULT)
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [estilistas, setEstilistas] = useState<Estilista[]>([])
  const [cargandoBase, setCargandoBase] = useState(true)

  useEffect(() => {
    Promise.all([db.getConfig(), db.getServicios(), db.getEstilistas()])
      .then(([c, s, e]) => { if (c) setCfg(c); setServicios(s); setEstilistas(e) })
      .finally(() => setCargandoBase(false))
    cargarRecaptcha() // adelantado, para que ya esté listo al llegar al botón de enviar
  }, [])

  // Resumen post-pago: si volvemos de Mercado Pago (?pago=exitoso|fallido|
  // pendiente), se muestra un resumen — nunca la pantalla de login, y nunca
  // el wizard desde cero (ver PublicBookingRoute en App.tsx, que monta esta
  // pantalla sin exigir sesión).
  const [resumenPago, setResumenPago] = useState<null | {
    estado: 'cargando' | 'aprobado' | 'aprobado_sin_agendar' | 'pendiente' | 'en_proceso' | 'rechazado' | 'cancelado'
    reserva: ReservaGuardada | null
  }>(null)

  useEffect(() => {
    const pago = new URLSearchParams(window.location.search).get('pago')
    if (!pago) return
    const raw = localStorage.getItem(RESERVA_KEY)
    const reserva = raw ? (JSON.parse(raw) as ReservaGuardada) : null
    setResumenPago({ estado: 'cargando', reserva })
    if (!reserva) { setResumenPago({ estado: pago === 'exitoso' ? 'aprobado' : 'pendiente', reserva: null }); return }

    let cancelado = false
    ;(async () => {
      // El webhook de Mercado Pago puede tardar unos segundos en llegar —
      // se reintenta unas cuantas veces antes de dejar "pendiente" como
      // último estado conocido (nunca se inventa un resultado).
      for (let i = 0; i < 6 && !cancelado; i++) {
        const r = await db.consultarEstadoPagoPublico(reserva.citaId)
        if (r && (r.estado === 'aprobado' || r.estado === 'rechazado' || r.estado === 'cancelado')) {
          // Caso raro pero de dinero real: el pago se aprobó pero agendar
          // falló del lado del servidor (ej. alguien más tomó ese horario
          // mientras se pagaba) — no se le puede decir "reserva confirmada"
          // a alguien cuya cita nunca se creó.
          const estadoFinal = r.estado === 'aprobado' && r.reservaError ? 'aprobado_sin_agendar' : r.estado
          if (!cancelado) { setResumenPago({ estado: estadoFinal as any, reserva }); localStorage.removeItem(RESERVA_KEY) }
          return
        }
        await new Promise(res => setTimeout(res, 2000))
      }
      if (!cancelado) setResumenPago({ estado: 'pendiente', reserva })
    })()
    return () => { cancelado = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const online = servicios.filter(s => s.online && s.activo !== false)
  const profs: Estilista[] = srv
    ? srv.prof.map(id => estilistas.find(e => e.id === id)).filter((e): e is Estilista => Boolean(e))
    : []

  const anticipo = srv?.anticipo ? Math.round(srv.precio * cfg.anticipoPct / 100) : 0

  const slots = useMemo(
    () => generateSlots(cfg.agendaStart, cfg.agendaEnd, cfg.slotMin),
    [cfg.agendaStart, cfg.agendaEnd, cfg.slotMin]
  )

  // Horarios ocupados: vía disponibilidad_publica (solo hora/duración/
  // estilista, nunca datos de la clienta) en vez de leer citasFuturas del
  // store global, que 'anon' no puede ver.
  const [off, setOff] = useState<string[]>([])
  useEffect(() => {
    if (!selectedDay) { setOff([]); return }
    const y = selectedDay.date.getFullYear()
    const mo = String(selectedDay.date.getMonth() + 1).padStart(2, '0')
    const dy = String(selectedDay.date.getDate()).padStart(2, '0')
    const fechaStr = `${y}-${mo}-${dy}`
    const estParaChecar = prof === 'any' ? (srv?.prof[0] || null) : prof
    let cancelado = false
    // Comparación de intervalos completa: un horario candidato también se
    // bloquea si, con la duración del servicio que se está agendando, su
    // propio intervalo [inicio, inicio+dur) se mete en el de una cita ya
    // existente — no solo cuando el candidato empieza dentro de esa cita.
    // Antes solo se checaba "sMin >= startMin && sMin < startMin+dur",
    // que deja pasar un candidato ANTERIOR a una cita existente cuya
    // duración lo hace terminar después de que esa cita empieza (ej. cita
    // a las 18:00 de 40 min bloqueaba 18:00 pero no 17:30, aunque un
    // servicio de 40 min a las 17:30 termina 18:10 — se traslapa 10 min).
    // Bug real encontrado en producción: el pago se cobraba y luego el
    // servidor (con su propio chequeo, correcto) rechazaba la cita por
    // choque de horario, dejando el caso de "reserva_error".
    const durNueva = srv?.dur ?? 0
    db.disponibilidadPublica(fechaStr, estParaChecar).then(rows => {
      if (cancelado) return
      const bloqueados = new Set<string>()
      rows.forEach(r => {
        const [hh, mm] = r.h.split(':').map(Number)
        const startMin = hh * 60 + mm
        const endMin = startMin + r.dur
        slots.forEach(s => {
          const [sh, sm] = s.split(':').map(Number)
          const sMin = sh * 60 + sm
          if (sMin < endMin && startMin < sMin + durNueva) bloqueados.add(s)
        })
      })
      if (srv) {
        const cierreMin = cfg.agendaEnd * 60
        slots.forEach(s => {
          const [sh, sm] = s.split(':').map(Number)
          if (sh * 60 + sm + srv.dur > cierreMin) bloqueados.add(s)
        })
      }
      setOff(Array.from(bloqueados))
    })
    return () => { cancelado = true }
  }, [selectedDay, prof, slots, srv, cfg.agendaEnd])

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
    const fecha = `${y}-${mo}-${dy}`
    const estId = prof === 'any' ? (srv.prof[0] || 'e1') : prof
    const citaId = 'cf' + Date.now()
    setSubmitting(true)
    setSubmitError('')
    const cita = {
      id: citaId, h: hora, dur: srv.dur, srv: srv.nombre, servicioId: srv.id, est: estId,
      fecha, total: srv.precio, ant: anticipo, notas: clienteNotas.trim() || undefined,
    }
    const clienta = { nombre: clienteNombre.trim(), tel: clienteTel.trim() || undefined, email: clienteEmail.trim() || undefined }
    try {
      if (anticipo > 0) {
        // No se agenda todavía: la cita/clienta viajan en el metadata de la
        // preferencia y solo se crean del lado del servidor cuando Mercado
        // Pago confirme el pago de verdad (mp-webhook) — así nadie se queda
        // con un horario "apartado" sin haberlo pagado.
        const recaptchaToken = await obtenerRecaptchaToken('booking_pago')
        const { checkoutUrl } = await db.crearPreferenciaPago(
          anticipo, citaId, `Anticipo · ${srv.nombre} · ${cfg.nombre}`, { cita, clienta }, recaptchaToken
        )
        const reserva: ReservaGuardada = {
          citaId, servicio: srv.nombre,
          estilistaNombre: prof === 'any' ? 'Sin preferencia' : (estilistas.find(e => e.id === estId)?.nombre || ''),
          fecha, hora, total: srv.precio, anticipo, clienteNombre: clienteNombre.trim(),
        }
        localStorage.setItem(RESERVA_KEY, JSON.stringify(reserva))
        window.location.href = checkoutUrl
        return
      }
      const recaptchaToken = await obtenerRecaptchaToken('booking_publico')
      await db.crearReservaPublica(cita, clienta, recaptchaToken)
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

  // ── Resumen post-pago (reemplaza todo el wizard) ──────────────────────
  if (resumenPago) {
    const { estado, reserva } = resumenPago
    const copy: { icon: string; titulo: string; texto: string; color: string } = {
      cargando: { icon: 'spinner', titulo: 'Confirmando tu pago…', texto: 'Un momento, estamos verificando tu anticipo con Mercado Pago.', color: 'var(--text-3)' },
      aprobado: { icon: 'check-circle', titulo: '¡Reserva confirmada!', texto: 'Tu anticipo quedó registrado y tu cita ya está agendada. Nuestro equipo confirmará los últimos detalles por WhatsApp.', color: 'var(--gold)' },
      aprobado_sin_agendar: { icon: 'warning-circle', titulo: 'Tu pago se realizó, pero necesitamos confirmarte a mano', texto: 'Tu anticipo se cobró correctamente, pero no pudimos apartar ese horario en automático (puede que alguien más lo haya tomado justo mientras pagabas). Nos pondremos en contacto contigo por WhatsApp para reagendar — tu pago está seguro.', color: 'var(--st-pend)' },
      pendiente: { icon: 'clock', titulo: 'Pago en revisión', texto: 'Tu pago sigue procesándose. En cuanto se confirme, tu cita queda agendada y te avisamos por WhatsApp — no hace falta que hagas nada más.', color: 'var(--text-2)' },
      en_proceso: { icon: 'clock', titulo: 'Pago en revisión', texto: 'Tu pago sigue procesándose. En cuanto se confirme, tu cita queda agendada y te avisamos por WhatsApp — no hace falta que hagas nada más.', color: 'var(--text-2)' },
      rechazado: { icon: 'x-circle', titulo: 'El pago no se pudo procesar', texto: 'El anticipo no se completó, así que ese horario no quedó apartado. Puedes intentar agendar de nuevo cuando quieras.', color: 'var(--st-canc)' },
      cancelado: { icon: 'x-circle', titulo: 'Pago cancelado', texto: 'El anticipo no se completó, así que ese horario no quedó apartado. Si fue un error, puedes intentar agendar de nuevo.', color: 'var(--st-canc)' },
    }[estado]

    return (
      <div className="book-wrap">
        <div className="book-aside">
          <div style={{ position:'absolute', inset:0, background:'radial-gradient(600px 400px at 80% 0%, rgba(200,161,74,0.10), transparent 60%)' }} />
          <div style={{ position:'relative', zIndex:1, flex:1, display:'flex', flexDirection:'column' }}>
            <div className="logo serif" style={{ fontStyle:'italic', fontSize:34, background:'var(--gold-grad)', WebkitBackgroundClip:'text', backgroundClip:'text', WebkitTextFillColor:'transparent' }}>{cfg.nombre}</div>
            <div style={{ fontSize:10, letterSpacing:'.36em', textTransform:'uppercase', color:'var(--text-3)', marginTop:8 }}>{cfg.direccion}</div>
          </div>
        </div>
        <div className="book-main" style={{ alignItems:'center', justifyContent:'center' }}>
          <div style={{ maxWidth: 460, width:'100%', textAlign:'center' }}>
            <div style={{ width: 76, height: 76, borderRadius: '50%', margin: '0 auto', background: estado === 'aprobado' ? 'var(--gold-grad)' : 'var(--surface-2)', border: estado === 'aprobado' ? 'none' : '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: estado === 'aprobado' ? '#241c0c' : copy.color, fontSize: 34 }}>
              <Ic n={copy.icon} />
            </div>
            <h1 className="display" style={{ fontSize: 27, margin: '22px 0 8px' }}>{copy.titulo}</h1>
            <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, marginBottom: reserva ? 22 : 0 }}>{copy.texto}</p>

            {reserva && (
              <div className="card" style={{ textAlign: 'left', padding: 18, marginTop: 6 }}>
                <div className="vc gap8" style={{ fontSize: 13.5, marginBottom: 8 }}><Ic n="scissors" />{reserva.servicio}</div>
                <div className="vc gap8" style={{ fontSize: 13.5, marginBottom: 8, color: 'var(--text-2)' }}><Ic n="user" />{reserva.estilistaNombre || 'Sin preferencia'}</div>
                <div className="vc gap8" style={{ fontSize: 13.5, marginBottom: 8, color: 'var(--text-2)' }}><Ic n="calendar-blank" />{reserva.fecha} · {reserva.hora}</div>
                <div className="between" style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line-soft)' }}>
                  <span style={{ fontSize: 13 }}>Anticipo</span>
                  <span className="num gold-text serif" style={{ fontSize: 18, fontWeight: 600 }}>{mxn(reserva.anticipo)}</span>
                </div>
              </div>
            )}

            {(estado === 'aprobado' || estado === 'rechazado' || estado === 'cancelado') && (
              <button className="btn gold w100 mt24" style={{ justifyContent: 'center' }} onClick={() => { window.location.href = window.location.pathname; }}>
                Agendar otra cita
              </button>
            )}
          </div>
        </div>
      </div>
    )
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
          {cargandoBase ? (
            <div className="vc" style={{ gap: 10, color: 'var(--text-3)', fontSize: 13, justifyContent: 'center', flex: 1 }}>
              <Ic n="spinner" /> Cargando…
            </div>
          ) : (
          <>
          <div className="eyebrow">Paso {Math.min(step, 5)} de 5</div>

          {/* Step 1: Service selection */}
          {step === 1 && (
            <div className="mt14">
              <h1 className="display" style={{ fontSize: 27, margin: '0 0 4px' }}>Elige tu servicio</h1>
              <p className="muted" style={{ fontSize: 13.5, marginBottom: 22 }}>Selecciona el servicio que deseas agendar.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto', paddingRight: 6 }}>
                {online.map(s => (
                  <div key={s.id} data-testid="servicio-opt" data-anticipo={s.anticipo ? '1' : '0'} className={'opt-card' + (srv?.id === s.id ? ' sel' : '')} onClick={() => { setSrv(s); setProf(null) }}>
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
                <div data-testid="prof-cualquiera" className={'opt-card' + (prof === 'any' ? ' sel' : '')} onClick={() => setProf('any')}>
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
                  <div key={i} data-testid="dia-chip" className={'timeslot' + (diaIdx === i ? ' sel' : '')} style={{ minWidth: 64 }} onClick={() => { setDiaIdx(i); setHora(null) }}>
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
                    <div key={s} data-testid="hora-slot" className={'timeslot' + (hora === s ? ' sel' : '') + (dis ? ' off' : '')} onClick={() => !dis && setHora(s)}>
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
                    Este servicio requiere un anticipo de <b className="gold-text">{mxn(anticipo)}</b> ({cfg.anticipoPct}%), que se descuenta del total. Se cobra en línea de forma segura al continuar — el resto lo pagas en el salón.
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

          {/* Step 5: Confirmation (sin anticipo — con anticipo, se redirige a Mercado Pago) */}
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
                      <Ic n="user" />{prof === 'any' ? 'Sin preferencia' : estilistas.find(e => e.id === prof)?.nombre.split(' ')[0]}
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
                data-testid="submit-cita"
                className="btn gold"
                disabled={!step4Ok || submitting}
                style={{ opacity: step4Ok && !submitting ? 1 : .4, pointerEvents: step4Ok && !submitting ? 'auto' : 'none' }}
                onClick={submitCita}
              >
                <Ic n="check" />{submitting ? (anticipo > 0 ? 'Redirigiendo a pago…' : 'Enviando…') : (anticipo > 0 ? `Pagar anticipo · ${mxn(anticipo)}` : 'Solicitar cita')}
              </button>
            )}
            {step === 5 && (
              <button className="btn gold w100" style={{ justifyContent: 'center' }} onClick={reset}>
                Agendar otra cita
              </button>
            )}
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  )
}

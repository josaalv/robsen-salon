import React, { useState, useRef, useEffect } from 'react'
import { Avatar, Switch, CardHead, Seg, toast, Modal, ConfirmModal } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { useStore } from '../data/store'
import { useAuth } from '../lib/auth'
import { db } from '../lib/db'
import { supabase } from '../lib/supabase'
import { telefonoValido, telefonoError, filtrarTel, rolAllow, rolPuede } from '../lib/helpers'
import type { Usuario, SlotMinutos, RolUsuario } from '../types'

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

// ─── Mi perfil ───────────────────────────────────────────────────────────────
function AjustesPerfil({ user }: { user: Usuario }) {
  const { upsertUsuario } = useStore()
  const { refreshUser } = useAuth()
  const [nombre, setNombre] = useState(user.nombre)
  const [tel, setTel] = useState(user.tel || '')
  const [pwNueva, setPwNueva] = useState('')
  const [pwConf, setPwConf] = useState('')
  const [showPw, setShowPw] = useState(false)
  const avatarRef = useRef<HTMLInputElement>(null)
  const [avatar, setAvatar] = useState(() => user.avatar || '')
  const [saving, setSaving] = useState(false)

  const onAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) { toast('La imagen debe pesar menos de 8 MB'); return }
    const preview = URL.createObjectURL(file)
    setAvatar(preview)
    setSaving(true)
    try {
      const url = await db.uploadMedia(`avatares/${user.id}`, file)
      URL.revokeObjectURL(preview)
      if (!url) throw new Error('uploadMedia returned null')
      const patch = { ...user, avatar: url }
      const saved = await db.updateMiPerfil(patch)
      setAvatar(url)
      upsertUsuario(saved).catch(() => {})
      await refreshUser()
      toast('Foto actualizada')
    } catch (err) {
      URL.revokeObjectURL(preview)
      setAvatar(user.avatar || '')
      toast('Error al subir la foto — intenta de nuevo')
      console.error('[avatar upload]', err)
    } finally {
      setSaving(false)
    }
  }

  const quitarAvatar = async () => {
    setSaving(true)
    try {
      const saved = await db.clearUsuarioAvatar(user.id)
      setAvatar('')
      upsertUsuario(saved).catch(() => {})
      await refreshUser()
    } catch (err) {
      toast('Error al quitar la foto — intenta de nuevo')
      console.error('[avatar remove]', err)
    } finally {
      setSaving(false)
    }
  }

  const telInvalido = !!tel.trim() && !telefonoValido(tel)

  const guardar = async () => {
    if (!nombre.trim()) { toast('El nombre no puede estar vacío'); return }
    if (telInvalido) { toast('Ingresa un teléfono válido a 10 dígitos'); return }
    setSaving(true)
    try {
      const ini = nombre.trim().split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
      const patch = { ...user, nombre: nombre.trim(), tel, ini }
      const saved = await db.updateMiPerfil(patch)
      upsertUsuario(saved).catch(() => {})
      await refreshUser()
      toast('Perfil actualizado')
    } catch (err) {
      toast('Error al guardar — intenta de nuevo')
      console.error('[guardar perfil]', err)
    } finally {
      setSaving(false)
    }
  }

  const cambiarPw = async () => {
    if (!pwNueva || !pwConf) { toast('Completa ambos campos de contraseña'); return }
    if (pwNueva.length < 8) { toast('La nueva contraseña debe tener al menos 8 caracteres'); return }
    if (pwNueva !== pwConf) { toast('Las contraseñas no coinciden'); return }
    if (!supabase) { toast('Sin conexión a la base de datos'); return }
    setSaving(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password: pwNueva })
      if (err) throw err
      toast('Contraseña actualizada correctamente')
      setPwNueva(''); setPwConf('')
    } catch (err) {
      toast('Error al actualizar contraseña — intenta de nuevo')
      console.error('[cambiarPw]', err)
    } finally {
      setSaving(false)
    }
  }

  const rolBadgeClass: Record<string, string> = { admin: 'vip', gerente: 'pay', recepcion: 'conf', estilista: 'done' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 16 }}>Información personal</div>
        <div className="vc gap16" style={{ marginBottom: 20 }}>
          {avatar
            ? <img src={avatar} alt={user.ini} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--line)' }} />
            : <Avatar ini={user.ini} color={user.color} size="lg" />}
          <input ref={avatarRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={onAvatarFile} />
          <button className="btn ghost sm" disabled={saving} onClick={() => avatarRef.current?.click()}><Ic n="camera" />{avatar ? 'Cambiar foto' : 'Subir foto'}</button>
          {avatar && <button className="btn ghost sm" style={{ color: 'var(--st-canc)' }} disabled={saving} onClick={quitarAvatar}><Ic n="trash" /></button>}
          <span className={'badge ' + (rolBadgeClass[user.rol] || 'neutral')} style={{ fontSize: 11.5 }}>{user.rol}</span>
        </div>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="field"><label>Nombre completo</label><input className="input" value={nombre} onChange={e => setNombre(e.target.value)} /></div>
          <div className="field"><label>Rol</label><input className="input" value={user.rol} disabled style={{ opacity: 0.6 }} /></div>
          <div className="field"><label>Correo electrónico</label><input className="input" value={user.email} disabled style={{ opacity: 0.6 }} /></div>
          <div className="field">
            <label>Teléfono</label>
            <input className="input" value={tel} onChange={e => setTel(filtrarTel(e.target.value))} placeholder="33 1234 5678"
              style={{ borderColor: telInvalido ? 'var(--st-canc)' : undefined }} />
            {telInvalido && <div style={{ fontSize: 11.5, color: 'var(--st-canc)', marginTop: 4 }}>{telefonoError(tel)}</div>}
          </div>
        </div>
        <div className="vc gap8 mt14">
          <button className="btn gold" disabled={saving || telInvalido} onClick={guardar}><Ic n={saving ? 'spinner' : 'check'} />{saving ? 'Guardando…' : 'Guardar cambios'}</button>
          <button className="btn ghost" disabled={saving} onClick={() => { setNombre(user.nombre); setTel(user.tel || '') }}>Cancelar</button>
        </div>
      </div>
      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 16 }}>Cambiar contraseña</div>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div className="field">
            <label>Nueva contraseña</label>
            <div style={{ position: 'relative' }}>
              <input className="input" type={showPw ? 'text' : 'password'} value={pwNueva} onChange={e => setPwNueva(e.target.value)} placeholder="Mín. 8 caracteres" style={{ paddingRight: 42 }} />
              <button onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}>
                <Ic n={showPw ? 'eye-slash' : 'eye'} size={16} />
              </button>
            </div>
          </div>
          <div className="field"><label>Confirmar contraseña</label><input className="input" type={showPw ? 'text' : 'password'} value={pwConf} onChange={e => setPwConf(e.target.value)} placeholder="••••••••" /></div>
        </div>
        <button className="btn ghost sm mt14" disabled={saving} onClick={cambiarPw}><Ic n={saving ? 'spinner' : 'lock-key'} />{saving ? 'Guardando…' : 'Actualizar contraseña'}</button>
      </div>
    </div>
  )
}

// ─── Salón ───────────────────────────────────────────────────────────────────
function AjustesSalon() {
  const { data, updateConfig } = useStore()
  const cfg = data.config
  const [logo, setLogo] = useState(() => cfg.logo || '')
  const fileRef = useRef<HTMLInputElement>(null)
  const [nombre, setNombre] = useState(cfg.nombre)
  const [direccion, setDireccion] = useState(cfg.direccion)
  const [tel, setTel] = useState(cfg.tel)
  const [whatsapp, setWhatsapp] = useState(cfg.whatsapp)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) { toast('La imagen debe pesar menos de 8 MB'); return }
    const preview = URL.createObjectURL(file)
    setLogo(preview)
    const url = await db.uploadMedia('logos/logo', file)
    URL.revokeObjectURL(preview)
    if (url) {
      try {
        await updateConfig({ logo: url })
        setLogo(url)
      } catch {
        toast('No se pudo guardar el logo. Intenta de nuevo.')
        setLogo(cfg.logo || '')
      }
    } else {
      toast('Error al subir el logo — intenta de nuevo')
      setLogo(cfg.logo || '')
    }
  }

  const removeLogo = async () => {
    const previous = cfg.logo
    setLogo('')
    try {
      await updateConfig({ logo: undefined })
    } catch {
      toast('No se pudo quitar el logo. Intenta de nuevo.')
      setLogo(previous || '')
    }
  }

  const telInvalido = !!tel.trim() && !telefonoValido(tel)
  const whatsappInvalido = !!whatsapp.trim() && !telefonoValido(whatsapp)

  const [saving, setSaving] = useState(false)
  const guardar = async () => {
    if (telInvalido || whatsappInvalido) { toast('Revisa los teléfonos — deben tener 10 dígitos con lada'); return }
    setSaving(true)
    try {
      await updateConfig({ nombre, direccion, tel, whatsapp })
      toast('Datos del salón guardados')
    } catch {
      toast('No se pudo guardar. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
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
            <div className="dim" style={{ fontSize: 11.5 }}>PNG, SVG o JPG · máx. 8 MB</div>
          </div>
        </div>
      </div>
      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 14 }}>Datos del salón</div>
        <div className="grid" style={{ gap: 14 }}>
          <div className="field"><label>Nombre comercial</label><input className="input" value={nombre} onChange={e => setNombre(e.target.value)} /></div>
          <div className="field"><label>Dirección</label><input className="input" value={direccion} onChange={e => setDireccion(e.target.value)} /></div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="field">
              <label>Teléfono</label>
              <input className="input" value={tel} onChange={e => setTel(filtrarTel(e.target.value))} placeholder="33 1234 5678"
                style={{ borderColor: telInvalido ? 'var(--st-canc)' : undefined }} />
              {telInvalido && <div style={{ fontSize: 11.5, color: 'var(--st-canc)', marginTop: 4 }}>{telefonoError(tel)}</div>}
            </div>
            <div className="field">
              <label>WhatsApp</label>
              <input className="input" value={whatsapp} onChange={e => setWhatsapp(filtrarTel(e.target.value))} placeholder="33 1234 5678"
                style={{ borderColor: whatsappInvalido ? 'var(--st-canc)' : undefined }} />
              {whatsappInvalido && <div style={{ fontSize: 11.5, color: 'var(--st-canc)', marginTop: 4 }}>{telefonoError(whatsapp)}</div>}
            </div>
          </div>
        </div>
      </div>
      <div className="vc gap8">
        <button className="btn gold" disabled={telInvalido || whatsappInvalido || saving} onClick={guardar}><Ic n="check" />{saving ? 'Guardando…' : 'Guardar'}</button>
        <button className="btn ghost" onClick={() => { setNombre(cfg.nombre); setDireccion(cfg.direccion); setTel(cfg.tel); setWhatsapp(cfg.whatsapp) }}>Cancelar</button>
      </div>
    </div>
  )
}

// ─── Agenda ──────────────────────────────────────────────────────────────────
function AjustesAgenda() {
  const { data, updateConfig } = useStore()
  const cfg = data.config
  const HORAS_APT = [7, 8, 9, 10, 11]
  const HORAS_CIERRE = [17, 18, 19, 20, 21, 22]
  const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  const [start, setStart] = useState(cfg.agendaStart)
  const [end, setEnd] = useState(cfg.agendaEnd)
  const [slotMin, setSlotMin] = useState<SlotMinutos>(cfg.slotMin)
  const [dias, setDias] = useState<boolean[]>([...cfg.diasAbiertos])

  const slotsCount = end > start ? Math.round((end - start) * 60 / slotMin) : 0

  const [saving, setSaving] = useState(false)
  const guardar = async () => {
    if (end <= start) { toast('La hora de cierre debe ser posterior a la apertura'); return }
    if (!dias.some(Boolean)) { toast('Al menos un día debe estar abierto'); return }
    setSaving(true)
    try {
      await updateConfig({
        agendaStart: start,
        agendaEnd: end,
        slotMin,
        diasAbiertos: dias as [boolean, boolean, boolean, boolean, boolean, boolean, boolean],
      })
      toast('Configuración de agenda guardada — cambios activos al instante')
    } catch {
      toast('No se pudo guardar. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 14 }}>Horario del sistema</div>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          <div className="field">
            <label>Hora de apertura</label>
            <select className="select" value={start} onChange={e => setStart(+e.target.value)}>
              {HORAS_APT.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
            </select>
          </div>
          <div className="field">
            <label>Hora de cierre</label>
            <select className="select" value={end} onChange={e => setEnd(+e.target.value)}>
              {HORAS_CIERRE.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
            </select>
          </div>
        </div>
        <SettingRow title="Intervalo de ranuras" desc="Duración mínima de cada bloque de tiempo en la agenda. Afecta los horarios disponibles al agendar citas." last>
          <Seg opts={['15 min', '30 min', '60 min']} value={`${slotMin} min`} onChange={v => setSlotMin(+v.replace(' min', '') as SlotMinutos)} />
        </SettingRow>
      </div>
      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 14 }}>Días de atención</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {DIAS.map((d, i) => (
            <div key={d} className="between" style={{ fontSize: 13 }}>
              <div className="vc gap10">
                <Switch on={dias[i]} onClick={() => setDias(prev => prev.map((v, j) => j === i ? !v : v))} />
                <span style={{ fontWeight: 600 }}>{d}</span>
              </div>
              {dias[i]
                ? <span className="badge conf">Abierto</span>
                : <span className="badge neutral">Cerrado</span>}
            </div>
          ))}
        </div>
      </div>
      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 6 }}>Vista previa</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 2 }}>
          Agenda de <b style={{ color: 'var(--text)' }}>{String(start).padStart(2, '0')}:00</b> a <b style={{ color: 'var(--text)' }}>{String(end).padStart(2, '0')}:00</b> · ranuras de <b style={{ color: 'var(--text)' }}>{slotMin} min</b>
          <br />
          <b style={{ color: 'var(--gold)' }}>{slotsCount}</b> ranuras por estilista al día
          <br />
          Días: <b style={{ color: 'var(--text)' }}>{DIAS.filter((_, i) => dias[i]).join(', ') || '—'}</b>
        </div>
      </div>
      <div className="vc gap8">
        <button className="btn gold" disabled={saving} onClick={guardar}><Ic n="check" />{saving ? 'Guardando…' : 'Guardar configuración'}</button>
        <button className="btn ghost" onClick={() => { setStart(cfg.agendaStart); setEnd(cfg.agendaEnd); setSlotMin(cfg.slotMin); setDias([...cfg.diasAbiertos]) }}>Cancelar</button>
      </div>
    </div>
  )
}

// ─── Comisiones ───────────────────────────────────────────────────────────────
function AjustesComisiones() {
  const { data, updateConfig } = useStore()

  const [coms, setComs] = useState<Record<string, number>>({ ...data.config.comisiones })
  const [escala, setEscala] = useState<{ limite: number | null; pct: number }[]>(data.config.escalaComisiones || [])

  const setVal = (key: string, val: number) =>
    setComs(prev => ({ ...prev, [key]: Math.min(100, Math.max(0, val)) }))

  const [saving, setSaving] = useState(false)
  const guardar = async () => {
    setSaving(true)
    try {
      await updateConfig({ comisiones: coms, escalaComisiones: escala })
      toast('Comisiones actualizadas')
    } catch {
      toast('No se pudo guardar. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const addTramo = () => setEscala(prev => [...prev, { limite: null, pct: 30 }])
  const removeTramo = (i: number) => setEscala(prev => prev.filter((_, j) => j !== i))
  const updateTramo = (i: number, field: 'limite' | 'pct', val: number | null) =>
    setEscala(prev => prev.map((t, j) => j === i ? { ...t, [field]: val } : t))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 4 }}>Productos (retail)</div>
        <SettingRow title="Comisión por venta de producto" desc="Aplica a todas las líneas de tipo 'producto' en ventas." last>
          <div className="vc gap8">
            <input
              className="input num" type="number" min="0" max="100"
              style={{ width: 68, textAlign: 'right' }}
              value={coms['_producto'] ?? 10}
              onChange={e => setVal('_producto', +e.target.value)}
            />
            <span className="muted">%</span>
          </div>
        </SettingRow>
      </div>

      <div className="card card-pad">
        <div className="between" style={{ marginBottom: 12 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Escala progresiva</div>
            <div className="dim" style={{ fontSize: 12 }}>
              Define tramos de ventas mensuales con diferentes porcentajes. El tramo con límite vacío aplica al excedente.
            </div>
          </div>
          <button className="btn ghost sm" onClick={addTramo}><Ic n="plus" size={13} />Agregar tramo</button>
        </div>
        {escala.length === 0
          ? <div className="dim" style={{ fontSize: 12.5 }}>Sin escala progresiva configurada. Las comisiones planas aplican siempre.</div>
          : <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', fontSize: 11, color: 'var(--text-3)', padding: '0 0 8px', fontWeight: 500 }}>Hasta (ventas)</th>
                  <th style={{ textAlign: 'left', fontSize: 11, color: 'var(--text-3)', padding: '0 0 8px', fontWeight: 500 }}>Comisión</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {escala.map((t, i) => (
                  <tr key={i}>
                    <td style={{ padding: '6px 12px 6px 0' }}>
                      <div className="vc gap6">
                        <input
                          className="input num" type="number" min={0} placeholder="Sin límite"
                          style={{ width: 120 }}
                          value={t.limite ?? ''}
                          onChange={e => updateTramo(i, 'limite', e.target.value === '' ? null : +e.target.value)}
                        />
                        <span className="dim" style={{ fontSize: 11.5 }}>MXN</span>
                      </div>
                    </td>
                    <td style={{ padding: '6px 12px 6px 0' }}>
                      <div className="vc gap6">
                        <input
                          className="input num" type="number" min={0} max={100}
                          style={{ width: 68 }}
                          value={t.pct}
                          onChange={e => updateTramo(i, 'pct', +e.target.value)}
                        />
                        <span className="dim">%</span>
                      </div>
                    </td>
                    <td>
                      <button className="icon-btn" style={{ color: 'var(--st-canc)' }} onClick={() => removeTramo(i)}>
                        <Ic n="trash" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>

      <button className="btn gold" style={{ alignSelf: 'flex-start' }} disabled={saving} onClick={guardar}>
        <Ic n="check" />{saving ? 'Guardando…' : 'Guardar comisiones'}
      </button>
    </div>
  )
}

// ─── Usuarios y roles ─────────────────────────────────────────────────────────
const COLORES_USR = ['#C8A14A', '#93B58C', '#6FA6B8', '#C77B7B', '#B08AC7', '#E8834A']
const ROLES_LIST: { val: RolUsuario; label: string }[] = [
  { val: 'admin', label: 'Administrador' },
  { val: 'gerente', label: 'Gerente' },
  { val: 'recepcion', label: 'Recepcionista' },
  { val: 'estilista', label: 'Estilista' },
]

function UsuarioModal({ usr, selfId, esAdmin, onClose }: { usr: Partial<Usuario> | null; selfId: string; esAdmin: boolean; onClose: () => void }) {
  const { data, upsertUsuario, upsertEstilista, deleteUsuario } = useStore()
  const isNew = !usr?.id
  const necesitaAcceso = isNew || !usr?.authUserId
  const [nombre, setNombre] = useState(usr?.nombre || '')
  const [email, setEmail] = useState(usr?.email || '')
  const [tel, setTel] = useState(usr?.tel || '')
  const [rol, setRol] = useState<RolUsuario>(usr?.rol || 'recepcion')
  const [color, setColor] = useState(usr?.color || COLORES_USR[0])
  const [activo, setActivo] = useState(usr?.activo !== false)
  const [estilistaId, setEstilistaId] = useState(usr?.estilistaId || '')
  const [creandoEstilista, setCreandoEstilista] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const [tieneHistorial, setTieneHistorial] = useState(false)
  const telInvalido = !!tel.trim() && !telefonoValido(tel)
  const faltaVincular = rol === 'estilista' && !estilistaId
  const estilistaDuplicado = estilistaId
    ? data.usuarios.find(u => u.estilistaId === estilistaId && u.id !== usr?.id)
    : undefined

  const crearEstilista = async () => {
    if (!nombre.trim() || creandoEstilista) return
    setCreandoEstilista(true)
    try {
      const ini = nombre.trim().split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
      const id = 'e' + Date.now()
      await upsertEstilista({ id, nombre: nombre.trim(), rol: 'Estilista', color, ini, com: 30 })
      setEstilistaId(id)
      toast('Registro de estilista creado y vinculado')
    } catch {
      toast('No se pudo crear el registro de estilista. Intenta de nuevo.')
    } finally {
      setCreandoEstilista(false)
    }
  }

  useEffect(() => {
    if (usr?.id) db.tieneHistorial(usr.id).then(setTieneHistorial)
  }, [usr?.id])

  const eliminar = async () => {
    if (!usr?.id) return
    setEliminando(true)
    try {
      await db.eliminarUsuario(usr.id)
      deleteUsuario(usr.id)
      toast('Usuario eliminado')
      onClose()
    } catch (err) {
      toast('No se pudo eliminar: ' + (err instanceof Error ? err.message : 'error'))
    } finally {
      setEliminando(false)
      setConfirmarBorrar(false)
    }
  }

  const save = async () => {
    if (!nombre.trim()) { toast('El nombre es requerido'); return }
    if (!email.trim() || !email.includes('@')) { toast('Ingresa un correo válido'); return }
    if (telInvalido) { toast('Ingresa un teléfono válido a 10 dígitos con lada'); return }
    if (faltaVincular) { toast('Vincula esta estilista con un registro de Estilistas antes de guardar'); return }
    setGuardando(true)
    try {
      const id = usr?.id || 'u' + Date.now()
      const ini = nombre.trim().split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
      const saved = await db.upsertUsuario({
        id, nombre: nombre.trim(), email: email.trim(), tel, rol, color, ini, activo, ultimo: usr?.ultimo || '—',
        estilistaId: rol === 'estilista' ? (estilistaId || undefined) : undefined,
      } as Usuario)
      upsertUsuario(saved).catch(() => {})

      if (necesitaAcceso) {
        try {
          const { invited } = await db.crearAccesoUsuario(saved.id, saved.email)
          toast(invited
            ? `Usuario guardado. Se envió una invitación por correo a ${saved.email} para que configure su acceso.`
            : 'Usuario guardado y cuenta de acceso vinculada.')
        } catch (err) {
          toast('El perfil se guardó, pero no se pudo crear el acceso: ' + (err instanceof Error ? err.message : 'intenta de nuevo'))
        }
      } else {
        toast('Usuario actualizado')
      }
      onClose()
    } catch (err) {
      toast('No se pudo guardar el usuario: ' + (err instanceof Error ? err.message : 'error'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal onClose={onClose} width={480}>
      <div className="card-head">
        <div>
          <div className="eyebrow">{isNew ? 'Nuevo usuario' : 'Editar usuario'}</div>
          <h3 style={{ marginTop: 4 }}>Acceso al sistema</h3>
        </div>
        <button className="icon-btn" onClick={onClose}><Ic n="x" /></button>
      </div>
      <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="field"><label>Nombre completo</label><input className="input" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Valeria Mendoza" /></div>
          <div className="field">
            <label>Rol</label>
            <select className="select" value={rol} onChange={e => setRol(e.target.value as RolUsuario)}>
              {ROLES_LIST.map(r => <option key={r.val} value={r.val}>{r.label}</option>)}
            </select>
          </div>
          <div className="field"><label>Correo electrónico</label><input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" /></div>
          <div className="field">
            <label>Teléfono</label>
            <input className="input" value={tel} onChange={e => setTel(filtrarTel(e.target.value))} placeholder="33 1234 5678"
              style={{ borderColor: telInvalido ? 'var(--st-canc)' : undefined }} />
            {telInvalido && <div style={{ fontSize: 11.5, color: 'var(--st-canc)', marginTop: 4 }}>{telefonoError(tel)}</div>}
          </div>
        </div>
        {rol === 'estilista' && (
          <div className="field">
            <label>Vincular con estilista existente</label>
            <select className="select" value={estilistaId} onChange={e => setEstilistaId(e.target.value)}>
              <option value="">— Selecciona —</option>
              {data.estilistas.map(es => <option key={es.id} value={es.id}>{es.nombre}</option>)}
            </select>
            {estilistaDuplicado && (
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4 }}>
                Ojo: esta estilista ya está vinculada al usuario "{estilistaDuplicado.nombre}".
              </div>
            )}
            {faltaVincular && (
              <div style={{ background: 'rgba(220,80,80,0.08)', border: '1px solid rgba(220,80,80,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--st-canc)', lineHeight: 1.5, marginTop: 8 }}>
                Sin este vínculo, esta persona no podrá ver su propia agenda ni sus comisiones correctamente al iniciar sesión.
                <button
                  className="btn ghost sm"
                  style={{ marginTop: 8, opacity: nombre.trim() ? 1 : .4, pointerEvents: nombre.trim() ? 'auto' : 'none' }}
                  disabled={creandoEstilista}
                  onClick={crearEstilista}
                >
                  <Ic n="user-plus" />{creandoEstilista ? 'Creando…' : `Crear registro de estilista para "${nombre.trim() || '—'}"`}
                </button>
              </div>
            )}
          </div>
        )}
        {necesitaAcceso ? (
          <div style={{ background: 'rgba(200,161,74,0.06)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
            {isNew
              ? 'Al guardar, se le enviará una invitación por correo a esta persona para que configure su propia contraseña.'
              : 'Esta persona todavía no tiene acceso al sistema. Al guardar, se le enviará una invitación por correo.'}
          </div>
        ) : (
          <div style={{ background: 'rgba(147,181,140,0.06)', border: '1px solid rgba(147,181,140,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--st-conf)', lineHeight: 1.5 }}>
            ✓ Ya tiene acceso al sistema con este correo.
          </div>
        )}
        <div className="field">
          <label>Color de identificación</label>
          <div className="vc gap10">
            {COLORES_USR.map(c => (
              <div
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 32, height: 32, borderRadius: '50%', background: c, cursor: 'pointer',
                  boxShadow: color === c
                    ? `0 0 0 2px var(--panel), 0 0 0 4px ${c}`
                    : '0 0 0 2px transparent',
                  transition: 'box-shadow .15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {color === c && <Ic n="check" size={14} style={{ color: '#1a1208', fontWeight: 700 }} />}
              </div>
            ))}
          </div>
        </div>
        {usr?.id && usr.id !== selfId && (
          <SettingRow title="Cuenta activa" desc="Un usuario inactivo no puede iniciar sesión." last>
            <Switch on={activo} onClick={() => setActivo(v => !v)} />
          </SettingRow>
        )}
        <div className="vc gap8 mt6">
          <button className="btn gold f1" style={{ justifyContent: 'center' }} disabled={guardando || telInvalido || faltaVincular} onClick={save}>
            <Ic n={guardando ? 'spinner' : 'check'} />
            {guardando ? 'Guardando…' : isNew ? 'Crear usuario' : 'Guardar cambios'}
          </button>
          <button className="btn ghost" disabled={guardando} onClick={onClose}>Cancelar</button>
        </div>
        {usr?.id && usr.id !== selfId && esAdmin && (
          <button className="btn danger w100" style={{ justifyContent: 'center' }} disabled={guardando || eliminando} onClick={() => setConfirmarBorrar(true)}>
            <Ic n="trash" />Eliminar usuario
          </button>
        )}
        {usr?.id && usr.id !== selfId && !esAdmin && (
          <div className="dim" style={{ fontSize: 11.5, textAlign: 'center' }}>Solo un administrador puede eliminar usuarios. Usa "Cuenta activa" para quitarle el acceso.</div>
        )}
      </div>
      {confirmarBorrar && (
        <ConfirmModal
          title="¿Eliminar este usuario?"
          desc={`${usr?.nombre} perderá acceso al sistema de inmediato${usr?.authUserId ? ' y su cuenta de inicio de sesión se elimina también' : ''}. Esta acción no se puede deshacer.${
            tieneHistorial ? ' Este usuario tiene ventas, citas o cierres de caja registrados a su nombre — el historial se conserva, pero considera desactivarlo en vez de eliminarlo si quieres mantener la referencia.' : ''
          }`}
          onConfirm={eliminar}
          onCancel={() => setConfirmarBorrar(false)}
        />
      )}
    </Modal>
  )
}

function AjustesUsuarios({ user }: { user: Usuario }) {
  const { data, updateConfig } = useStore()
  const [modal, setModal] = useState<Partial<Usuario> | null | false>(false)
  const rolBadge: Record<string, string> = { admin: 'vip', gerente: 'pay', recepcion: 'conf', estilista: 'done' }
  const esAdmin = user.rol === 'admin'

  // Activa / desactiva un módulo para un rol y lo guarda en config.permisos.
  // El admin no es editable: siempre conserva acceso total.
  const togglePermiso = async (rolId: string, moduloId: string, activar: boolean) => {
    if (rolId === 'admin') return
    // Partimos del permiso efectivo actual de cada rol (a medida o por defecto)
    // para no perder los que ya tenía al cambiar uno solo.
    const next: Record<string, string[]> = {}
    for (const r of Object.values(data.roles)) {
      if (r.id === 'admin') continue
      const eff = rolAllow(r.id, data.config, data.roles)
      next[r.id] = eff === '*' ? data.modulos.map(m => m.id) : [...eff]
    }
    const actual = new Set(next[rolId] || [])
    if (activar) actual.add(moduloId); else actual.delete(moduloId)
    next[rolId] = data.modulos.filter(m => actual.has(m.id)).map(m => m.id)
    try {
      await updateConfig({ permisos: next })
    } catch {
      toast('No se pudieron guardar los permisos. Intenta de nuevo.')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {modal !== false && (
        <UsuarioModal usr={modal} selfId={user.id} esAdmin={esAdmin} onClose={() => setModal(false)} />
      )}
      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Accesos al sistema</div><h3 style={{ marginTop: 4 }}>Usuarios del equipo</h3></div>
          {esAdmin && <button className="btn gold sm" onClick={() => setModal(null)}><Ic n="user-plus" />Nuevo usuario</button>}
        </div>
        {!esAdmin && (
          <div className="dim" style={{ fontSize: 11.5, padding: '0 20px 12px' }}>
            Solo un administrador puede crear o editar usuarios. Esta lista es de solo lectura para tu rol.
          </div>
        )}
        <table className="table" style={{ marginTop: 6 }}>
          <thead>
            <tr><th>Usuario</th><th>Rol</th><th>Último acceso</th><th>Estado</th><th>Acceso</th><th></th></tr>
          </thead>
          <tbody>
            {data.usuarios.map(u => (
              <tr key={u.id} style={{ cursor: esAdmin ? 'pointer' : 'default' }} onClick={() => { if (esAdmin) setModal(u) }}>
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
                <td className="muted">{u.ultimo || '—'}</td>
                <td>
                  <span className={'badge ' + (u.activo ? 'conf' : 'canc')}>{u.activo ? 'Activo' : 'Inactivo'}</span>
                </td>
                <td>
                  {u.authUserId
                    ? <span className="badge conf" title="Puede iniciar sesión"><Ic n="check-circle" size={12} />Con acceso</span>
                    : <span className="badge pend" title="Todavía no puede iniciar sesión">Sin acceso</span>}
                </td>
                <td><Ic n="caret-right" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <CardHead
          title="Permisos por rol"
          sub={esAdmin
            ? 'Activa o desactiva los módulos que ve cada rol. Los cambios se aplican al instante en el menú de cada usuario.'
            : 'Módulos disponibles por nivel de acceso'} />
        <div style={{ overflowX: 'auto' }}>
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
                    const ok = rolPuede(r.id, m.id, data.config, data.roles)
                    const bloqueado = r.id === 'admin' || !esAdmin
                    return (
                      <td key={r.id} style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={ok}
                          disabled={bloqueado}
                          onChange={e => togglePermiso(r.id, m.id, e.target.checked)}
                          title={r.id === 'admin' ? 'El administrador siempre tiene acceso total' : undefined}
                          style={{ accentColor: 'var(--gold)', width: 16, height: 16, cursor: bloqueado ? 'default' : 'pointer' }}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '12px 22px' }}>
          <div className="dim" style={{ fontSize: 12 }}>
            {esAdmin
              ? 'El administrador siempre conserva acceso total y no es editable. Si un rol no tiene un módulo activado, ese módulo no aparece en el menú de esos usuarios.'
              : 'Los permisos se gestionan por rol. Contacta al administrador para cambios de acceso.'}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Notificaciones ───────────────────────────────────────────────────────────
function AjustesNotif() {
  const { data, updateConfig } = useStore()
  const [notifs, setNotifs] = useState({ ...data.config.notifs })

  const toggle = async (k: keyof typeof notifs) => {
    const previous = notifs
    const next = { ...notifs, [k]: !notifs[k] }
    setNotifs(next)
    try {
      await updateConfig({ notifs: next })
    } catch {
      setNotifs(previous)
      toast('No se pudo guardar el cambio. Intenta de nuevo.')
    }
  }

  const rows: [keyof typeof notifs, string, string][] = [
    ['citas',         'Nuevas citas',             'Notificación al registrar una nueva cita o reserva online'],
    ['recordatorios', 'Recordatorios automáticos', 'Envío de recordatorio 24h antes de cada cita vía WhatsApp'],
    ['anticipos',     'Anticipos pendientes',      'Alerta cuando un anticipo lleva más de 3 días sin aplicarse'],
    ['stock',         'Stock bajo',                'Alerta cuando un producto baja del mínimo configurado'],
    ['inactivas',     'Clientas inactivas',        'Resumen semanal de clientas sin visita en más de 60 días'],
    ['cumples',       'Cumpleaños',                'Notificación el día del cumpleaños de una clienta'],
  ]

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

// ─── Anticipos y pagos ────────────────────────────────────────────────────────
function AjustesPagos() {
  const { data, updateConfig } = useStore()
  const cfg = data.config
  const [anticipoPct, setAnticipoPct] = useState(cfg.anticipoPct)
  const [requerirAnticipo, setRequerirAnticipo] = useState(cfg.requerirAnticipo ?? true)
  const [metodospago, setMetodospago] = useState({ ...cfg.metodospago })
  const [iva, setIva] = useState<0 | 16>(cfg.iva)

  const togglePago = (k: keyof typeof metodospago) =>
    setMetodospago(m => ({ ...m, [k]: !m[k] }))

  const [saving, setSaving] = useState(false)
  const guardar = async () => {
    setSaving(true)
    try {
      await updateConfig({ anticipoPct, requerirAnticipo, iva, metodospago })
      toast('Configuración de pagos guardada')
    } catch {
      toast('No se pudo guardar. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 4 }}>Anticipos</div>
        <SettingRow title="Requerir anticipo para servicios premium" desc="Balayage, keratina, extensiones y paquetes especiales.">
          <Switch on={requerirAnticipo} onClick={() => setRequerirAnticipo(v => !v)} />
        </SettingRow>
        <SettingRow title="Porcentaje de anticipo" desc="Porcentaje del total que se cobra al reservar." last>
          <select className="select" style={{ width: 110 }} value={anticipoPct} onChange={e => setAnticipoPct(+e.target.value)}>
            <option value={25}>25%</option>
            <option value={30}>30%</option>
            <option value={35}>35%</option>
            <option value={50}>50%</option>
          </select>
        </SettingRow>
      </div>
      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 4 }}>Métodos de pago</div>
        {([['efectivo', 'Efectivo'], ['tarjeta', 'Tarjeta de crédito / débito'], ['transferencia', 'Transferencia bancaria (SPEI)'], ['credito', 'Crédito de cuenta']] as const).map(([k, label], i, arr) => (
          <SettingRow key={k} title={label} last={i === arr.length - 1}>
            <Switch on={metodospago[k]} onClick={() => togglePago(k)} />
          </SettingRow>
        ))}
      </div>
      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 4 }}>Moneda e impuestos</div>
        <SettingRow title="Moneda" last={false}>
          <select className="select" style={{ width: 140 }}>
            <option>MXN · Peso mexicano</option><option>USD · Dólar</option>
          </select>
        </SettingRow>
        <SettingRow title="IVA aplicado" last>
          <select className="select" style={{ width: 110 }} value={iva} onChange={e => setIva(+e.target.value as 0 | 16)}>
            <option value={0}>Sin IVA</option>
            <option value={16}>16%</option>
          </select>
        </SettingRow>
      </div>
      <button className="btn gold" style={{ alignSelf: 'flex-start' }} disabled={saving} onClick={guardar}>
        <Ic n="check" />{saving ? 'Guardando…' : 'Guardar'}
      </button>
    </div>
  )
}

// ─── Apariencia ───────────────────────────────────────────────────────────────
function applyTema(t: string) {
  const root = document.documentElement
  if (t === 'Claro') {
    root.setAttribute('data-theme', 'light')
  } else if (t === 'Oscuro') {
    root.removeAttribute('data-theme')
  } else {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', 'light')
  }
}

function AjustesApariencia() {
  const { data } = useStore()
  const ACENTOS = ['#C8A14A', '#93B58C', '#6FA6B8', '#C77B7B', '#B08AC7', '#E8834A', '#5B8DB8']
  const [acento, setAcento] = useState(() => localStorage.getItem('rb_acento') || data.config.acento || ACENTOS[0])
  const [tema, setTema] = useState(() => localStorage.getItem('rb_tema') || 'Oscuro')
  const [idioma, setIdioma] = useState(() => localStorage.getItem('rb_idioma') || 'es')

  useEffect(() => { applyTema(tema) }, [])

  const handleTema = (t: string) => {
    setTema(t)
    localStorage.setItem('rb_tema', t)
    applyTema(t)
  }

  const handleIdioma = (lang: string) => {
    setIdioma(lang)
    localStorage.setItem('rb_idioma', lang)
    document.documentElement.lang = lang
    toast(lang === 'en'
      ? 'Language saved — English UI in progress, content remains in Spanish'
      : 'Idioma configurado: Español (México)')
  }

  const handleAccento = (c: string) => {
    setAcento(c)
    localStorage.setItem('rb_acento', c)
    document.documentElement.style.setProperty('--gold', c)
  }


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 4 }}>Personalización</div>
        <SettingRow title="Tema de la interfaz" desc="Oscuro usa el diseño original; Claro invierte los fondos para ambientes iluminados.">
          <Seg opts={['Oscuro', 'Claro', 'Automático']} value={tema} onChange={handleTema} />
        </SettingRow>
        <SettingRow title="Color de acento" desc="Cambia el color principal en tiempo real. Se guarda automáticamente.">
          <div className="vc gap8">
            {ACENTOS.map(c => (
              <div
                key={c}
                onClick={() => handleAccento(c)}
                title={c}
                style={{
                  width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                  outline: acento === c ? `3px solid ${c}` : '3px solid transparent', outlineOffset: 2,
                  transition: 'outline 0.15s',
                }}
              />
            ))}
          </div>
        </SettingRow>
        <SettingRow title="Idioma" desc="Afecta la preferencia de idioma del sistema. Contenido siempre en español por ahora." last>
          <select className="select" style={{ width: 180 }} value={idioma} onChange={e => handleIdioma(e.target.value)}>
            <option value="es">Español (México)</option>
            <option value="en">English (coming soon)</option>
          </select>
        </SettingRow>
      </div>
    </div>
  )
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export function ScreenAjustes({ onNavigate: _onNavigate, user }: { onNavigate: (r: string) => void; user: any }) {
  const esGestion = user.rol === 'admin' || user.rol === 'gerente'

  const allTabs = [
    ['Mi perfil',       'user',             true],
    ['Salón',           'storefront',       esGestion],
    ['Agenda',          'calendar-blank',   esGestion],
    ['Comisiones',      'percent',          esGestion],
    ['Usuarios y roles','users-three',      esGestion],
    ['Notificaciones',  'bell',             esGestion],
    ['Anticipos y pagos','credit-card',     esGestion],
    ['Apariencia',      'palette',          true],
  ].filter(t => t[2]) as [string, string, boolean][]

  const [tab, setTab] = useState('Mi perfil')

  const renderTab = () => {
    switch (tab) {
      case 'Mi perfil':        return <AjustesPerfil user={user} />
      case 'Salón':            return <AjustesSalon />
      case 'Agenda':           return <AjustesAgenda />
      case 'Comisiones':       return <AjustesComisiones />
      case 'Usuarios y roles': return <AjustesUsuarios user={user} />
      case 'Notificaciones':   return <AjustesNotif />
      case 'Anticipos y pagos':return <AjustesPagos />
      case 'Apariencia':       return <AjustesApariencia />
      default: return null
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 className="display" style={{ fontSize: 26, margin: 0 }}>Ajustes</h1>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Configuración del salón, agenda y preferencias</div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: '232px 1fr', alignItems: 'start', gap: 20 }}>
        <div className="card" style={{ position: 'sticky', top: 92, padding: 8 }}>
          {allTabs.map(([label, icon]) => (
            <div key={label} className={'nav-item' + (tab === label ? ' active' : '')} onClick={() => setTab(label)}>
              <Ic n={icon} />{label}
            </div>
          ))}
        </div>
        <div>{renderTab()}</div>
      </div>
    </div>
  )
}

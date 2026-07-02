/* ROBSEN · Ajustes */
function ScreenAjustes({ user }) {
  const RB = window.RB;
  const esGestion = user.rol === 'admin' || user.rol === 'gerente';
  const allTabs = [
    ['Mi perfil', 'user', true], ['Salón', 'storefront', esGestion], ['Usuarios y roles', 'users-three', esGestion],
    ['Notificaciones', 'bell', esGestion], ['Anticipos y pagos', 'credit-card', esGestion], ['Apariencia', 'palette', true],
  ];
  const tabs = allTabs.filter(t => t[2]);
  const [tab, setTab] = useState('Mi perfil');

  return (
    <div>
      <div className="between" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="display" style={{ fontSize: 26, margin: 0 }}>Ajustes</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Configura tu cuenta, el salón y los permisos del equipo</div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '232px 1fr', alignItems: 'start' }}>
        <div className="card" style={{ position: 'sticky', top: 92, padding: 8 }}>
          {tabs.map(([t, ic]) => (
            <div key={t} className={'nav-item' + (tab === t ? ' active' : '')} style={{ margin: '2px 0' }} onClick={() => setTab(t)}><Ic n={ic} />{t}</div>
          ))}
        </div>

        <div style={{ minWidth: 0 }}>
          {tab === 'Mi perfil' && <AjustesPerfil user={user} />}
          {tab === 'Salón' && <AjustesSalon />}
          {tab === 'Usuarios y roles' && <AjustesUsuarios user={user} />}
          {tab === 'Notificaciones' && <AjustesNotif />}
          {tab === 'Anticipos y pagos' && <AjustesPagos />}
          {tab === 'Apariencia' && <AjustesApariencia />}
        </div>
      </div>
    </div>
  );
}

function SettingRow({ title, desc, children, last }) {
  return (
    <div className="between" style={{ padding: '16px 0', borderBottom: last ? 'none' : '1px solid var(--line-soft)', gap: 18 }}>
      <div style={{ maxWidth: 460 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{title}</div>{desc && <div className="dim" style={{ fontSize: 12, marginTop: 3, lineHeight: 1.5 }}>{desc}</div>}</div>
      <div style={{ flex: '0 0 auto' }}>{children}</div>
    </div>
  );
}

function AjustesPerfil({ user }) {
  const RB = window.RB; const rol = RB.roles[user.rol];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="card">
        <CardHead title="Información personal" sub="Cómo te ven en el sistema" />
        <div className="card-pad" style={{ paddingTop: 16 }}>
          <div className="vc gap16" style={{ marginBottom: 20 }}>
            <Avatar ini={user.ini} color={user.color} size="lg" />
            <div><button className="btn ghost sm" onClick={() => toast('Selecciona una foto de perfil', 'camera')}><Ic n="camera" />Cambiar foto</button><div className="dim" style={{ fontSize: 11.5, marginTop: 8 }}>JPG o PNG · máx. 2MB</div></div>
            <div className="spacer"></div>
            <span className="badge vip"><Ic n="shield-check" w="fill" />{rol.nombre}</span>
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="field"><label>Nombre completo</label><input className="input" defaultValue={user.nombre} /></div>
            <div className="field"><label>Rol</label><input className="input" defaultValue={rol.nombre} disabled /></div>
            <div className="field"><label>Correo electrónico</label><input className="input" defaultValue={user.email} /></div>
            <div className="field"><label>Teléfono</label><input className="input" defaultValue={user.tel} /></div>
          </div>
        </div>
      </div>
      <div className="card">
        <CardHead title="Seguridad" sub="Contraseña y acceso" />
        <div className="card-pad" style={{ paddingTop: 16 }}>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="field"><label>Contraseña actual</label><input className="input" type="password" defaultValue="········" /></div>
            <div></div>
            <div className="field"><label>Nueva contraseña</label><input className="input" type="password" placeholder="Mínimo 8 caracteres" /></div>
            <div className="field"><label>Confirmar contraseña</label><input className="input" type="password" placeholder="Repite la contraseña" /></div>
          </div>
          <SettingRow title="Verificación en dos pasos" desc="Recibe un código por WhatsApp al iniciar sesión." last><Switch on={false} onClick={() => { }} /></SettingRow>
        </div>
      </div>
      <div className="vc gap12" style={{ justifyContent: 'flex-end' }}><button className="btn ghost" onClick={() => toast('Cambios descartados', 'arrow-counter-clockwise')}>Cancelar</button><button className="btn gold" onClick={() => toast('Cambios guardados', 'check-circle')}><Ic n="check" />Guardar cambios</button></div>
    </div>
  );
}

function AjustesSalon() {
  const dias = [['Lunes', '09:00', '19:00', true], ['Martes', '09:00', '19:00', true], ['Miércoles', '09:00', '19:00', true], ['Jueves', '09:00', '19:00', true], ['Viernes', '09:00', '20:00', true], ['Sábado', '09:00', '16:00', true], ['Domingo', '—', '—', false]];
  const [open, setOpen] = useState(dias.map(d => d[3]));
  const [logo, setLogo] = useState(() => (window.RBgetLogo && window.RBgetLogo()) || '');
  const fileRef = useRef(null);
  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { setLogo(reader.result); window.RBsetLogo(reader.result); };
    reader.readAsDataURL(f);
  };
  const quitarLogo = () => { setLogo(''); window.RBsetLogo(''); if (fileRef.current) fileRef.current.value = ''; };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="card">
        <CardHead title="Logo del salón" sub="Reemplaza el título “Robsen” del menú lateral y aparece en recibos" />
        <div className="card-pad" style={{ paddingTop: 16 }}>
          <div className="vc gap16" style={{ flexWrap: 'wrap' }}>
            <div style={{ width: 150, height: 88, borderRadius: 'var(--r)', border: '1px solid var(--line)', background: 'linear-gradient(180deg,#100D0B,#0A0908)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, flex: '0 0 auto' }}>
              {logo
                ? <img src={logo} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                : <div className="logo serif" style={{ fontStyle: 'italic', fontSize: 26, background: 'var(--gold-grad)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Robsen</div>}
            </div>
            <div className="f1" style={{ minWidth: 200 }}>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" style={{ display: 'none' }} onChange={onFile} />
              <div className="vc gap10">
                <button className="btn gold sm" onClick={() => fileRef.current && fileRef.current.click()}><Ic n="upload-simple" />{logo ? 'Cambiar logo' : 'Subir logo'}</button>
                {logo && <button className="btn ghost sm" style={{ color: 'var(--st-canc)' }} onClick={quitarLogo}><Ic n="trash" />Quitar</button>}
              </div>
              <div className="dim" style={{ fontSize: 11.5, marginTop: 10, lineHeight: 1.5 }}>PNG, SVG o JPG con fondo transparente. Tamaño recomendado 340×108 px. Se aplica al instante en el menú lateral.</div>
            </div>
          </div>
        </div>
      </div>
      <div className="card">
        <CardHead title="Datos del salón" sub="Aparecen en reservas, recibos y mensajes" />
        <div className="card-pad" style={{ paddingTop: 16 }}>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="field" style={{ gridColumn: '1 / -1' }}><label>Nombre comercial</label><input className="input" defaultValue="Robsen Salón & Spa" /></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}><label>Dirección</label><input className="input" defaultValue="Av. Enrique Díaz de León Nte 2093, Guadalajara, Jal." /></div>
            <div className="field"><label>Teléfono</label><input className="input" defaultValue="33 3826 0774" /></div>
            <div className="field"><label>WhatsApp</label><input className="input" defaultValue="33 3826 0774" /></div>
          </div>
        </div>
      </div>
      <div className="card">
        <CardHead title="Horarios de atención" sub="Disponibilidad para agendar citas" />
        <div className="card-pad" style={{ paddingTop: 8 }}>
          {dias.map((d, i) => (
            <div key={d[0]} className="between" style={{ padding: '13px 0', borderBottom: i < 6 ? '1px solid var(--line-soft)' : 'none' }}>
              <div className="vc gap12" style={{ width: 160 }}><Switch on={open[i]} onClick={() => setOpen(o => o.map((v, k) => k === i ? !v : v))} /><span style={{ fontWeight: 600, fontSize: 13.5, color: open[i] ? 'var(--text)' : 'var(--text-4)' }}>{d[0]}</span></div>
              {open[i] ? (
                <div className="vc gap8"><input className="input num" defaultValue={d[1]} style={{ width: 90, textAlign: 'center', padding: '8px' }} /><span className="dim">a</span><input className="input num" defaultValue={d[2]} style={{ width: 90, textAlign: 'center', padding: '8px' }} /></div>
              ) : <span className="badge neutral">Cerrado</span>}
            </div>
          ))}
        </div>
      </div>
      <div className="vc gap12" style={{ justifyContent: 'flex-end' }}><button className="btn ghost" onClick={() => toast('Cambios descartados', 'arrow-counter-clockwise')}>Cancelar</button><button className="btn gold" onClick={() => toast('Cambios guardados', 'check-circle')}><Ic n="check" />Guardar cambios</button></div>
    </div>
  );
}

function AjustesUsuarios({ user }) {
  const RB = window.RB;
  const [usuarios, setUsuarios] = useState(RB.usuarios);
  const rolBadge = { admin: 'vip', gerente: 'pay', recepcion: 'conf', estilista: 'done' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="card">
        <CardHead title="Usuarios del equipo" sub={`${usuarios.length} cuentas · ${usuarios.filter(u => u.activo).length} activas`}
          right={<button className="btn gold sm" onClick={() => toast('Invitación enviada por correo', 'user-plus')}><Ic n="user-plus" />Invitar usuario</button>} />
        <table className="table" style={{ marginTop: 6 }}>
          <thead><tr><th>Usuario</th><th>Rol</th><th>Último acceso</th><th>Estado</th><th></th></tr></thead>
          <tbody>{usuarios.map((u, i) => (
            <tr key={u.id} style={{ cursor: 'default' }}>
              <td><div className="cell-name"><Avatar ini={u.ini} color={u.color} size="sm" /><div><div className="nm">{u.nombre}{u.id === user.id && <span className="dim" style={{ fontWeight: 400 }}> · tú</span>}</div><div className="meta">{u.email}</div></div></div></td>
              <td><span className={'badge ' + rolBadge[u.rol]}><span className="d"></span>{RB.roles[u.rol].nombre}</span></td>
              <td className="muted">{u.ultimo}</td>
              <td><span className={'badge ' + (u.activo ? 'conf' : 'neutral')}><span className="d"></span>{u.activo ? 'Activo' : 'Inactivo'}</span></td>
              <td><div className="vc gap8" style={{ justifyContent: 'flex-end' }}><Switch on={u.activo} onClick={() => setUsuarios(us => us.map((x, k) => k === i ? { ...x, activo: !x.activo } : x))} /><button className="btn icon ghost sm"><Ic n="dots-three" /></button></div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <div className="card">
        <CardHead title="Permisos por rol" sub="Qué módulos puede ver cada rol" />
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ marginTop: 6, minWidth: 560 }}>
            <thead><tr><th>Módulo</th>{Object.values(RB.roles).map(r => <th key={r.id} style={{ textAlign: 'center' }}>{r.nombre}</th>)}</tr></thead>
            <tbody>{RB.modulos.map(m => (
              <tr key={m.id} style={{ cursor: 'default' }}>
                <td style={{ fontWeight: 600 }}>{m.label}</td>
                {Object.values(RB.roles).map(r => {
                  const ok = r.allow === '*' || r.allow.includes(m.id);
                  return <td key={r.id} style={{ textAlign: 'center' }}>{ok
                    ? <span style={{ color: 'var(--st-conf)', display: 'inline-flex' }}><Ic n="check-circle" w="fill" /></span>
                    : <span style={{ color: 'var(--text-4)', display: 'inline-flex' }}><Ic n="minus-circle" /></span>}</td>;
                })}
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="card-pad vc gap16" style={{ paddingTop: 14, fontSize: 12, color: 'var(--text-3)' }}>
          <span className="vc gap8"><span style={{ color: 'var(--st-conf)' }}><Ic n="check-circle" w="fill" /></span>Con acceso</span>
          <span className="vc gap8"><span style={{ color: 'var(--text-4)' }}><Ic n="minus-circle" /></span>Sin acceso</span>
          <button className="btn line sm" style={{ marginLeft: 'auto' }} onClick={() => toast('Modo edición de permisos', 'pencil-simple')}><Ic n="pencil-simple" />Editar permisos</button>
        </div>
      </div>
    </div>
  );
}

function AjustesNotif() {
  const rows = [
    ['Confirmación automática de cita', 'Envía un WhatsApp al agendar para que la clienta confirme.', true],
    ['Recordatorio 24 h antes', 'Recuerda a la clienta su cita el día anterior.', true],
    ['Recordatorio mismo día', 'Mensaje 2 horas antes de la cita.', false],
    ['Reactivación de inactivas', 'Mensaje automático a clientas con +60 días sin visita.', true],
    ['Agradecimiento post-servicio', 'Mensaje de gracias al cerrar el servicio.', true],
    ['Alerta de anticipo pendiente', 'Notifica al equipo cuando falta cobrar un saldo.', true],
    ['Resumen diario al cierre', 'Recibe el corte del día por correo a las 20:00.', false],
  ];
  const [on, setOn] = useState(rows.map(r => r[2]));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="card">
        <CardHead title="Notificaciones y automatizaciones" sub="Mensajes que el sistema envía por ti" />
        <div className="card-pad" style={{ paddingTop: 8 }}>
          {rows.map((r, i) => <SettingRow key={r[0]} title={r[0]} desc={r[1]} last={i === rows.length - 1}><Switch on={on[i]} onClick={() => setOn(o => o.map((v, k) => k === i ? !v : v))} /></SettingRow>)}
        </div>
      </div>
      <div className="vc gap12" style={{ justifyContent: 'flex-end' }}><button className="btn gold" onClick={() => toast('Cambios guardados', 'check-circle')}><Ic n="check" />Guardar cambios</button></div>
    </div>
  );
}

function AjustesPagos() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="card">
        <CardHead title="Anticipos" sub="Reglas para apartar citas" />
        <div className="card-pad" style={{ paddingTop: 8 }}>
          <SettingRow title="Solicitar anticipo en reservas en línea" desc="La clienta paga un anticipo al agendar desde la web."><Switch on={true} onClick={() => { }} /></SettingRow>
          <SettingRow title="Porcentaje de anticipo sugerido" desc="Se calcula sobre el total del servicio.">
            <div className="seg"><button>20%</button><button className="active">35%</button><button>50%</button></div>
          </SettingRow>
          <SettingRow title="Política de cancelación" desc="Horas mínimas antes de la cita para reembolsar." last>
            <select className="select" style={{ width: 140 }} defaultValue="24 horas"><option>12 horas</option><option>24 horas</option><option>48 horas</option></select>
          </SettingRow>
        </div>
      </div>
      <div className="card">
        <CardHead title="Métodos de pago aceptados" sub="Cómo cobras en el salón" />
        <div className="card-pad" style={{ paddingTop: 8 }}>
          {[['Efectivo', 'money', true], ['Tarjeta de crédito / débito', 'credit-card', true], ['Transferencia (SPEI)', 'bank', true], ['Pago en línea (anticipos)', 'globe', true]].map((m, i, a) => (
            <SettingRow key={m[0]} title={<span className="vc gap10"><span style={{ color: 'var(--gold)' }}><Ic n={m[1]} /></span>{m[0]}</span>} last={i === a.length - 1}><Switch on={m[2]} onClick={() => { }} /></SettingRow>
          ))}
        </div>
      </div>
      <div className="card card-pad">
        <CardHead title="Moneda e impuestos" />
        <div className="grid mt18" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="field"><label>Moneda</label><select className="select" defaultValue="Peso mexicano (MXN)"><option>Peso mexicano (MXN)</option><option>Dólar (USD)</option></select></div>
          <div className="field"><label>IVA aplicado</label><select className="select" defaultValue="16%"><option>0%</option><option>16%</option></select></div>
        </div>
      </div>
      <div className="vc gap12" style={{ justifyContent: 'flex-end' }}><button className="btn gold" onClick={() => toast('Cambios guardados', 'check-circle')}><Ic n="check" />Guardar cambios</button></div>
    </div>
  );
}

function AjustesApariencia() {
  const [acc, setAcc] = useState('#C8A14A');
  const accent = ['#C8A14A', '#C58B7E', '#7E5A86', '#93B58C'];
  return (
    <div className="card">
      <CardHead title="Apariencia" sub="Personaliza el aspecto del panel" />
      <div className="card-pad" style={{ paddingTop: 8 }}>
        <SettingRow title="Tema" desc="El sistema usa el tema oscuro Robsen por defecto.">
          <div className="seg"><button className="active">Oscuro</button><button>Claro</button><button>Automático</button></div>
        </SettingRow>
        <SettingRow title="Color de acento" desc="Tono dorado de marca para botones y resaltados.">
          <div className="vc gap10">{accent.map(c => <span key={c} onClick={() => setAcc(c)} style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', boxShadow: acc === c ? '0 0 0 2px var(--bg), 0 0 0 4px ' + c : 'inset 0 0 0 1px rgba(255,255,255,0.15)' }}></span>)}</div>
        </SettingRow>
        <SettingRow title="Densidad de la interfaz" desc="Espaciado entre elementos en tablas y listas.">
          <div className="seg"><button>Compacta</button><button className="active">Cómoda</button></div>
        </SettingRow>
        <SettingRow title="Idioma" desc="Idioma del panel de administración." last>
          <select className="select" style={{ width: 150 }} defaultValue="Español (MX)"><option>Español (MX)</option><option>English (US)</option></select>
        </SettingRow>
      </div>
      <div className="card-pad" style={{ paddingTop: 0 }}>
        <div className="card" style={{ background: 'var(--surface)', padding: 16, marginTop: 4 }}>
          <div className="between" style={{ gap: 14 }}>
            <div style={{ maxWidth: 440 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>Restablecer datos de demostración</div><div className="dim" style={{ fontSize: 12, marginTop: 3, lineHeight: 1.5 }}>Borra clientas, citas, ventas y productos guardados localmente y vuelve a los datos de ejemplo originales.</div></div>
            <button className="btn ghost" style={{ color: 'var(--st-canc)', flex: '0 0 auto' }} onClick={() => { if (confirm('¿Restablecer todos los datos a los valores de demostración? Se perderán los cambios guardados.')) window.RBStore.resetAll(); }}><Ic n="arrow-counter-clockwise" />Restablecer</button>
          </div>
        </div>
      </div>
    </div>
  );
}
window.ScreenAjustes = ScreenAjustes;

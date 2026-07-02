/* ROBSEN · Empleados y comisiones */
function ScreenEmpleados() {
  const RB = window.RB;
  window.useStore();
  // métricas demo por estilista (las que no son de catálogo)
  const metricas = {
    e1: { citas: 42, ventas: 96400, comPct: 35, rating: 4.9, ocup: 88 },
    e2: { citas: 58, ventas: 71200, comPct: 30, rating: 4.8, ocup: 82 },
    e3: { citas: 31, ventas: 58600, comPct: 32, rating: 4.9, ocup: 74 },
    e4: { citas: 64, ventas: 44900, comPct: 25, rating: 4.7, ocup: 91 },
    e5: { citas: 27, ventas: 49300, comPct: 30, rating: 5.0, ocup: 69 },
  };
  const met = (id) => metricas[id] || { citas: 0, ventas: 0, comPct: 30, rating: 5.0, ocup: 0 };
  const datos = RB.estilistas.map(e => ({ id: e.id, ...met(e.id) }));

  const [selId, setSelId] = useState(RB.estilistas[0].id);
  const [editor, setEditor] = useState(null);
  const [horarios, setHorarios] = useState(false);
  const sel = datos.find(d => d.id === selId) || datos[0];
  const e = getEst(selId);
  const com = Math.round(sel.ventas * sel.comPct / 100);
  const servReal = RB.servicios.filter(s => s.prof.includes(selId));
  const comisionesMes = datos.reduce((s, d) => s + Math.round(d.ventas * d.comPct / 100), 0);

  return (
    <div>
      <div className="between" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="display" style={{ fontSize: 26, margin: 0 }}>Empleados y comisiones</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{RB.estilistas.length} profesionales activas · comisiones del mes: {mxn(comisionesMes)}</div>
        </div>
        <div className="vc gap12"><button className="btn ghost" onClick={() => setHorarios(true)}><Ic n="calendar-blank" />Horarios</button><button className="btn gold" onClick={() => setEditor({})}><Ic n="plus" />Nueva estilista</button></div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 360px', alignItems: 'start' }}>
        {/* Tabla rendimiento */}
        <div className="card">
          <CardHead title="Rendimiento del equipo" sub="Junio 2026" />
          <table className="table" style={{ marginTop: 6 }}>
            <thead><tr><th>Profesional</th><th className="num">Citas</th><th className="num">Ventas</th><th>Ocupación</th><th className="num">Comisión</th><th className="num">★</th></tr></thead>
            <tbody>{datos.map(d => {
              const es = getEst(d.id);
              return (
                <tr key={d.id} onClick={() => setSelId(d.id)} style={selId === d.id ? { background: 'rgba(200,161,74,0.06)' } : {}}>
                  <td><div className="cell-name"><Avatar ini={es.ini} color={es.color} size="sm" /><div><div className="nm">{es.nombre}</div><div className="meta">{es.rol}</div></div></div></td>
                  <td className="num">{d.citas}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{mxn(d.ventas)}</td>
                  <td><div className="vc gap8"><div className="bar" style={{ width: 64 }}><span style={{ width: d.ocup + '%' }}></span></div><span className="num dim" style={{ fontSize: 11.5 }}>{d.ocup}%</span></div></td>
                  <td className="num gold-text" style={{ fontWeight: 600 }}>{mxn(Math.round(d.ventas * d.comPct / 100))}</td>
                  <td className="num" style={{ color: 'var(--gold)' }}>{d.rating}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>

        {/* Detalle estilista */}
        <div className="card gold-edge" style={{ position: 'sticky', top: 92 }}>
          <div className="card-pad center" style={{ paddingBottom: 16 }}>
            <Avatar ini={e.ini} color={e.color} size="lg" />
            <h2 className="display" style={{ fontSize: 21, margin: '12px 0 4px' }}>{e.nombre}</h2>
            <div className="dim" style={{ fontSize: 12.5 }}>{e.rol}</div>
          </div>
          <hr className="hr" />
          <div className="card-pad grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="kpi-mini"><span className="l">Citas atendidas</span><span className="v">{sel.citas}</span></div>
            <div className="kpi-mini"><span className="l">Ventas generadas</span><span className="v">{mxn(sel.ventas)}</span></div>
            <div className="kpi-mini"><span className="l">Comisión ({sel.comPct}%)</span><span className="v gold-text">{mxn(com)}</span></div>
            <div className="kpi-mini"><span className="l">Calificación</span><span className="v">{sel.rating} ★</span></div>
          </div>
          <hr className="hr" />
          <div className="card-pad">
            <div className="eyebrow" style={{ marginBottom: 12 }}>Servicios que realiza</div>
            <div className="vc gap8" style={{ flexWrap: 'wrap' }}>{servReal.length ? servReal.map(s => <span key={s.id} className="chip">{s.nombre}</span>) : <span className="dim" style={{ fontSize: 12.5 }}>Sin servicios asignados aún</span>}</div>
            <div className="eyebrow mt24" style={{ marginBottom: 12 }}>Disponibilidad</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[['Lun – Vie', '09:00 – 19:00', true], ['Sábado', '09:00 – 16:00', true], ['Domingo', 'Descanso', false]].map(([d, h, on]) => (
                <div key={d} className="between" style={{ fontSize: 13 }}><span className="muted">{d}</span><span style={{ fontWeight: 600, color: on ? 'var(--text)' : 'var(--text-4)' }}>{h}</span></div>
              ))}
            </div>
            <button className="btn ghost w100 mt18" style={{ justifyContent: 'center' }} onClick={() => setEditor(e)}><Ic n="sliders-horizontal" />Editar perfil y comisión</button>
          </div>
        </div>
      </div>

      {editor && <EstilistaEditor e={editor} comPct={met(editor.id).comPct} onClose={() => setEditor(null)} />}
      {horarios && <HorariosModal onClose={() => setHorarios(false)} />}
    </div>
  );
}

function EstilistaEditor({ e, comPct, onClose }) {
  const RB = window.RB;
  const nuevo = !e.id;
  const [nombre, setNombre] = useState(e.nombre || '');
  const [rol, setRol] = useState(e.rol || 'Estilista Senior');
  const [color, setColor] = useState(e.color || '#C8A14A');
  const [pct, setPct] = useState(comPct || 30);
  const colores = ['#C8A14A', '#93B58C', '#6FA6B8', '#C77B7B', '#B08AC7', '#E8CE8A'];
  const guardar = () => {
    if (!nombre.trim()) return;
    window.RBStore.upsertEstilista({ ...(e.id ? { id: e.id } : {}), nombre: nombre.trim(), rol, color });
    toast(nuevo ? 'Estilista agregada' : 'Perfil actualizado', 'user');
    onClose();
  };
  const eliminar = () => { window.RBStore.removeEstilista(e.id); toast('Estilista eliminada', 'trash'); onClose(); };
  return (
    <div className="rb-modal-bg" onClick={onClose}>
      <div className="card gold-edge rb-modal" onClick={ev => ev.stopPropagation()} style={{ width: 480, maxWidth: '94vw' }}>
        <div className="card-head"><div><div className="eyebrow">{nuevo ? 'Agregar' : 'Editar'} estilista</div><h3 style={{ marginTop: 6 }}>{nuevo ? 'Nueva estilista' : e.nombre}</h3></div><button className="icon-btn" onClick={onClose}><Ic n="x" /></button></div>
        <div className="card-pad" style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field"><label>Nombre completo</label><input className="input" value={nombre} onChange={ev => setNombre(ev.target.value)} placeholder="Ej. Valeria Mendoza" /></div>
          <div className="field"><label>Especialidad / rol</label><input className="input" value={rol} onChange={ev => setRol(ev.target.value)} placeholder="Ej. Color & Balayage" /></div>
          <div className="field"><label>Comisión (%)</label><input className="input num" type="number" value={pct} onChange={ev => setPct(ev.target.value)} /></div>
          <div className="field"><label>Color de agenda</label>
            <div className="vc gap10">{colores.map(c => <span key={c} onClick={() => setColor(c)} style={{ width: 30, height: 30, borderRadius: '50%', background: c, cursor: 'pointer', boxShadow: color === c ? '0 0 0 2px var(--bg), 0 0 0 4px ' + c : 'inset 0 0 0 1px rgba(255,255,255,0.15)' }}></span>)}</div>
          </div>
        </div>
        <hr className="hr" />
        <div className="card-pad vc gap12" style={{ justifyContent: 'flex-end' }}>
          {!nuevo && <button className="btn ghost" style={{ color: 'var(--st-canc)', marginRight: 'auto' }} onClick={eliminar}><Ic n="trash" />Eliminar</button>}
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn gold" onClick={guardar} style={{ opacity: nombre.trim() ? 1 : .4, pointerEvents: nombre.trim() ? 'auto' : 'none' }}><Ic n="check" />Guardar</button>
        </div>
      </div>
    </div>
  );
}

function HorariosModal({ onClose }) {
  const RB = window.RB;
  const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  return (
    <div className="rb-modal-bg" onClick={onClose}>
      <div className="card gold-edge rb-modal" onClick={ev => ev.stopPropagation()} style={{ width: 640, maxWidth: '95vw' }}>
        <div className="card-head"><div><div className="eyebrow">Disponibilidad del equipo</div><h3 style={{ marginTop: 6 }}>Horarios por estilista</h3></div><button className="icon-btn" onClick={onClose}><Ic n="x" /></button></div>
        <div className="card-pad scroll-y" style={{ paddingTop: 14, maxHeight: '60vh' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '160px repeat(7, 1fr)', gap: 6, alignItems: 'center' }}>
            <div></div>
            {dias.map(d => <div key={d} className="center dim" style={{ fontSize: 11, fontWeight: 600 }}>{d}</div>)}
            {RB.estilistas.map(e => (
              <React.Fragment key={e.id}>
                <div className="vc gap8" style={{ padding: '6px 0' }}><Avatar ini={e.ini} color={e.color} size="sm" /><span style={{ fontSize: 12.5, fontWeight: 600 }}>{e.nombre.split(' ')[0]}</span></div>
                {dias.map((d, i) => {
                  const off = i === 6 || (e.id === 'e3' && i === 0); // domingo + un descanso ejemplo
                  return <div key={i} className="center" style={{ height: 34, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 600, background: off ? 'rgba(255,255,255,0.03)' : 'rgba(94,155,134,0.12)', color: off ? 'var(--text-4)' : 'var(--st-conf)', border: '1px solid ' + (off ? 'var(--line-soft)' : 'rgba(94,155,134,0.25)') }}>{off ? '—' : '9-19'}</div>;
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
        <hr className="hr" />
        <div className="card-pad vc gap12" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose}>Cerrar</button>
          <button className="btn gold" onClick={() => { toast('Horarios guardados', 'calendar-check'); onClose(); }}><Ic n="check" />Guardar horarios</button>
        </div>
      </div>
    </div>
  );
}
window.ScreenEmpleados = ScreenEmpleados;

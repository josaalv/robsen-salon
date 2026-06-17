/* ROBSEN · Servicios y paquetes */
function ScreenServicios() {
  const RB = window.RB;
  window.useStore();
  const [cat, setCat] = useState('Todos');
  const [editor, setEditor] = useState(null); // servicio o {}
  const cats = ['Todos', ...Array.from(new Set(RB.servicios.map(s => s.cat)))];
  const lista = cat === 'Todos' ? RB.servicios : RB.servicios.filter(s => s.cat === cat);

  return (
    <div>
      <div className="between" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="display" style={{ fontSize: 26, margin: 0 }}>Servicios y paquetes</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{RB.servicios.length} servicios en {cats.length - 1} categorías · 11 disponibles en línea</div>
        </div>
        <button className="btn gold" onClick={() => setEditor({})}><Ic n="plus" />Nuevo servicio</button>
      </div>

      <div className="vc gap8" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
        {cats.map(c => <button key={c} className="chip" style={cat === c ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : {}} onClick={() => setCat(c)}>{c}</button>)}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        {lista.map(s => {
          const profs = s.prof.map(getEst);
          return (
            <div key={s.id} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14, cursor: 'pointer' }} onClick={() => setEditor(s)}>
              <div className="between">
                <span className="badge neutral">{s.cat}</span>
                {s.online ? <span className="badge conf"><span className="d"></span>En línea</span> : <span className="badge neutral">Solo en salón</span>}
              </div>
              <div>
                <h3 className="serif" style={{ fontSize: 19, margin: 0, fontWeight: 600 }}>{s.nombre}</h3>
                <div className="vc gap16 mt10" style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                  <span className="vc" style={{ gap: 5 }}><Ic n="clock" />{s.dur} min</span>
                  {s.anticipo && <span className="vc" style={{ gap: 5, color: 'var(--gold)' }}><Ic n="hand-coins" />Requiere anticipo</span>}
                </div>
              </div>
              <hr className="hr" />
              <div className="between">
                <div className="vc" style={{ marginLeft: 2 }}>
                  {profs.slice(0, 3).map((p, i) => <div key={i} title={p.nombre} style={{ marginLeft: i ? -8 : 0 }}><Avatar ini={p.ini} color={p.color} size="sm" /></div>)}
                  <span className="dim" style={{ fontSize: 11.5, marginLeft: 10 }}>{profs.length} estilista{profs.length > 1 ? 's' : ''}</span>
                </div>
                <div className="num gold-text" style={{ fontFamily: 'var(--serif)', fontSize: 23, fontWeight: 600 }}>{mxn(s.precio)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {editor && <ServicioEditor s={editor} onClose={() => setEditor(null)} />}
    </div>
  );
}

function ServicioEditor({ s, onClose }) {
  const RB = window.RB;
  const nuevo = !s.id;
  const [nombre, setNombre] = useState(s.nombre || '');
  const [catV, setCatV] = useState(s.cat || RB.servicios[0].cat);
  const [dur, setDur] = useState(s.dur || 60);
  const [precio, setPrecio] = useState(s.precio || '');
  const [online, setOnline] = useState(s.online ?? true);
  const [anticipo, setAnticipo] = useState(s.anticipo ?? false);
  const [prof, setProf] = useState(s.prof || []);
  const cats = Array.from(new Set(RB.servicios.map(x => x.cat)));
  const toggleProf = (id) => setProf(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const guardar = () => {
    if (!nombre.trim() || !precio) return;
    window.RBStore.upsertServicio({ ...(s.id ? { id: s.id } : {}), nombre: nombre.trim(), cat: catV, dur: +dur || 60, precio: +precio, online, anticipo, prof: prof.length ? prof : [RB.estilistas[0].id] });
    onClose();
  };
  const eliminar = () => { window.RBStore.removeServicio(s.id); onClose(); };
  return (
    <div className="rb-modal-bg" onClick={onClose}>
      <div className="card gold-edge rb-modal" onClick={e => e.stopPropagation()} style={{ width: 540, maxWidth: '94vw' }}>
        <div className="card-head"><div><div className="eyebrow">{nuevo ? 'Crear' : 'Editar'} servicio</div><h3 style={{ marginTop: 6 }}>{nuevo ? 'Nuevo servicio' : s.nombre}</h3></div><button className="icon-btn" onClick={onClose}><Ic n="x" /></button></div>
        <div className="card-pad scroll-y" style={{ paddingTop: 16, maxHeight: '64vh', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field"><label>Nombre del servicio</label><input className="input" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Balayage Premium" /></div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="field"><label>Categoría</label><select className="select" value={catV} onChange={e => setCatV(e.target.value)}>{cats.map(c => <option key={c}>{c}</option>)}</select></div>
            <div className="field"><label>Duración (min)</label><input className="input num" type="number" value={dur} onChange={e => setDur(e.target.value)} /></div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="field"><label>Precio (MXN)</label><input className="input num" type="number" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="0" /></div>
            <div className="field"><label>Anticipo sugerido</label><input className="input num" type="number" value={anticipo && precio ? Math.round(precio * 0.35) : 0} disabled /></div>
          </div>
          <div className="field"><label>Estilistas que lo realizan</label>
            <div className="vc gap8" style={{ flexWrap: 'wrap' }}>{RB.estilistas.map(e => {
              const on = prof.includes(e.id);
              return <button key={e.id} className="chip" style={on ? { borderColor: e.color, color: 'var(--text)' } : {}} onClick={() => toggleProf(e.id)}><span className="dotc" style={{ background: e.color }}></span>{e.nombre.split(' ')[0]}{on && <Ic n="check" />}</button>;
            })}</div>
          </div>
          <div className="card" style={{ background: 'var(--surface)', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="between"><div><div style={{ fontWeight: 600, fontSize: 13.5 }}>Requiere anticipo</div><div className="dim" style={{ fontSize: 12 }}>La clienta paga un anticipo para apartar.</div></div><Switch on={anticipo} onClick={() => setAnticipo(v => !v)} /></div>
            <hr className="hr" />
            <div className="between"><div><div style={{ fontWeight: 600, fontSize: 13.5 }}>Disponible para agendar en línea</div><div className="dim" style={{ fontSize: 12 }}>Visible en la página de reservas para clientas.</div></div><Switch on={online} onClick={() => setOnline(v => !v)} /></div>
          </div>
        </div>
        <hr className="hr" />
        <div className="card-pad vc gap12" style={{ justifyContent: 'flex-end' }}>
          {!nuevo && <button className="btn ghost" style={{ color: 'var(--st-canc)', marginRight: 'auto' }} onClick={eliminar}><Ic n="trash" />Eliminar</button>}
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn gold" onClick={guardar} style={{ opacity: nombre.trim() && precio ? 1 : .4, pointerEvents: nombre.trim() && precio ? 'auto' : 'none' }}><Ic n="check" />Guardar servicio</button>
        </div>
      </div>
    </div>
  );
}
window.ScreenServicios = ScreenServicios;

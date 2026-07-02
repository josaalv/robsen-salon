/* ROBSEN · Agenda */
function ScreenAgenda() {
  const RB = window.RB;
  window.useStore();
  const [vista, setVista] = useState('Día');
  const [filtro, setFiltro] = useState('todos');
  const [sel, setSel] = useState(RB.hoy[2]);
  const [editCita, setEditCita] = useState(null); // {} nuevo · objeto = editar

  useEffect(() => { if (window.RBnuevaCita) { window.RBnuevaCita = false; setEditCita({}); } }, []);

  const estilistas = RB.estilistas;
  const visibles = filtro === 'todos' ? estilistas : estilistas.filter(e => e.id === filtro);

  const START = 9, END = 20, PXH = 60;
  const horas = [];
  for (let h = START; h <= END; h++) horas.push(h);

  const top = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return (h - START + m / 60) * PXH; };

  return (
    <div>
      <div className="between" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="display" style={{ fontSize: 26, margin: 0 }}>Agenda del salón</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Jueves 12 de junio, 2026 · {RB.hoy.length} citas · 6 estilistas activas</div>
        </div>
        <div className="vc gap12">
          <Seg opts={['Día', 'Semana', 'Mes']} value={vista} onChange={setVista} />
          <button className="btn ghost" onClick={() => toast('Selecciona un horario en la agenda para bloquearlo', 'lock-simple')}><Ic n="lock-simple" />Bloquear horario</button>
          <button className="btn gold" onClick={() => setEditCita({})}><Ic n="plus" />Nueva cita</button>
        </div>
      </div>

      {/* Barra de filtros estilistas */}
      <div className="vc gap8" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <span className="dim" style={{ fontSize: 12, marginRight: 4 }}>Estilista:</span>
        <button className={'chip' + (filtro === 'todos' ? ' sel' : '')} style={filtro === 'todos' ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : {}} onClick={() => setFiltro('todos')}>Todas</button>
        {estilistas.map(e => (
          <button key={e.id} className="chip" style={filtro === e.id ? { borderColor: e.color, color: 'var(--text)' } : {}} onClick={() => setFiltro(e.id)}>
            <span className="dotc" style={{ background: e.color }}></span>{e.nombre.split(' ')[0]}
          </button>
        ))}
        <div className="spacer"></div>
        <div className="vc gap12" style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
          {['pend', 'conf', 'pay', 'done', 'canc'].map(k => <EstadoBadge key={k} k={k} />)}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: sel ? '1fr 320px' : '1fr', alignItems: 'start' }}>
        {/* Vista principal */}
        {vista === 'Día' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            {/* Encabezado estilistas */}
            <div style={{ display: 'grid', gridTemplateColumns: `64px repeat(${visibles.length},1fr)`, borderBottom: '1px solid var(--line-soft)' }}>
              <div></div>
              {visibles.map(e => (
                <div key={e.id} className="vc gap8" style={{ padding: '14px 12px', borderLeft: '1px solid var(--line-soft)' }}>
                  <Avatar ini={e.ini} color={e.color} size="sm" />
                  <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 12.5 }}>{e.nombre.split(' ')[0]}</div><div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{e.rol}</div></div>
                </div>
              ))}
            </div>
            {/* Cuadrícula */}
            <div style={{ display: 'grid', gridTemplateColumns: `64px repeat(${visibles.length},1fr)`, position: 'relative' }}>
              {/* columna horas */}
              <div>
                {horas.map(h => <div key={h} style={{ height: PXH, padding: '4px 10px 0', textAlign: 'right', fontSize: 11, color: 'var(--text-4)', fontVariantNumeric: 'tabular-nums' }}>{String(h).padStart(2, '0')}:00</div>)}
              </div>
              {visibles.map(e => (
                <div key={e.id} style={{ position: 'relative', borderLeft: '1px solid var(--line-soft)' }}>
                  {horas.map(h => <div key={h} style={{ height: PXH, borderBottom: '1px solid var(--line-soft)' }}></div>)}
                  {/* bloque de comida 14-15 para e3 ejemplo */}
                  {e.id === 'e3' && (
                    <div className="appt block" style={{ position: 'absolute', left: 4, right: 4, top: top('15:30'), height: PXH - 6 }}>
                      <div className="t" style={{ color: 'var(--text-3)' }}>Descanso</div>
                    </div>
                  )}
                  {RB.hoy.filter(a => a.est === e.id).map(a => (
                    <div key={a.id} className={`appt ${a.estado}`} onClick={() => setSel(a)}
                      style={{ position: 'absolute', left: 4, right: 4, top: top(a.h) + 2, height: (a.dur / 60) * PXH - 6, zIndex: 2, boxShadow: sel && sel.id === a.id ? '0 0 0 1.5px var(--gold)' : 'none' }}>
                      <div className="t">{a.h} · {a.cl.split(' ')[0]} {a.cl.split(' ')[1] || ''}</div>
                      <div className="s">{a.srv}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {vista === 'Semana' && <WeekView RB={RB} onSel={setSel} />}
        {vista === 'Mes' && <MonthView />}

        {/* Panel detalle */}
        {sel && <ApptDetail a={sel} onClose={() => setSel(null)} onEdit={() => setEditCita(sel)} onDelete={() => { window.RBStore.removeCita(sel.id); setSel(null); }} />}
      </div>

      {editCita && <CitaModal cita={editCita} onClose={() => setEditCita(null)} onSaved={(c) => { setEditCita(null); setSel(c); }} />}
    </div>
  );
}

/* ===== Modal crear / editar cita ===== */
function CitaModal({ cita, onClose, onSaved }) {
  const RB = window.RB;
  const nuevo = !cita.id;
  const [cl, setCl] = useState(cita.cl || '');
  const [srvId, setSrvId] = useState(() => { const s = RB.servicios.find(s => s.nombre === cita.srv); return s ? s.id : RB.servicios[0].id; });
  const [est, setEst] = useState(cita.est || RB.estilistas[0].id);
  const [h, setH] = useState(cita.h || '10:00');
  const [estado, setEstado] = useState(cita.estado || 'pend');
  const [ant, setAnt] = useState(cita.ant || 0);
  const srv = RB.servicios.find(s => s.id === srvId) || RB.servicios[0];
  const total = cita.total != null && !nuevo && cita.srv === srv.nombre ? cita.total : srv.precio;

  const guardar = () => {
    if (!cl.trim()) return;
    const data = { ...(cita.id ? { id: cita.id } : {}), cl: cl.trim(), srv: srv.nombre, est, h, dur: srv.dur, estado, total: srv.precio, ant: +ant || 0 };
    window.RBStore.upsertCita(data);
    const saved = window.RB.hoy.find(a => a.cl === data.cl && a.h === data.h) || data;
    onSaved(saved);
  };

  return (
    <div className="rb-modal-bg" onClick={onClose}>
      <div className="card gold-edge rb-modal" onClick={e => e.stopPropagation()} style={{ width: 520, maxWidth: '94vw' }}>
        <div className="card-head"><div><div className="eyebrow">{nuevo ? 'Agendar' : 'Editar'} cita</div><h3 style={{ marginTop: 6 }}>{nuevo ? 'Nueva cita' : cita.cl}</h3></div><button className="icon-btn" onClick={onClose}><Ic n="x" /></button></div>
        <div className="card-pad" style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field"><label>Clienta</label>
            <input className="input" list="rb-clientas" value={cl} onChange={e => setCl(e.target.value)} placeholder="Escribe o elige una clienta…" />
            <datalist id="rb-clientas">{RB.clientas.map(c => <option key={c.id} value={c.nombre} />)}</datalist>
          </div>
          <div className="field"><label>Servicio</label>
            <select className="select" value={srvId} onChange={e => setSrvId(e.target.value)}>{RB.servicios.map(s => <option key={s.id} value={s.id}>{s.nombre} — {mxn(s.precio)} · {s.dur} min</option>)}</select>
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="field"><label>Estilista</label><select className="select" value={est} onChange={e => setEst(e.target.value)}>{RB.estilistas.map(es => <option key={es.id} value={es.id}>{es.nombre}</option>)}</select></div>
            <div className="field"><label>Hora</label><input className="input num" type="time" value={h} onChange={e => setH(e.target.value)} /></div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="field"><label>Estado</label>
              <select className="select" value={estado} onChange={e => setEstado(e.target.value)}>
                {Object.values(RB.estadosCita).map(s => <option key={s.k} value={s.k}>{s.label}</option>)}
              </select>
            </div>
            <div className="field"><label>Anticipo (MXN)</label><input className="input num" type="number" value={ant || ''} placeholder="0" onChange={e => setAnt(e.target.value)} /></div>
          </div>
          <div className="card" style={{ background: 'var(--surface)', padding: 14 }}>
            <div className="between"><span className="muted">Total del servicio</span><span className="num gold-text" style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>{mxn(srv.precio)}</span></div>
            <div className="between mt10" style={{ fontSize: 12.5 }}><span className="muted">Saldo por cobrar</span><span className="num" style={{ fontWeight: 600 }}>{mxn(Math.max(0, srv.precio - (+ant || 0)))}</span></div>
          </div>
        </div>
        <hr className="hr" />
        <div className="card-pad vc gap12" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn gold" onClick={guardar} style={{ opacity: cl.trim() ? 1 : .4, pointerEvents: cl.trim() ? 'auto' : 'none' }}><Ic n="check" />{nuevo ? 'Agendar cita' : 'Guardar cambios'}</button>
        </div>
      </div>
    </div>
  );
}

function WeekView({ RB, onSel }) {
  const dias = [['Lun', 8], ['Mar', 9], ['Mié', 10], ['Jue', 11], ['Vie', 12], ['Sáb', 13], ['Dom', 14]];
  const sample = (i) => RB.hoy.filter((_, k) => k % 7 !== (i % 3) ? false : true).concat(RB.hoy.slice(i, i + (i === 4 ? 5 : 3)));
  return (
    <div className="card card-pad">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 12 }}>
        {dias.map(([d, num], i) => {
          const items = i === 6 ? [] : RB.hoy.slice((i * 2) % RB.hoy.length).slice(0, i === 4 ? 5 : i === 5 ? 4 : 3);
          const hoy = num === 12;
          return (
            <div key={d}>
              <div className="center" style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>{d}</div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: hoy ? '#241c0c' : 'var(--text)', background: hoy ? 'var(--gold-grad)' : 'none', borderRadius: 10, width: 36, height: 36, lineHeight: '36px', margin: '4px auto 0' }}>{num}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 320 }}>
                {items.map((a, k) => (
                  <div key={k} className={`appt ${a.estado}`} onClick={() => onSel(a)}>
                    <div className="t">{a.h}</div><div className="s">{a.cl.split(' ')[0]}</div>
                  </div>
                ))}
                {d === 'Dom' && <div className="imgph" style={{ minHeight: 70, fontSize: 10 }}>Cerrado</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthView() {
  const dow = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const counts = { 3: 6, 4: 9, 5: 11, 8: 7, 9: 10, 10: 12, 11: 8, 12: 10, 15: 5, 16: 9, 17: 11, 18: 7, 19: 13, 22: 6, 23: 8, 24: 10, 25: 9, 26: 14 };
  const cells = [];
  for (let d = 1; d <= 30; d++) cells.push(d); // junio 2026 inicia lunes
  return (
    <div className="card card-pad">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 8 }}>
        {dow.map((d, i) => <div key={i} className="center dim" style={{ fontSize: 11, fontWeight: 600, paddingBottom: 4 }}>{d}</div>)}
        {cells.map(d => {
          const n = counts[d] || 0, hoy = d === 12, dom = d % 7 === 0;
          return (
            <div key={d} style={{ minHeight: 92, borderRadius: 10, border: '1px solid ' + (hoy ? 'var(--gold)' : 'var(--line-soft)'), background: hoy ? 'rgba(200,161,74,0.06)' : dom ? 'rgba(255,255,255,0.015)' : 'var(--surface)', padding: 9 }}>
              <div className="between">
                <span className="num" style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600, color: hoy ? 'var(--gold)' : dom ? 'var(--text-4)' : 'var(--text-2)' }}>{d}</span>
                {n > 0 && <span style={{ fontSize: 10, color: 'var(--text-4)' }}>{n}</span>}
              </div>
              {n > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 8 }}>
                  {Array.from({ length: Math.min(n, 6) }).map((_, k) => <span key={k} className="dotc" style={{ background: ['#C8A14A', '#93B58C', '#6FA6B8', '#D9A441'][k % 4] }}></span>)}
                </div>
              )}
              {dom && <div style={{ fontSize: 9.5, color: 'var(--text-4)', marginTop: 8 }}>Cerrado</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ApptDetail({ a, onClose, onEdit, onDelete }) {
  const e = getEst(a.est);
  const saldo = a.total - a.ant;
  return (
    <div className="card gold-edge" style={{ position: 'sticky', top: 92 }}>
      <div className="card-head"><div><div className="eyebrow">Detalle de cita</div><h3 style={{ marginTop: 6 }}>{a.cl}</h3></div>
        <button className="icon-btn" onClick={onClose}><Ic n="x" /></button></div>
      <div className="card-pad" style={{ paddingTop: 14 }}>
        <div style={{ marginBottom: 14 }}><EstadoBadge k={a.estado} /></div>
        {[['scissors', 'Servicio', a.srv], ['clock', 'Horario', `${a.h} · ${a.dur} min`], ['user', 'Estilista', e.nombre]].map(([ic, l, v]) => (
          <div key={l} className="list-item" style={{ padding: '11px 0' }}>
            <div className="ico" style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(200,161,74,0.08)', border: '1px solid var(--line)', color: 'var(--gold)' }}><Ic n={ic} /></div>
            <div className="f1"><div style={{ fontSize: 11, color: 'var(--text-3)' }}>{l}</div><div style={{ fontWeight: 600, fontSize: 13.5 }}>{v}</div></div>
          </div>
        ))}
        <div className="card" style={{ background: 'var(--surface)', padding: 14, marginTop: 12 }}>
          <div className="between" style={{ fontSize: 13 }}><span className="muted">Total servicio</span><span className="num" style={{ fontWeight: 600 }}>{mxn(a.total)}</span></div>
          <div className="between mt10" style={{ fontSize: 13 }}><span className="muted">Anticipo</span><span className="num" style={{ fontWeight: 600, color: 'var(--st-conf)' }}>{a.ant ? mxn(a.ant) : '—'}</span></div>
          <hr className="hr" style={{ margin: '10px 0' }} />
          <div className="between"><span style={{ fontWeight: 600 }}>Saldo por cobrar</span><span className="num gold-text" style={{ fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600 }}>{mxn(saldo)}</span></div>
        </div>
        <div className="field mt14"><label>Notas</label>
          <div className="card" style={{ background: 'var(--surface)', padding: 12, fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5 }}>Prefiere tono ceniza, alérgica al amoniaco. Fórmula 7.1 + 9.1 (20 vol).</div>
        </div>
        <div className="vc gap8 mt14">
          <button className="btn gold f1" style={{ justifyContent: 'center' }} onClick={() => { window.RBStore.upsertCita({ id: a.id, estado: 'done' }); }}><Ic n="check" />Cobrar saldo</button>
          <button className="btn ghost" title="Enviar WhatsApp" onClick={() => window.RBgo('whatsapp')}><Ic n="whatsapp-logo" /></button>
          <button className="btn ghost" title="Editar" onClick={onEdit}><Ic n="pencil-simple" /></button>
          <button className="btn ghost" title="Eliminar" style={{ color: 'var(--st-canc)' }} onClick={onDelete}><Ic n="trash" /></button>
        </div>
      </div>
    </div>
  );
}
window.ScreenAgenda = ScreenAgenda;

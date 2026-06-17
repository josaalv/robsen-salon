/* ROBSEN · Seguimiento y WhatsApp */
function ScreenWhatsApp() {
  const RB = window.RB;
  const [sel, setSel] = useState(RB.mensajes[0]);
  const [filtro, setFiltro] = useState('Pendientes');
  const [draft, setDraft] = useState('');
  const [chats, setChats] = useState({}); // {msgId: [{dir,txt,ts}]}
  const inputRef = useRef(null);

  const fillTpl = (txt) => {
    const t = txt.replace('{nombre}', sel.cl.split(' ')[0]).replace('{servicio}', 'tu servicio').replace('{fecha}', 'hoy').replace('{hora}', '11:00').replace('{estilista}', getEst(sel.est).nombre.split(' ')[0]).replace('{dias}', '60');
    setDraft(t);
    if (inputRef.current) inputRef.current.focus();
  };
  const enviar = () => {
    if (!draft.trim()) return;
    const ts = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    setChats(c => ({ ...c, [sel.id]: [...(c[sel.id] || []), { dir: 'out', txt: draft.trim(), ts }] }));
    setDraft('');
    toast('Mensaje enviado por WhatsApp', 'whatsapp-logo');
  };

  const EstadoMsg = ({ e }) => {
    const map = { enviado: ['check', 'var(--text-3)'], entregado: ['checks', 'var(--text-2)'], respondido: ['checks', 'var(--st-conf)'] };
    const [ic, c] = map[e] || ['check', 'var(--text-3)'];
    return <span className="vc" style={{ gap: 4, fontSize: 11, color: c, textTransform: 'capitalize' }}><Ic n={ic} />{e}</span>;
  };

  const extra = chats[sel.id] || [];

  return (
    <div>
      <div className="between" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="display" style={{ fontSize: 26, margin: 0 }}>Seguimiento y WhatsApp</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>3 mensajes sin responder · 8 clientas inactivas por reactivar</div>
        </div>
        <button className="btn gold" onClick={() => toast('Envío masivo programado a 8 clientas inactivas', 'paper-plane-tilt')}><Ic n="paper-plane-tilt" />Envío masivo</button>
      </div>

      {/* KPIs seguimiento */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 18 }}>
        {[['chat-circle-dots', 'Mensajes pendientes', '7', 'var(--st-pend)'], ['calendar-check', 'Confirmaciones hoy', '14', 'var(--st-conf)'], ['clock-countdown', 'Sin responder', '3', 'var(--st-canc)'], ['user-minus', 'Inactivas 30/60/90', '8', 'var(--gold)']].map(([ic, l, v, c]) => (
          <div key={l} className="card card-pad vc gap16">
            <div className="ico" style={{ width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line-soft)', color: c }}><Ic n={ic} /></div>
            <div className="kpi-mini"><span className="l">{l}</span><span className="v">{v}</span></div>
          </div>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: '380px 1fr 300px', alignItems: 'start', gap: 18 }}>
        {/* Lista mensajes */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-pad" style={{ paddingBottom: 12 }}>
            <Seg opts={['Pendientes', 'Todos', 'Inactivas']} value={filtro} onChange={setFiltro} />
          </div>
          <div style={{ maxHeight: 540, overflowY: 'auto' }}>
            {RB.mensajes.map(m => {
              const e = getEst(m.est), act = sel.id === m.id;
              return (
                <div key={m.id} onClick={() => setSel(m)} style={{ display: 'flex', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--line-soft)', cursor: 'pointer', background: act ? 'rgba(200,161,74,0.06)' : 'transparent', borderLeft: '2px solid ' + (act ? 'var(--gold)' : 'transparent') }}>
                  <div style={{ position: 'relative' }}><Avatar ini={m.cl.split(' ').map(x => x[0]).slice(0, 2).join('')} size="sm" />{m.sin && <span style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: '50%', background: 'var(--st-pend)', border: '2px solid var(--panel)' }}></span>}</div>
                  <div className="f1" style={{ minWidth: 0 }}>
                    <div className="between"><span style={{ fontWeight: 600, fontSize: 13.5 }}>{m.cl}</span><span className="dim" style={{ fontSize: 11 }}>{m.t}</span></div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.prev}</div>
                    <div className="vc gap8 mt6"><span className="badge neutral" style={{ fontSize: 10.5, padding: '2px 8px' }}>{m.tipo}</span><EstadoMsg e={m.estado} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Conversación */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 540 }}>
          <div className="card-head" style={{ paddingBottom: 16, borderBottom: '1px solid var(--line-soft)' }}>
            <div className="vc gap12"><Avatar ini={sel.cl.split(' ').map(x => x[0]).slice(0, 2).join('')} size="sm" /><div><h3 style={{ fontSize: 16 }}>{sel.cl}</h3><div className="vc gap8" style={{ fontSize: 11.5, color: 'var(--st-conf)' }}><span className="dotc" style={{ background: 'var(--st-conf)' }}></span>WhatsApp · en línea</div></div></div>
            <button className="btn sm ghost" onClick={() => window.RBgo('crm')}><Ic n="user" />Ver perfil</button>
          </div>
          <div className="card-pad f1" style={{ display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'flex-end' }}>
            <div className="center dim" style={{ fontSize: 11 }}>Hoy</div>
            <div className="wa-bubble out">Hola {sel.cl.split(' ')[0]} 💛 Confirmamos tu cita de {sel.tipo === 'Reactivación' ? 'tu próximo servicio' : 'Botox Capilar'} hoy a las 11:00 con Mariana. Responde CONFIRMO para apartar tu lugar.<span className="ts">10:24 ✓✓</span></div>
            {sel.estado === 'respondido' && <div className="wa-bubble in">{sel.prev}<span className="ts">10:31</span></div>}
            {sel.sin && extra.length === 0 && <div className="center" style={{ fontSize: 11.5, color: 'var(--st-pend)' }}><Ic n="clock" /> Sin respuesta · enviado hace 2 h</div>}
            {extra.map((m, i) => <div key={i} className="wa-bubble out">{m.txt}<span className="ts">{m.ts} ✓</span></div>)}
          </div>
          <div className="card-pad" style={{ borderTop: '1px solid var(--line-soft)' }}>
            <div className="vc gap10">
              <button className="btn icon ghost" onClick={() => toast('Adjuntar archivo', 'paperclip')}><Ic n="paperclip" /></button>
              <input ref={inputRef} className="input f1" placeholder="Escribe un mensaje o usa una plantilla…" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') enviar(); }} />
              <button className="btn gold icon" onClick={enviar}><Ic n="paper-plane-tilt" /></button>
            </div>
          </div>
        </div>

        {/* Plantillas */}
        <div className="card" style={{ position: 'sticky', top: 92 }}>
          <CardHead title="Plantillas" sub="Toca para insertar" />
          <div className="card-pad" style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {RB.plantillas.map(p => (
              <div key={p.id} className="card" style={{ background: 'var(--surface)', padding: 14, cursor: 'pointer' }} onClick={() => fillTpl(p.txt)}>
                <div className="vc gap10"><span style={{ color: 'var(--gold)' }}><Ic n={p.icon} /></span><span style={{ fontWeight: 600, fontSize: 13 }}>{p.nombre}</span></div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 8, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.txt}</div>
              </div>
            ))}
            <button className="btn line w100" style={{ justifyContent: 'center' }} onClick={() => toast('Editor de plantillas', 'plus')}><Ic n="plus" />Nueva plantilla</button>
          </div>
        </div>
      </div>
    </div>
  );
}
window.ScreenWhatsApp = ScreenWhatsApp;

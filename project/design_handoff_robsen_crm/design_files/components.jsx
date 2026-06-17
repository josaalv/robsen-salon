/* ROBSEN · Componentes compartidos */
const { useState, useMemo, useEffect, useRef } = React;
const mxn = window.RBh.mxn, mxn0 = window.RBh.mxn0, getEst = window.RBh.estilista;

/* ---- Icono Phosphor ---- */
function Ic({ n, w }) { return <i className={`ph${w ? '-' + w : ''} ph-${n}`}></i>; }

/* ---- Avatar ---- */
function Avatar({ ini, color, size }) {
  const cls = 'avatar' + (size ? ' ' + size : '');
  const style = color ? { background: color, color: '#1a1410' } : undefined;
  return <div className={cls} style={style}>{ini}</div>;
}

/* ---- Badge estado de cita ---- */
function EstadoBadge({ k }) {
  const e = window.RB.estadosCita[k] || { label: k };
  return <span className={`badge ${k}`}><span className="d"></span>{e.label}</span>;
}

/* ---- Badge estado de clienta ---- */
function ClienteBadge({ estado }) {
  const map = { VIP: 'vip', Frecuente: 'frec', Activa: 'conf', Nueva: 'new', Inactiva: 'canc' };
  const ic = estado === 'VIP' ? <Ic n="crown-simple" w="fill" /> : null;
  return <span className={`badge ${map[estado] || 'neutral'}`}>{ic}{estado}</span>;
}

/* ---- Stat / KPI card ---- */
function Stat({ icon, label, value, unit, delta, deltaDir, spark, sparkColor }) {
  return (
    <div className="card stat">
      <div className="ico"><Ic n={icon} /></div>
      <div className="label">{label}</div>
      <div className="value">{value}{unit && <small> {unit}</small>}</div>
      {delta != null && (
        <div className={`delta ${deltaDir}`}>
          <Ic n={deltaDir === 'up' ? 'trend-up' : 'trend-down'} />{delta}
        </div>
      )}
      {spark && <div className="spark"><Sparkline data={spark} color={sparkColor} /></div>}
    </div>
  );
}

/* ---- Sparkline (línea simple) ---- */
function Sparkline({ data, color = '#C8A14A', w = 86, h = 34 }) {
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * (h - 4) - 2;
    return [x, y];
  });
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = d + ` L${w} ${h} L0 ${h} Z`;
  const gid = 'sg' + Math.round(Math.random() * 1e6);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={color} stopOpacity="0.28" /><stop offset="1" stopColor={color} stopOpacity="0" />
      </linearGradient></defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.6" fill={color} />
    </svg>
  );
}

/* ---- Bar chart (vertical) ---- */
function BarChart({ data, h = 200, fmt = (v) => mxn0(v), highlightLast }) {
  const max = Math.max(...data.map(d => d.v));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: h, padding: '8px 2px 0' }}>
      {data.map((d, i) => {
        const pct = (d.v / max) * 100;
        const hot = highlightLast && i === data.length - 1;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
            <div className="num" style={{ fontSize: 11, color: hot ? 'var(--gold)' : 'var(--text-3)', fontWeight: 600 }}>{fmt(d.v)}</div>
            <div title={fmt(d.v)} style={{
              width: '100%', maxWidth: 46, height: pct + '%', borderRadius: '7px 7px 3px 3px',
              background: hot ? 'var(--gold-grad)' : 'linear-gradient(180deg, #3a2f1f, #221c14)',
              border: '1px solid ' + (hot ? 'transparent' : 'var(--line-soft)'),
              transition: 'height .5s cubic-bezier(.2,.8,.2,1)'
            }}></div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600 }}>{d.d}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ---- Donut chart ---- */
function Donut({ data, size = 168, thick = 22 }) {
  const total = data.reduce((s, d) => s + d.v, 0);
  const r = (size - thick) / 2, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
      <svg width={size} height={size} style={{ flex: '0 0 ' + size + 'px' }}>
        <g transform={`translate(${size / 2},${size / 2}) rotate(-90)`}>
          <circle r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={thick} />
          {data.map((d, i) => {
            const len = (d.v / total) * c;
            const seg = <circle key={i} r={r} fill="none" stroke={d.c} strokeWidth={thick}
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} strokeLinecap="butt" />;
            acc += len; return seg;
          })}
        </g>
        <text x="50%" y="46%" textAnchor="middle" fill="var(--text-3)" fontSize="11" fontFamily="var(--sans)" style={{ textTransform: 'uppercase', letterSpacing: '.08em' }}>Total</text>
        <text x="50%" y="58%" textAnchor="middle" fill="var(--text)" fontSize="20" fontFamily="var(--serif)" fontWeight="600">{mxn0(total)}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, flex: 1 }}>
        {data.map((d, i) => (
          <div key={i} className="legend between">
            <span className="vc"><span className="k" style={{ background: d.c }}></span>{d.cat}</span>
            <span className="num" style={{ color: 'var(--text)', fontWeight: 600 }}>{mxn(d.v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- Card section header ---- */
function CardHead({ title, sub, right }) {
  return (
    <div className="card-head">
      <div><h3>{title}</h3>{sub && <div className="sub">{sub}</div>}</div>
      {right}
    </div>
  );
}

/* ---- Segmented control ---- */
function Seg({ opts, value, onChange }) {
  return (
    <div className="seg">
      {opts.map(o => (
        <button key={o} className={value === o ? 'active' : ''} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
}

/* ---- Switch ---- */
function Switch({ on, onClick }) {
  return <div className={'switch' + (on ? ' on' : '')} onClick={onClick}></div>;
}

/* ===== Hook reactivo: re-renderiza cuando cambia el store global ===== */
function useStore() {
  const [, force] = useState(0);
  useEffect(() => window.RBStore.subscribe(() => force(n => n + 1)), []);
  return window.RB;
}
const useVentas = useStore; // alias retrocompatible

/* Helpers de cálculo de una venta (compartidos) */
const ventaCalc = {
  subtotal: (v) => v.lineas.reduce((s, l) => s + l.precio * l.cant, 0),
  total: (v) => ventaCalc.subtotal(v) - (v.desc || 0),
  saldo: (v) => Math.max(0, ventaCalc.total(v) - (v.anticipo || 0)),
  comision: (v) => v.lineas.reduce((s, l) => s + Math.round(l.precio * l.cant * (l.com || 0) / 100), 0),
  porTipo: (v, tipo) => v.lineas.filter(l => l.tipo === tipo).reduce((s, l) => s + l.precio * l.cant, 0),
};

/* ===== Toast global (feedback de acciones) ===== */
window.RBToast = window.RBToast || {
  listeners: new Set(),
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  show(msg, icon) { this.listeners.forEach(f => f({ msg, icon: icon || 'check-circle', id: Date.now() + Math.random() })); },
};
function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => window.RBToast.subscribe(t => {
    setItems(x => [...x, t]);
    setTimeout(() => setItems(x => x.filter(i => i.id !== t.id)), 2600);
  }), []);
  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 200, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
      {items.map(t => (
        <div key={t.id} className="card gold-edge" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 18px', boxShadow: 'var(--sh-lg)', animation: 'fade .25s ease' }}>
          <span style={{ color: 'var(--gold)', display: 'inline-flex' }}><Ic n={t.icon} w="fill" /></span>
          <span style={{ fontWeight: 600, fontSize: 13.5 }}>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
const toast = (msg, icon) => window.RBToast.show(msg, icon);

Object.assign(window, { Ic, Avatar, EstadoBadge, ClienteBadge, Stat, Sparkline, BarChart, Donut, CardHead, Seg, Switch, mxn, mxn0, getEst, useStore, useVentas, ventaCalc, ToastHost, toast });

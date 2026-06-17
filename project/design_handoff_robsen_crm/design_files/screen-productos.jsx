/* ROBSEN · Productos e Inventario */
function ScreenProductos() {
  const RB = window.RB;
  window.useStore();
  const prods = RB.productos;
  const movs = RB.movimientos;
  const txs = RB.transacciones;
  const [vista, setVista] = useState('Inventario');
  const [cat, setCat] = useState('Todas');
  const [q, setQ] = useState('');
  const [editor, setEditor] = useState(null);
  const [vender, setVender] = useState(null);

  const cats = ['Todas', ...Array.from(new Set(prods.map(p => p.cat)))];
  const estadoStock = (p) => p.stock === 0 ? 'agotado' : p.stock <= p.min ? 'bajo' : 'ok';

  const lista = prods.filter(p =>
    (cat === 'Todas' || p.cat === cat) &&
    (p.nombre.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase()) || p.marca.toLowerCase().includes(q.toLowerCase())));

  // KPIs
  const valorInventario = prods.reduce((s, p) => s + p.costo * p.stock, 0);
  const bajos = prods.filter(p => estadoStock(p) === 'bajo').length;
  const agotados = prods.filter(p => estadoStock(p) === 'agotado').length;
  const ventaProductoMes = 99600;

  // Vender: descuenta stock + crea ticket/movimiento (vía store, persiste y aparece en Ventas)
  const confirmarVenta = ({ prod, cant, cliente, pago, est }) => {
    window.RBStore.venderProducto({ prod, cant, cliente, pago, est });
    setVender(null);
  };

  return (
    <div>
      <div className="between" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="display" style={{ fontSize: 26, margin: 0 }}>Productos e inventario</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{prods.length} productos · {bajos} con stock bajo · {agotados} agotado{agotados !== 1 ? 's' : ''}</div>
        </div>
        <div className="vc gap12">
          <button className="btn ghost" onClick={() => setEditor({})}><Ic n="plus" />Nuevo producto</button>
          <button className="btn gold" onClick={() => setVender({})}><Ic n="shopping-cart-simple" />Vender producto</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 18 }}>
        <div className="card card-pad"><div className="ico" style={{ width: 40, height: 40, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(200,161,74,0.10)', border: '1px solid var(--line)', color: 'var(--gold)', marginBottom: 14 }}><Ic n="package" /></div><div className="kpi-mini"><span className="l">Valor del inventario</span><span className="v">{mxn(valorInventario)}</span></div></div>
        <div className="card card-pad"><div className="ico" style={{ width: 40, height: 40, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(147,181,140,0.12)', border: '1px solid rgba(147,181,140,0.28)', color: 'var(--st-conf)', marginBottom: 14 }}><Ic n="shopping-bag" /></div><div className="kpi-mini"><span className="l">Venta producto (mes)</span><span className="v">{mxn(ventaProductoMes)}</span></div></div>
        <div className="card card-pad"><div className="ico" style={{ width: 40, height: 40, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(217,164,65,0.12)', border: '1px solid rgba(217,164,65,0.28)', color: 'var(--st-pend)', marginBottom: 14 }}><Ic n="warning" /></div><div className="kpi-mini"><span className="l">Stock bajo</span><span className="v">{bajos}</span></div></div>
        <div className="card card-pad"><div className="ico" style={{ width: 40, height: 40, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(199,123,123,0.12)', border: '1px solid rgba(199,123,123,0.28)', color: 'var(--st-canc)', marginBottom: 14 }}><Ic n="x-circle" /></div><div className="kpi-mini"><span className="l">Agotados</span><span className="v">{agotados}</span></div></div>
      </div>

      {/* Alerta de reorden */}
      {(bajos > 0 || agotados > 0) && (
        <div className="alert warn" style={{ marginBottom: 18 }}>
          <div className="ai"><Ic n="package" /></div>
          <div className="f1"><div className="at">{bajos + agotados} productos necesitan reorden</div><div className="as">{prods.filter(p => estadoStock(p) !== 'ok').map(p => p.nombre.split(' ').slice(0, 2).join(' ')).join(' · ')}</div></div>
          <button className="btn sm line" onClick={() => toast('Orden de compra generada', 'truck')}><Ic n="truck" />Generar orden de compra</button>
        </div>
      )}

      <div className="vc gap12" style={{ marginBottom: 18 }}>
        <Seg opts={['Inventario', 'Transacciones', 'Movimientos']} value={vista} onChange={setVista} />
        <div className="spacer"></div>
        {vista === 'Inventario' && <div className="search" style={{ width: 280 }}><Ic n="magnifying-glass" /><input placeholder="Buscar producto, SKU o marca…" value={q} onChange={e => setQ(e.target.value)} /></div>}
      </div>

      {/* ===== INVENTARIO ===== */}
      {vista === 'Inventario' && (
        <div className="card">
          <div className="card-pad" style={{ paddingBottom: 14 }}>
            <div className="vc gap8" style={{ flexWrap: 'wrap' }}>{cats.map(c => <button key={c} className="chip" style={cat === c ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : {}} onClick={() => setCat(c)}>{c}</button>)}</div>
          </div>
          <table className="table">
            <thead><tr><th>Producto</th><th>Uso</th><th className="num">Costo</th><th className="num">Precio</th><th className="num">Margen</th><th>Stock</th><th className="num">Vendidos</th><th></th></tr></thead>
            <tbody>{lista.map(p => {
              const est = estadoStock(p);
              const margen = p.precio ? Math.round((p.precio - p.costo) / p.precio * 100) : null;
              return (
                <tr key={p.id} onClick={() => setEditor(p)}>
                  <td><div className="cell-name"><div style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)', flex: '0 0 38px' }}><Ic n="drop" /></div><div><div className="nm">{p.nombre}</div><div className="meta">{p.marca} · {p.sku}</div></div></div></td>
                  <td>{p.uso === 'retail' ? <span className="badge pay">Reventa</span> : <span className="badge neutral">Uso interno</span>}</td>
                  <td className="num muted">{mxn(p.costo)}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{p.precio ? mxn(p.precio) : '—'}</td>
                  <td className="num" style={{ color: margen != null ? 'var(--st-conf)' : 'var(--text-4)' }}>{margen != null ? margen + '%' : '—'}</td>
                  <td>
                    <div className="vc gap10">
                      <span className="num" style={{ fontWeight: 700, minWidth: 26, color: est === 'agotado' ? 'var(--st-canc)' : est === 'bajo' ? 'var(--st-pend)' : 'var(--text)' }}>{p.stock}</span>
                      {est === 'ok' && <span className="badge conf"><span className="d"></span>En stock</span>}
                      {est === 'bajo' && <span className="badge pend"><span className="d"></span>Bajo (mín {p.min})</span>}
                      {est === 'agotado' && <span className="badge canc"><span className="d"></span>Agotado</span>}
                    </div>
                  </td>
                  <td className="num muted">{p.uso === 'retail' ? p.vendidos : '—'}</td>
                  <td><div className="vc gap6" style={{ justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                    {p.uso === 'retail' && p.stock > 0 && <button className="btn sm line" onClick={() => setVender({ prod: p })}><Ic n="shopping-cart-simple" />Vender</button>}
                    <button className="btn icon ghost sm" onClick={() => setEditor(p)}><Ic n="pencil-simple" /></button>
                  </div></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}

      {/* ===== TRANSACCIONES ===== */}
      {vista === 'Transacciones' && (
        <div className="card">
          <CardHead title="Ventas de producto" sub="Cada venta descuenta inventario y suma a finanzas" right={<span className="badge conf"><span className="d"></span>Ligado a Finanzas</span>} />
          <table className="table" style={{ marginTop: 6 }}>
            <thead><tr><th>Ticket</th><th>Fecha</th><th>Clienta</th><th>Artículos</th><th>Tipo</th><th>Pago</th><th className="num">Total</th></tr></thead>
            <tbody>{txs.map(t => {
              const e = getEst(t.est);
              return (
                <tr key={t.id} style={{ cursor: 'default' }}>
                  <td style={{ fontWeight: 700, color: 'var(--gold)' }} className="num">{t.ticket}</td>
                  <td className="muted">{t.fecha}</td>
                  <td><span className="vc" style={{ gap: 8 }}><span className="dotc" style={{ background: e.color }}></span>{t.cliente}</span></td>
                  <td className="muted">{t.items.map(i => `${i.q}× ${i.n.split(' ').slice(0, 2).join(' ')}`).join(', ')}</td>
                  <td>{t.tipo === 'mixto' ? <span className="badge done">Servicio + producto</span> : <span className="badge neutral">Producto</span>}</td>
                  <td className="muted">{t.pago}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{mxn(t.total)}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}

      {/* ===== MOVIMIENTOS (kardex) ===== */}
      {vista === 'Movimientos' && (
        <div className="card">
          <CardHead title="Movimientos de inventario" sub="Entradas, salidas por venta y consumo en servicios" />
          <table className="table" style={{ marginTop: 6 }}>
            <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th className="num">Cant.</th><th>Motivo</th></tr></thead>
            <tbody>{movs.map(m => (
              <tr key={m.id} style={{ cursor: 'default' }}>
                <td className="muted">{m.fecha}</td>
                <td style={{ fontWeight: 600 }}>{m.prod}</td>
                <td>
                  {m.tipo === 'entrada' && <span className="badge conf"><Ic n="arrow-down" />Entrada</span>}
                  {m.tipo === 'salida' && <span className="badge pay"><Ic n="arrow-up" />Venta</span>}
                  {m.tipo === 'consumo' && <span className="badge done"><Ic n="scissors" />Consumo</span>}
                </td>
                <td className="num" style={{ fontWeight: 700, color: m.tipo === 'entrada' ? 'var(--st-conf)' : 'var(--st-canc)' }}>{m.tipo === 'entrada' ? '+' : '−'}{m.cant}</td>
                <td className="muted">{m.motivo}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {editor && <ProductoEditor p={editor} marcas={RB.marcas} onClose={() => setEditor(null)} />}
      {vender && <VenderModal prod={vender.prod} prods={prods.filter(p => p.uso === 'retail' && p.stock > 0)} clientas={RB.clientas} onClose={() => setVender(null)} onConfirm={confirmarVenta} />}
    </div>
  );
}

function ProductoEditor({ p, marcas, onClose }) {
  const nuevo = !p.id;
  const [nombre, setNombre] = useState(p.nombre || '');
  const [marca, setMarca] = useState(p.marca || marcas[0]);
  const [sku, setSku] = useState(p.sku || '');
  const [cat, setCat] = useState(p.cat || 'Cuidado');
  const [retail, setRetail] = useState(p.uso ? p.uso === 'retail' : true);
  const [costo, setCosto] = useState(p.costo || '');
  const [precio, setPrecio] = useState(p.precio || '');
  const [stock, setStock] = useState(p.stock ?? '');
  const [min, setMin] = useState(p.min ?? '');
  const guardar = () => {
    if (!nombre.trim()) return;
    window.RBStore.upsertProducto({
      ...(p.id ? { id: p.id } : {}), nombre: nombre.trim(), marca, sku: sku || nombre.slice(0, 6).toUpperCase(),
      cat, uso: retail ? 'retail' : 'interno', costo: +costo || 0, precio: retail ? (+precio || 0) : 0,
      stock: +stock || 0, min: +min || 0,
    });
    onClose();
  };
  const eliminar = () => { window.RBStore.removeProducto(p.id); onClose(); };
  return (
    <div className="rb-modal-bg" onClick={onClose}>
      <div className="card gold-edge rb-modal" onClick={e => e.stopPropagation()} style={{ width: 540, maxWidth: '94vw' }}>
        <div className="card-head"><div><div className="eyebrow">{nuevo ? 'Crear' : 'Editar'} producto</div><h3 style={{ marginTop: 6 }}>{nuevo ? 'Nuevo producto' : p.nombre}</h3></div><button className="icon-btn" onClick={onClose}><Ic n="x" /></button></div>
        <div className="card-pad scroll-y" style={{ paddingTop: 16, maxHeight: '64vh', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field"><label>Nombre del producto</label><input className="input" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Olaplex N°3" /></div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="field"><label>Marca</label><select className="select" value={marca} onChange={e => setMarca(e.target.value)}>{marcas.map(m => <option key={m}>{m}</option>)}</select></div>
            <div className="field"><label>SKU</label><input className="input" value={sku} onChange={e => setSku(e.target.value)} placeholder="OLA-N3" /></div>
          </div>
          <div className="card" style={{ background: 'var(--surface)', padding: 16 }}>
            <div className="between"><div><div style={{ fontWeight: 600, fontSize: 13.5 }}>Disponible para reventa</div><div className="dim" style={{ fontSize: 12 }}>Si se apaga, es de uso interno (consumo en servicios).</div></div><Switch on={retail} onClick={() => setRetail(v => !v)} /></div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="field"><label>Costo de compra (MXN)</label><input className="input num" type="number" value={costo} onChange={e => setCosto(e.target.value)} /></div>
            <div className="field"><label>Precio de venta (MXN)</label><input className="input num" type="number" value={retail ? precio : ''} onChange={e => setPrecio(e.target.value)} disabled={!retail} placeholder={retail ? '0' : 'Uso interno'} /></div>
            <div className="field"><label>Stock actual</label><input className="input num" type="number" value={stock} onChange={e => setStock(e.target.value)} /></div>
            <div className="field"><label>Stock mínimo (reorden)</label><input className="input num" type="number" value={min} onChange={e => setMin(e.target.value)} /></div>
          </div>
        </div>
        <hr className="hr" />
        <div className="card-pad vc gap12" style={{ justifyContent: 'flex-end' }}>
          {!nuevo && <button className="btn ghost" style={{ color: 'var(--st-canc)', marginRight: 'auto' }} onClick={eliminar}><Ic n="trash" />Eliminar</button>}
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn gold" onClick={guardar} style={{ opacity: nombre.trim() ? 1 : .4, pointerEvents: nombre.trim() ? 'auto' : 'none' }}><Ic n="check" />Guardar producto</button>
        </div>
      </div>
    </div>
  );
}

function VenderModal({ prod, prods, clientas, onClose, onConfirm }) {
  const [sel, setSel] = useState(prod || prods[0]);
  const [cant, setCant] = useState(1);
  const [cliente, setCliente] = useState('');
  const [pago, setPago] = useState('Tarjeta');
  const [est, setEst] = useState('');
  const total = sel ? sel.precio * cant : 0;
  return (
    <div className="rb-modal-bg" onClick={onClose}>
      <div className="card gold-edge rb-modal" onClick={e => e.stopPropagation()} style={{ width: 480, maxWidth: '94vw' }}>
        <div className="card-head"><div><div className="eyebrow">Punto de venta</div><h3 style={{ marginTop: 6 }}>Vender producto</h3></div><button className="icon-btn" onClick={onClose}><Ic n="x" /></button></div>
        <div className="card-pad" style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field"><label>Producto</label>
            <select className="select" value={sel ? sel.id : ''} onChange={e => setSel(prods.find(p => p.id === e.target.value))}>
              {prods.map(p => <option key={p.id} value={p.id}>{p.nombre} — {mxn(p.precio)} ({p.stock} en stock)</option>)}
            </select>
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="field"><label>Cantidad</label>
              <div className="vc gap8">
                <button className="btn icon ghost" onClick={() => setCant(c => Math.max(1, c - 1))}><Ic n="minus" /></button>
                <input className="input num" value={cant} onChange={e => setCant(Math.max(1, Math.min(sel ? sel.stock : 1, +e.target.value || 1)))} style={{ textAlign: 'center' }} />
                <button className="btn icon ghost" onClick={() => setCant(c => Math.min(sel ? sel.stock : 1, c + 1))}><Ic n="plus" /></button>
              </div>
            </div>
            <div className="field"><label>Forma de pago</label><select className="select" value={pago} onChange={e => setPago(e.target.value)}><option>Tarjeta</option><option>Efectivo</option><option>Transferencia</option></select></div>
          </div>
          <div className="field"><label>Clienta (opcional)</label>
            <select className="select" value={cliente} onChange={e => setCliente(e.target.value)}>
              <option value="">Venta de mostrador</option>
              {clientas.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="field"><label>Vendido por (comisión)</label>
            <select className="select" value={est} onChange={e => setEst(e.target.value)}>
              <option value="">Sin asignar</option>
              {window.RB.estilistas.map(es => <option key={es.id} value={es.id}>{es.nombre}</option>)}
            </select>
          </div>
          <div className="card" style={{ background: 'var(--surface)', padding: 16 }}>
            <div className="between"><span className="muted">Stock después de la venta</span><span className="num" style={{ fontWeight: 600 }}>{sel ? sel.stock - cant : 0} unidades</span></div>
            <hr className="hr" style={{ margin: '12px 0' }} />
            <div className="between"><span style={{ fontWeight: 600 }}>Total a cobrar</span><span className="num gold-text" style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600 }}>{mxn(total)}</span></div>
          </div>
        </div>
        <hr className="hr" />
        <div className="card-pad vc gap12" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn gold" onClick={() => onConfirm({ prod: sel, cant, cliente, pago, est })}><Ic n="check" />Cobrar {mxn(total)}</button>
        </div>
      </div>
    </div>
  );
}
window.ScreenProductos = ScreenProductos;

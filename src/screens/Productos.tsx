import React, { useState, useMemo } from 'react'
import { Avatar, Seg, Switch, CardHead, toast, Modal } from '../components/ui'
import { PhosphorIcon as Ic } from '../components/PhosphorIcon'
import { useStore } from '../data/store'
import { mxn, ventaCalc } from '../lib/helpers'
import type { Producto, Estilista } from '../types'

export function ScreenProductos({ onNavigate }: { onNavigate: (r: string) => void }) {
  const [tab, setTab] = useState('Inventario')
  const [catFiltro, setCatFiltro] = useState('Todos')
  const [editor, setEditor] = useState<Partial<Producto> | null>(null)
  const [vender, setVender] = useState<Producto | null>(null)
  const [ajuste, setAjuste] = useState<Producto | null>(null)
  const [ordenCompra, setOrdenCompra] = useState<Producto | null>(null)

  const { data, upsertProducto, deleteProducto, venderProducto, ajustarStock } = useStore()
  const { productos, movimientos, transacciones, clientas, estilistas, marcas } = data

  // KPIs
  const valorInventario = productos.reduce((s, p) => s + p.stock * p.costo, 0)
  const ventasMes = useMemo(() =>
    data.ventas.reduce((s, v) => s + ventaCalc.porTipo(v, 'producto'), 0),
  [data.ventas])
  const bajos = productos.filter(p => p.stock > 0 && p.stock <= p.min)
  const agotados = productos.filter(p => p.stock === 0)

  // Inventario tab: category filter
  const rawCats = Array.from(new Set(productos.map(p => p.cat)))
  const cats = ['Todos', ...rawCats]
  const listaFiltrada = catFiltro === 'Todos' ? productos : productos.filter(p => p.cat === catFiltro)

  return (
    <div>
      {/* Header */}
      <div className="between" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="display" style={{ fontSize: 26, margin: 0 }}>Productos</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            {productos.length} productos · {marcas.length} marcas · {productos.reduce((s, p) => s + p.stock, 0)} unidades · ventas de productos: {mxn(ventasMes)}
          </div>
        </div>
        <div className="vc gap10">
          <button className="btn ghost" onClick={() => setOrdenCompra(productos[0] || null)}>
            <Ic n="shopping-cart-simple" />Orden de compra
          </button>
          <button className="btn ghost" onClick={() => setAjuste(productos[0] || null)}>
            <Ic n="arrows-down-up" />Entrada de stock
          </button>
          <button className="btn ghost" onClick={() => setEditor({})}>
            <Ic n="plus" />Nuevo producto
          </button>
          <button className="btn gold" onClick={() => {
            if (productos.length > 0) setVender(productos[0])
          }}>
            <Ic n="shopping-cart" />Vender producto
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 18 }}>
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="vc gap10" style={{ color: 'var(--gold)', marginBottom: 4 }}>
            <Ic n="package" />
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>Valor inventario</span>
          </div>
          <div className="num gold-text" style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 700 }}>{mxn(valorInventario)}</div>
          <div className="muted" style={{ fontSize: 11.5 }}>Costo total en stock</div>
        </div>
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="vc gap10" style={{ color: 'var(--st-conf)', marginBottom: 4 }}>
            <Ic n="chart-line-up" />
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>Ventas de productos</span>
          </div>
          <div className="num" style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 700 }}>{mxn(ventasMes)}</div>
          <div className="muted" style={{ fontSize: 11.5 }}>Registradas en el sistema</div>
        </div>
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="vc gap10" style={{ color: 'var(--st-pend)', marginBottom: 4 }}>
            <Ic n="warning" />
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>Stock bajo</span>
          </div>
          <div className="num" style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 700, color: 'var(--st-pend)' }}>{bajos.length}</div>
          <div className="muted" style={{ fontSize: 11.5 }}>Bajo mínimo requerido</div>
        </div>
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="vc gap10" style={{ color: 'var(--neg)', marginBottom: 4 }}>
            <Ic n="x-circle" />
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>Agotados</span>
          </div>
          <div className="num" style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 700, color: 'var(--neg)' }}>{agotados.length}</div>
          <div className="muted" style={{ fontSize: 11.5 }}>Sin existencias</div>
        </div>
      </div>

      {/* Reorder alert */}
      {(bajos.length > 0 || agotados.length > 0) && (
        <div className="alert warn" style={{ marginBottom: 18 }}>
          <div className="ai"><Ic n="warning" /></div>
          <div className="f1">
            <div className="at">
              {agotados.length > 0 && `${agotados.length} producto${agotados.length !== 1 ? 's' : ''} agotado${agotados.length !== 1 ? 's' : ''}`}
              {agotados.length > 0 && bajos.length > 0 && ' · '}
              {bajos.length > 0 && `${bajos.length} con stock bajo mínimo`}
            </div>
            <div className="as">
              {[...agotados, ...bajos].slice(0, 4).map(p => p.nombre).join(', ')}
              {agotados.length + bajos.length > 4 ? ` y ${agotados.length + bajos.length - 4} más.` : '.'}
            </div>
          </div>
          <button className="btn sm line" onClick={() => {
            const lista = [...agotados, ...bajos]
            const fecha = new Date().toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' })
            const lineas = lista.map(p =>
              `${p.nombre.padEnd(35)} Stock: ${p.stock}  Mínimo: ${p.min}  Pedir: ${Math.max(p.min * 2 - p.stock, 1)} uds.  Costo: ${mxn(p.costo)}`
            )
            const texto = [`LISTA DE PEDIDO — ${data.config.nombre}`, `Generada: ${fecha}`, ``, ...lineas].join('\n')
            const a = document.createElement('a')
            a.href = URL.createObjectURL(new Blob([texto], { type: 'text/plain' }))
            a.download = `pedido-${fecha.replace(/\s/g,'-')}.txt`
            a.click()
            toast(`Lista descargada · ${lista.length} producto${lista.length !== 1 ? 's' : ''}`)
          }}>
            Generar pedido
          </button>
        </div>
      )}

      {/* Seg tabs */}
      <div style={{ marginBottom: 18 }}>
        <Seg opts={['Inventario', 'Transacciones', 'Movimientos']} value={tab} onChange={setTab} />
      </div>

      {/* Inventario tab */}
      {tab === 'Inventario' && (
        <div className="card">
          <CardHead
            title="Inventario"
            sub={`${listaFiltrada.length} productos`}
            right={
              <div className="vc gap8" style={{ flexWrap: 'wrap' }}>
                {cats.map(c => (
                  <button
                    key={c}
                    className="chip"
                    style={catFiltro === c ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : {}}
                    onClick={() => setCatFiltro(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            }
          />
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>SKU</th>
                  <th>Marca</th>
                  <th>Categoría</th>
                  <th>Uso</th>
                  <th style={{ textAlign: 'right' }}>Costo</th>
                  <th style={{ textAlign: 'right' }}>Precio</th>
                  <th style={{ textAlign: 'center' }}>Stock</th>
                  <th style={{ textAlign: 'center' }}>Vendidos</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map(p => {
                  const stockBajo = p.stock > 0 && p.stock <= p.min
                  const agotado = p.stock === 0
                  return (
                    <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setEditor(p)}>
                      <td style={{ fontWeight: 600 }}>{p.nombre}</td>
                      <td className="muted" style={{ fontSize: 12 }}>{p.sku}</td>
                      <td>{p.marca}</td>
                      <td><span className="badge neutral">{p.cat}</span></td>
                      <td>
                        <span className={`badge ${p.uso === 'retail' ? 'conf' : 'neutral'}`}>
                          {p.uso === 'retail' ? 'Retail' : 'Interno'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }} className="muted">{mxn(p.costo)}</td>
                      <td style={{ textAlign: 'right' }} className="num gold-text">{mxn(p.precio)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className={`badge ${agotado ? 'bad' : stockBajo ? 'pend' : 'neutral'}`}
                          style={{ fontWeight: 700 }}
                        >
                          {p.stock}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }} className="muted">{p.vendidos}</td>
                      <td>
                        <div className="vc gap6">
                          <button className="btn sm ghost" onClick={e => { e.stopPropagation(); setAjuste(p) }} title="Entrada de stock">
                            <Ic n="arrows-down-up" size={14} />
                          </button>
                          <button className="btn sm ghost" onClick={e => { e.stopPropagation(); setOrdenCompra(p) }} title="Orden de compra">
                            <Ic n="shopping-cart-simple" size={14} />
                          </button>
                          <button className="btn sm ghost" onClick={e => { e.stopPropagation(); setVender(p) }}>
                            <Ic n="shopping-cart" size={14} />Vender
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transacciones tab */}
      {tab === 'Transacciones' && (
        <div className="card">
          <CardHead title="Transacciones de productos" sub={`${transacciones.length} registros`} />
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Estilista</th>
                  <th>Productos</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th>Pago</th>
                  <th>Tipo</th>
                </tr>
              </thead>
              <tbody>
                {transacciones.map(tx => {
                  const est = estilistas.find(e => e.id === tx.est)
                  return (
                    <tr key={tx.id}>
                      <td className="num" style={{ fontWeight: 600 }}>{tx.ticket}</td>
                      <td className="muted" style={{ fontSize: 12 }}>{tx.fecha}</td>
                      <td>{tx.cliente}</td>
                      <td>
                        <div className="vc gap8">
                          {est && <span className="dotc" style={{ background: est.color }} />}
                          <span style={{ fontSize: 13 }}>{est?.nombre ?? tx.est}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 12.5 }}>
                        {tx.items.map((it, i) => (
                          <span key={i}>
                            {it.n} ×{it.q}{i < tx.items.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </td>
                      <td style={{ textAlign: 'right' }} className="num gold-text">{mxn(tx.total)}</td>
                      <td><span className="badge neutral">{tx.pago}</span></td>
                      <td>
                        <span className={`badge ${tx.tipo === 'mixto' ? 'conf' : 'neutral'}`}>
                          {tx.tipo === 'mixto' ? 'Mixto' : 'Producto'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Movimientos tab */}
      {tab === 'Movimientos' && (
        <div className="card">
          <CardHead title="Kardex · Movimientos de inventario" sub={`${movimientos.length} movimientos`} />
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Tipo</th>
                  <th style={{ textAlign: 'center' }}>Cantidad</th>
                  <th>Motivo</th>
                  <th>Referencia</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map(m => (
                  <tr key={m.id}>
                    <td className="muted" style={{ fontSize: 12 }}>{m.fecha}</td>
                    <td style={{ fontWeight: 600 }}>{m.prod}</td>
                    <td>
                      <span
                        className={`badge ${m.tipo === 'entrada' ? 'conf' : m.tipo === 'consumo' ? 'pend' : 'bad'}`}
                      >
                        {m.tipo === 'entrada' ? 'Entrada' : m.tipo === 'consumo' ? 'Consumo' : 'Salida'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className="num"
                        style={{
                          color: m.tipo === 'entrada' ? 'var(--pos)' : 'var(--neg)',
                          fontWeight: 700,
                        }}
                      >
                        {m.tipo === 'entrada' ? '+' : '-'}{m.cant}
                      </span>
                    </td>
                    <td className="muted" style={{ fontSize: 13 }}>{m.motivo}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{m.ref}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {editor !== null && (
        <ProductoEditor
          p={editor}
          marcas={marcas}
          cats={rawCats}
          onSave={prod => {
            upsertProducto(prod)
            toast('Producto guardado')
            setEditor(null)
          }}
          onDelete={id => {
            deleteProducto(id)
            toast('Producto eliminado')
            setEditor(null)
          }}
          onClose={() => setEditor(null)}
        />
      )}

      {ajuste !== null && (
        <AjusteStockModal
          productos={productos}
          sel={ajuste}
          onConfirm={(prodId, cant, motivo) => {
            ajustarStock(prodId, cant, motivo)
            toast(`Stock actualizado · ${cant > 0 ? '+' : ''}${cant} unidades`)
            setAjuste(null)
          }}
          onClose={() => setAjuste(null)}
        />
      )}

      {ordenCompra !== null && (
        <OrdenCompraModal
          productos={productos}
          sel={ordenCompra}
          onRecibido={(prod, cant) => {
            ajustarStock(prod.id, cant, 'Compra a proveedor')
            toast(`Stock actualizado · +${cant} unidades de ${prod.nombre}`)
            setOrdenCompra(null)
          }}
          onClose={() => setOrdenCompra(null)}
        />
      )}

      {vender !== null && (
        <VenderModal
          productos={productos}
          sel={vender}
          estilistas={estilistas}
          clientas={clientas.map(c => c.nombre)}
          onConfirm={(prod, cant, cliente, pago, est) => {
            venderProducto(prod.id, cant, cliente || 'Mostrador', pago, est || null)
            toast(`Venta registrada · ${mxn(prod.precio * cant)}`)
            setVender(null)
          }}
          onClose={() => setVender(null)}
        />
      )}
    </div>
  )
}

// ─── ProductoEditor ──────────────────────────────────────────────────────────

interface ProductoEditorProps {
  p: Partial<Producto>
  marcas: string[]
  cats: string[]
  onSave: (prod: Partial<Producto> & { id: string }) => void
  onDelete: (id: string) => void
  onClose: () => void
}

function ProductoEditor({ p, marcas, cats, onSave, onDelete, onClose }: ProductoEditorProps) {
  const nuevo = !p.id
  const [nombre, setNombre] = useState(p.nombre ?? '')
  const [sku, setSku] = useState(p.sku ?? '')
  const [marca, setMarca] = useState(p.marca ?? (marcas[0] ?? ''))
  const [cat, setCat] = useState(p.cat ?? (cats[0] ?? ''))
  const [catInput, setCatInput] = useState('')
  const [uso, setUso] = useState<'retail' | 'interno'>(p.uso ?? 'retail')
  const [costo, setCosto] = useState(p.costo ?? 0)
  const [precio, setPrecio] = useState(p.precio ?? 0)
  const [stock, setStock] = useState(p.stock ?? 0)
  const [min, setMin] = useState(p.min ?? 3)

  const handleSave = () => {
    if (!nombre.trim()) { toast('El nombre es requerido'); return }
    onSave({
      id: p.id ?? ('p' + Date.now()),
      nombre: nombre.trim(),
      sku: sku.trim(),
      marca,
      cat: cat || catInput.trim() || 'General',
      uso,
      costo,
      precio,
      stock,
      min,
      vendidos: p.vendidos ?? 0,
    })
  }

  return (
    <Modal onClose={onClose} width={540}>
      <div style={{ borderTop: '3px solid var(--gold)', borderRadius: 'var(--radius) var(--radius) 0 0' }}>
        {/* Header */}
        <div className="between card-pad" style={{ borderBottom: '1px solid var(--line-soft)', paddingBottom: 16 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>
              {nuevo ? 'Nuevo producto' : 'Editar producto'}
            </div>
            <h3 className="serif" style={{ margin: 0, fontSize: 20 }}>
              {nuevo ? 'Agregar producto' : nombre}
            </h3>
          </div>
          <button className="btn ghost icon-btn" onClick={onClose} style={{ padding: '6px 8px' }}>
            <Ic n="x" />
          </button>
        </div>

        {/* Body */}
        <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Nombre + SKU */}
          <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: 14 }}>
            <div>
              <label className="label">Nombre del producto</label>
              <input
                className="input"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej. Shampoo reparador"
              />
            </div>
            <div>
              <label className="label">SKU</label>
              <input
                className="input"
                value={sku}
                onChange={e => setSku(e.target.value)}
                placeholder="ABC-001"
              />
            </div>
          </div>

          {/* Marca + Cat */}
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label className="label">Marca</label>
              <select className="input" value={marca} onChange={e => setMarca(e.target.value)}>
                {marcas.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Categoría</label>
              <select className="input" value={cat} onChange={e => setCat(e.target.value)}>
                {cats.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="">+ Nueva categoría</option>
              </select>
              {cat === '' && (
                <input
                  className="input mt8"
                  value={catInput}
                  onChange={e => setCatInput(e.target.value)}
                  placeholder="Nueva categoría"
                />
              )}
            </div>
          </div>

          {/* Uso */}
          <div>
            <label className="label" style={{ marginBottom: 10 }}>Uso</label>
            <div className="vc gap10">
              {(['retail', 'interno'] as const).map(u => (
                <button
                  key={u}
                  className="chip"
                  style={uso === u ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : {}}
                  onClick={() => setUso(u)}
                >
                  {u === 'retail' ? 'Retail (venta)' : 'Uso interno'}
                </button>
              ))}
            </div>
          </div>

          {/* Costo + Precio */}
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label className="label">Costo</label>
              <input
                className="input"
                type="number"
                min={0}
                value={costo}
                onChange={e => setCosto(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label">Precio de venta</label>
              <input
                className="input"
                type="number"
                min={0}
                value={precio}
                onChange={e => setPrecio(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Stock + Mínimo */}
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label className="label">Stock actual</label>
              <input
                className="input"
                type="number"
                min={0}
                value={stock}
                onChange={e => setStock(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label">Stock mínimo</label>
              <input
                className="input"
                type="number"
                min={0}
                value={min}
                onChange={e => setMin(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Margen */}
          {costo > 0 && precio > 0 && (
            <div className="card card-pad" style={{ background: 'var(--surface-2)' }}>
              <div className="vc gap24" style={{ fontSize: 13 }}>
                <div>
                  <span className="muted">Margen: </span>
                  <span className="num" style={{ color: 'var(--pos)', fontWeight: 700 }}>
                    {Math.round(((precio - costo) / precio) * 100)}%
                  </span>
                </div>
                <div>
                  <span className="muted">Utilidad por pieza: </span>
                  <span className="num gold-text" style={{ fontWeight: 700 }}>{mxn(precio - costo)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="between card-pad" style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 16 }}>
          <div>
            {!nuevo && (
              <button
                className="btn danger"
                onClick={() => p.id && onDelete(p.id)}
              >
                <Ic n="trash" />Eliminar
              </button>
            )}
          </div>
          <div className="vc gap10">
            <button className="btn ghost" onClick={onClose}>Cancelar</button>
            <button className="btn gold" onClick={handleSave}>
              <Ic n="check" />Guardar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── VenderModal ─────────────────────────────────────────────────────────────

interface VenderModalProps {
  productos: Producto[]
  sel: Producto
  estilistas: Estilista[]
  clientas: string[]
  onConfirm: (prod: Producto, cant: number, cliente: string, pago: string, est: string) => void
  onClose: () => void
}

function VenderModal({ productos, sel: initialSel, estilistas, clientas, onConfirm, onClose }: VenderModalProps) {
  const { data: storeData } = useStore()
  const mp = storeData.config?.metodospago
  const metodosPago = [
    mp?.efectivo && 'Efectivo',
    mp?.tarjeta && 'Tarjeta',
    mp?.transferencia && 'Transferencia',
    mp?.credito && 'Crédito',
  ].filter(Boolean) as string[]

  const [sel, setSel] = useState<Producto>(initialSel)
  const [cant, setCant] = useState(1)
  const [cliente, setCliente] = useState('')
  const [pago, setPago] = useState(metodosPago[0] || 'Efectivo')
  const [est, setEst] = useState('')

  const total = sel.precio * cant
  const stockOk = cant >= 1 && cant <= sel.stock

  return (
    <Modal onClose={onClose} width={480}>
      <div style={{ borderTop: '3px solid var(--gold)', borderRadius: 'var(--radius) var(--radius) 0 0' }}>
        {/* Header */}
        <div className="between card-pad" style={{ borderBottom: '1px solid var(--line-soft)', paddingBottom: 16 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Registrar venta</div>
            <h3 className="serif" style={{ margin: 0, fontSize: 20 }}>Vender producto</h3>
          </div>
          <button className="btn ghost icon-btn" onClick={onClose} style={{ padding: '6px 8px' }}>
            <Ic n="x" />
          </button>
        </div>

        {/* Body */}
        <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Producto selector */}
          <div>
            <label className="label">Producto</label>
            <select
              className="input"
              value={sel.id}
              onChange={e => {
                const found = productos.find(p => p.id === e.target.value)
                if (found) { setSel(found); setCant(1) }
              }}
            >
              {productos.map(p => (
                <option key={p.id} value={p.id} disabled={p.stock === 0}>
                  {p.nombre} — {mxn(p.precio)} {p.stock === 0 ? '(Agotado)' : `(${p.stock} en stock)`}
                </option>
              ))}
            </select>
          </div>

          {/* Producto info */}
          <div className="card card-pad" style={{ background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="between">
              <span style={{ fontWeight: 600 }}>{sel.nombre}</span>
              <span className="badge neutral">{sel.marca}</span>
            </div>
            <div className="vc gap16" style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
              <span>SKU: {sel.sku}</span>
              <span>Stock: <b style={{ color: sel.stock === 0 ? 'var(--neg)' : sel.stock <= sel.min ? 'var(--st-pend)' : 'var(--pos)' }}>{sel.stock}</b></span>
              <span className="gold-text num" style={{ fontWeight: 700 }}>{mxn(sel.precio)}</span>
            </div>
          </div>

          {/* Cantidad */}
          <div>
            <label className="label">Cantidad</label>
            <div className="vc gap10">
              <button
                className="btn ghost"
                style={{ padding: '6px 12px' }}
                onClick={() => setCant(c => Math.max(1, c - 1))}
              >
                <Ic n="x" size={14} />
              </button>
              <input
                className="input"
                type="number"
                min={1}
                max={sel.stock}
                value={cant}
                onChange={e => setCant(Math.max(1, Math.min(sel.stock, Number(e.target.value))))}
                style={{ width: 80, textAlign: 'center' }}
              />
              <button
                className="btn ghost"
                style={{ padding: '6px 12px' }}
                onClick={() => setCant(c => Math.min(sel.stock, c + 1))}
              >
                <Ic n="plus" size={14} />
              </button>
              <span className="muted" style={{ fontSize: 12.5 }}>máx {sel.stock}</span>
            </div>
          </div>

          {/* Cliente */}
          <div>
            <label className="label">Cliente (opcional)</label>
            <input
              className="input"
              list="clientas-list"
              value={cliente}
              onChange={e => setCliente(e.target.value)}
              placeholder="Mostrador"
            />
            <datalist id="clientas-list">
              {clientas.map((c, i) => <option key={i} value={c} />)}
            </datalist>
          </div>

          {/* Estilista */}
          <div>
            <label className="label">Estilista (opcional)</label>
            <select className="input" value={est} onChange={e => setEst(e.target.value)}>
              <option value="">Sin asignar</option>
              {estilistas.map(e => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          </div>

          {/* Método de pago */}
          <div>
            <label className="label" style={{ marginBottom: 10 }}>Método de pago</label>
            <div className="vc gap8" style={{ flexWrap: 'wrap' }}>
              {metodosPago.map(m => (
                <button
                  key={m}
                  className="chip"
                  style={pago === m ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : {}}
                  onClick={() => setPago(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="card card-pad" style={{ background: 'var(--surface-2)' }}>
            <div className="between">
              <span style={{ fontWeight: 600, fontSize: 14 }}>Total a cobrar</span>
              <span className="num gold-text" style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 700 }}>
                {mxn(total)}
              </span>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {cant} × {mxn(sel.precio)} · {pago}
            </div>
          </div>

          {!stockOk && cant > sel.stock && (
            <div className="alert bad">
              <div className="ai"><Ic n="warning" /></div>
              <div className="f1">
                <div className="at">Stock insuficiente</div>
                <div className="as">Solo hay {sel.stock} unidades disponibles.</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="between card-pad" style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button
            className="btn gold"
            disabled={!stockOk || sel.stock === 0}
            onClick={() => onConfirm(sel, cant, cliente || 'Mostrador', pago, est)}
          >
            <Ic n="check" />Confirmar venta · {mxn(total)}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── OrdenCompraModal ────────────────────────────────────────────────────────

interface OrdenCompraProps {
  productos: Producto[]
  sel: Producto
  onRecibido: (prod: Producto, cant: number) => void
  onClose: () => void
}

function OrdenCompraModal({ productos, sel: initialSel, onRecibido, onClose }: OrdenCompraProps) {
  const [sel, setSel] = useState<Producto>(initialSel)
  const [proveedor, setProveedor] = useState('')
  const [cant, setCant] = useState(Math.max(1, sel.min * 2 - sel.stock))
  const [precioUnit, setPrecioUnit] = useState(sel.costo)
  const [recibido, setRecibido] = useState(false)

  const total = cant * precioUnit

  return (
    <Modal onClose={onClose} width={500}>
      <div style={{ borderTop: '3px solid var(--gold)', borderRadius: 'var(--radius) var(--radius) 0 0' }}>
        <div className="between card-pad" style={{ borderBottom: '1px solid var(--line-soft)', paddingBottom: 16 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Compras</div>
            <h3 className="serif" style={{ margin: 0, fontSize: 20 }}>Orden de compra</h3>
          </div>
          <button className="btn ghost icon-btn" onClick={onClose} style={{ padding: '6px 8px' }}><Ic n="x" /></button>
        </div>
        <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field">
            <label className="label">Producto</label>
            <select className="input" value={sel.id} onChange={e => {
              const found = productos.find(p => p.id === e.target.value)
              if (found) { setSel(found); setCant(Math.max(1, found.min * 2 - found.stock)); setPrecioUnit(found.costo) }
            }}>
              {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} (stock: {p.stock})</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Proveedor</label>
            <input className="input" value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="Nombre del proveedor…" />
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="field">
              <label className="label">Cantidad a pedir</label>
              <input className="input" type="number" min={1} value={cant} onChange={e => setCant(Math.max(1, Number(e.target.value)))} />
            </div>
            <div className="field">
              <label className="label">Precio unitario</label>
              <input className="input" type="number" min={0} value={precioUnit} onChange={e => setPrecioUnit(Number(e.target.value))} />
            </div>
          </div>
          <div className="card card-pad" style={{ background: 'var(--surface-2)' }}>
            <div className="between">
              <span style={{ fontWeight: 600 }}>Total estimado</span>
              <span className="num gold-text" style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700 }}>{mxn(total)}</span>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {cant} × {mxn(precioUnit)} · Stock actual: {sel.stock} → {sel.stock + cant}
            </div>
          </div>
          <label className="vc gap10" style={{ cursor: 'pointer', fontSize: 13.5 }}>
            <input type="checkbox" checked={recibido} onChange={e => setRecibido(e.target.checked)} />
            Marcar como recibido (actualiza stock inmediatamente)
          </label>
        </div>
        <div className="between card-pad" style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <div className="vc gap10">
            {!recibido && (
              <button className="btn ghost" onClick={() => {
                const txt = `ORDEN DE COMPRA\nProducto: ${sel.nombre}\nProveedor: ${proveedor || '—'}\nCantidad: ${cant}\nPrecio unit.: ${mxn(precioUnit)}\nTotal: ${mxn(total)}\nFecha: ${new Date().toLocaleDateString('es-MX')}`
                navigator.clipboard?.writeText(txt).then(() => toast('Orden copiada al portapapeles'))
              }}>
                <Ic n="copy" />Copiar orden
              </button>
            )}
            <button className="btn gold" disabled={!recibido} style={{ opacity: recibido ? 1 : .5 }} onClick={() => recibido && onRecibido(sel, cant)}>
              <Ic n="check" />Recibir pedido
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── AjusteStockModal ────────────────────────────────────────────────────────

const MOTIVOS_ENTRADA = ['Compra a proveedor', 'Devolución de cliente', 'Ajuste de inventario', 'Muestra / regalo']
const MOTIVOS_SALIDA  = ['Consumo interno', 'Merma / caducidad', 'Ajuste de inventario']

interface AjusteStockModalProps {
  productos: Producto[]
  sel: Producto
  onConfirm: (productoId: string, cant: number, motivo: string) => void
  onClose: () => void
}

function AjusteStockModal({ productos, sel: initialSel, onConfirm, onClose }: AjusteStockModalProps) {
  const [sel, setSel] = useState<Producto>(initialSel)
  const [tipo, setTipo] = useState<'entrada' | 'salida'>('entrada')
  const [cant, setCant] = useState(1)
  const [motivo, setMotivo] = useState(MOTIVOS_ENTRADA[0])
  const motivos = tipo === 'entrada' ? MOTIVOS_ENTRADA : MOTIVOS_SALIDA
  const stockResultante = tipo === 'entrada' ? sel.stock + cant : Math.max(0, sel.stock - cant)

  const handleTipo = (t: 'entrada' | 'salida') => {
    setTipo(t)
    setMotivo(t === 'entrada' ? MOTIVOS_ENTRADA[0] : MOTIVOS_SALIDA[0])
    setCant(1)
  }

  return (
    <Modal onClose={onClose} width={480}>
      <div style={{ borderTop: '3px solid var(--gold)', borderRadius: 'var(--radius) var(--radius) 0 0' }}>
        <div className="between card-pad" style={{ borderBottom: '1px solid var(--line-soft)', paddingBottom: 16 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Inventario</div>
            <h3 className="serif" style={{ margin: 0, fontSize: 20 }}>Ajuste de stock</h3>
          </div>
          <button className="btn ghost icon-btn" onClick={onClose} style={{ padding: '6px 8px' }}><Ic n="x" /></button>
        </div>

        <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="label">Producto</label>
            <select className="input" value={sel.id} onChange={e => {
              const found = productos.find(p => p.id === e.target.value)
              if (found) { setSel(found); setCant(1) }
            }}>
              {productos.map(p => (
                <option key={p.id} value={p.id}>{p.nombre} (stock: {p.stock})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" style={{ marginBottom: 10 }}>Tipo de movimiento</label>
            <div className="vc gap8">
              {(['entrada', 'salida'] as const).map(t => (
                <button
                  key={t}
                  className="chip"
                  style={tipo === t ? { borderColor: t === 'entrada' ? 'var(--st-conf)' : 'var(--st-canc)', color: t === 'entrada' ? 'var(--st-conf)' : 'var(--st-canc)' } : {}}
                  onClick={() => handleTipo(t)}
                >
                  {t === 'entrada' ? '↓ Entrada' : '↑ Salida'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Cantidad</label>
            <div className="vc gap10">
              <button className="btn ghost" style={{ padding: '6px 12px' }} onClick={() => setCant(c => Math.max(1, c - 1))}>
                <Ic n="minus" size={14} />
              </button>
              <input
                className="input"
                type="number"
                min={1}
                value={cant}
                onChange={e => setCant(Math.max(1, Number(e.target.value)))}
                style={{ width: 80, textAlign: 'center' }}
              />
              <button className="btn ghost" style={{ padding: '6px 12px' }} onClick={() => setCant(c => c + 1)}>
                <Ic n="plus" size={14} />
              </button>
            </div>
          </div>

          <div>
            <label className="label">Motivo</label>
            <select className="input" value={motivo} onChange={e => setMotivo(e.target.value)}>
              {motivos.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="card card-pad" style={{ background: 'var(--surface-2)' }}>
            <div className="between" style={{ fontSize: 13.5 }}>
              <span className="muted">Stock actual</span>
              <span className="num" style={{ fontWeight: 600 }}>{sel.stock}</span>
            </div>
            <div className="between mt10" style={{ fontSize: 13.5 }}>
              <span className="muted">Movimiento</span>
              <span className="num" style={{ fontWeight: 600, color: tipo === 'entrada' ? 'var(--st-conf)' : 'var(--st-canc)' }}>
                {tipo === 'entrada' ? '+' : '-'}{cant}
              </span>
            </div>
            <hr className="hr" style={{ margin: '12px 0' }} />
            <div className="between" style={{ fontSize: 15 }}>
              <span style={{ fontWeight: 700 }}>Stock resultante</span>
              <span className="num gold-text" style={{ fontWeight: 700, fontSize: 20 }}>{stockResultante}</span>
            </div>
            {stockResultante <= sel.min && stockResultante > 0 && (
              <div className="muted" style={{ fontSize: 11.5, marginTop: 8, color: 'var(--st-pend)' }}>
                ⚠ Quedará por debajo del mínimo ({sel.min})
              </div>
            )}
            {stockResultante === 0 && (
              <div className="muted" style={{ fontSize: 11.5, marginTop: 8, color: 'var(--st-canc)' }}>
                El producto quedará agotado
              </div>
            )}
          </div>
        </div>

        <div className="between card-pad" style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn gold" onClick={() => onConfirm(sel.id, tipo === 'entrada' ? cant : -cant, motivo)}>
            <Ic n="check" />Registrar movimiento
          </button>
        </div>
      </div>
    </Modal>
  )
}

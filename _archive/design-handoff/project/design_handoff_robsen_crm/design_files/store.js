/* ROBSEN · Persistencia local + store reactivo
   Fuente única de verdad. Hidrata window.RB desde localStorage y
   guarda cada cambio. Todos los módulos leen/escriben aquí. */
(function () {
  const KEY = 'rb_data_v1';
  const COLLECTIONS = ['clientas', 'servicios', 'productos', 'hoy', 'ventas', 'movimientos', 'transacciones', 'estilistas'];

  function hydrate() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      COLLECTIONS.forEach(c => { if (Array.isArray(saved[c])) window.RB[c] = saved[c]; });
    } catch (e) { console.warn('No se pudieron cargar datos guardados:', e); }
  }
  function persist() {
    try {
      const out = {};
      COLLECTIONS.forEach(c => { out[c] = window.RB[c]; });
      localStorage.setItem(KEY, JSON.stringify(out));
    } catch (e) { console.warn('No se pudo guardar:', e); }
  }

  hydrate();

  const listeners = new Set();
  const ini = (nombre) => (nombre || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '··';

  const Store = {
    iniciales: ini,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    notify() { listeners.forEach(f => f()); },
    commit() { persist(); this.notify(); },

    /* ---- Clientas ---- */
    upsertClienta(c) {
      const arr = window.RB.clientas;
      const data = { ...c, ini: ini(c.nombre) };
      const i = arr.findIndex(x => x.id === c.id);
      if (i >= 0) arr[i] = { ...arr[i], ...data };
      else arr.unshift({ id: 'c' + Date.now(), visitas: 0, gasto: 0, ticket: 0, ultima: '—', ...data });
      this.commit();
    },
    removeClienta(id) { window.RB.clientas = window.RB.clientas.filter(c => c.id !== id); this.commit(); },

    /* ---- Citas (agenda del día) ---- */
    upsertCita(a) {
      const arr = window.RB.hoy;
      const i = arr.findIndex(x => x.id === a.id);
      if (i >= 0) arr[i] = { ...arr[i], ...a };
      else arr.push({ id: 'a' + Date.now(), ...a });
      arr.sort((x, y) => x.h.localeCompare(y.h));
      this.commit();
    },
    removeCita(id) { window.RB.hoy = window.RB.hoy.filter(a => a.id !== id); this.commit(); },

    /* ---- Servicios ---- */
    upsertServicio(s) {
      const arr = window.RB.servicios;
      const i = arr.findIndex(x => x.id === s.id);
      if (i >= 0) arr[i] = { ...arr[i], ...s };
      else arr.push({ id: 's' + Date.now(), ...s });
      this.commit();
    },
    removeServicio(id) { window.RB.servicios = window.RB.servicios.filter(s => s.id !== id); this.commit(); },

    /* ---- Productos ---- */
    upsertProducto(p) {
      const arr = window.RB.productos;
      const i = arr.findIndex(x => x.id === p.id);
      if (i >= 0) arr[i] = { ...arr[i], ...p };
      else arr.push({ id: 'pr' + Date.now(), vendidos: 0, ...p });
      this.commit();
    },
    removeProducto(id) { window.RB.productos = window.RB.productos.filter(p => p.id !== id); this.commit(); },

    /* ---- Estilistas / empleados ---- */
    upsertEstilista(e) {
      const arr = window.RB.estilistas;
      const data = { ...e, ini: ini(e.nombre) };
      const i = arr.findIndex(x => x.id === e.id);
      if (i >= 0) arr[i] = { ...arr[i], ...data };
      else arr.push({ id: 'e' + Date.now(), color: '#C8A14A', ...data });
      this.commit();
    },
    removeEstilista(id) { window.RB.estilistas = window.RB.estilistas.filter(e => e.id !== id); this.commit(); },

    /* ---- Ventas (POS) — descuenta inventario, genera movimiento y transacción ---- */
    addVenta(v) {
      window.RB.ventas.unshift(v);
      const prodLines = v.lineas.filter(l => l.tipo === 'producto');
      prodLines.forEach(l => {
        const p = window.RB.productos.find(pp => pp.nombre === l.nombre);
        if (p) { p.stock = Math.max(0, p.stock - l.cant); p.vendidos = (p.vendidos || 0) + l.cant; }
        window.RB.movimientos.unshift({
          id: 'mv' + Date.now() + Math.round(Math.random() * 999),
          fecha: v.fecha, prod: l.nombre, tipo: 'salida', cant: l.cant,
          motivo: 'Venta · Ticket ' + v.ticket, ref: v.id,
        });
      });
      if (prodLines.length) {
        window.RB.transacciones.unshift({
          id: 'tx' + Date.now(), ticket: v.ticket, fecha: v.fecha, cliente: v.cliente,
          est: (v.lineas.find(l => l.est) || {}).est || 'e3',
          items: prodLines.map(l => ({ n: l.nombre, q: l.cant, p: l.precio })),
          total: prodLines.reduce((s, l) => s + l.precio * l.cant, 0),
          pago: v.pago, tipo: v.lineas.some(l => l.tipo === 'servicio') ? 'mixto' : 'producto',
        });
      }
      this.commit();
    },

    /* Venta rápida de un producto (desde el módulo Productos) → crea ticket en Ventas */
    venderProducto({ prod, cant, cliente, pago, est }) {
      const venta = {
        id: 'v' + Date.now(), ticket: '#' + (1043 + window.RB.ventas.length),
        fecha: 'Hoy · ahora', cliente: cliente || 'Venta de mostrador', clienteId: null,
        pago, estado: 'pagada', desc: 0, anticipo: 0,
        lineas: [{ tipo: 'producto', nombre: prod.nombre, est: est || null, cant, precio: prod.precio, com: 10 }],
      };
      this.addVenta(venta);
      return venta;
    },

    resetAll() { localStorage.removeItem(KEY); location.reload(); },
  };

  window.RBStore = Store;
})();

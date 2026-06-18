import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { defaultData } from './mockData'
import type { RBData, Cita, Clienta, Servicio, Producto, Venta, LineaVenta, Estilista, Movimiento, Transaccion, SalonConfig, Usuario } from '../types'

const STORAGE_KEY = 'rb_data_v3'

interface Store {
  data: RBData
  resetData: () => void
  updateConfig: (patch: Partial<SalonConfig>) => void
  upsertCita: (cita: Partial<Cita> & { id: string }) => void
  deleteCita: (id: string) => void
  upsertCitaFutura: (cita: Partial<Cita> & { id: string }) => void
  deleteCitaFutura: (id: string) => void
  upsertClienta: (c: Partial<Clienta> & { id: string }) => void
  deleteClienta: (id: string) => void
  upsertServicio: (s: Partial<Servicio> & { id: string }) => void
  deleteServicio: (id: string) => void
  upsertProducto: (p: Partial<Producto> & { id: string }) => void
  deleteProducto: (id: string) => void
  upsertEstilista: (e: Partial<Estilista> & { id: string }) => void
  deleteEstilista: (id: string) => void
  addVenta: (v: Venta) => void
  updateVenta: (id: string, patch: Partial<Venta>) => void
  venderProducto: (productoId: string, cant: number, clienta: string, pago: string, estId: string | null) => void
  upsertUsuario: (u: Partial<Usuario> & { id: string }) => void
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      data: defaultData,

      resetData: () => set({ data: defaultData }),

      updateConfig: (patch) => set(s => ({
        data: { ...s.data, config: { ...s.data.config, ...patch } }
      })),

      upsertCita: (cita) => set(s => {
        const hoy = s.data.hoy
        const idx = hoy.findIndex(c => c.id === cita.id)
        const newHoy = idx >= 0
          ? hoy.map((c, i) => i === idx ? { ...c, ...cita } : c)
          : [...hoy, cita as Cita].sort((a, b) => a.h.localeCompare(b.h))
        return { data: { ...s.data, hoy: newHoy } }
      }),

      deleteCita: (id) => set(s => ({
        data: { ...s.data, hoy: s.data.hoy.filter(c => c.id !== id) }
      })),

      upsertCitaFutura: (cita) => set(s => {
        const futuras = s.data.citasFuturas || []
        const idx = futuras.findIndex(c => c.id === cita.id)
        const newFuturas = idx >= 0
          ? futuras.map((c, i) => i === idx ? { ...c, ...cita } : c)
          : [...futuras, cita as Cita].sort((a, b) => {
              const fd = (a.fecha || '').localeCompare(b.fecha || '')
              return fd !== 0 ? fd : a.h.localeCompare(b.h)
            })
        return { data: { ...s.data, citasFuturas: newFuturas } }
      }),

      deleteCitaFutura: (id) => set(s => ({
        data: { ...s.data, citasFuturas: (s.data.citasFuturas || []).filter(c => c.id !== id) }
      })),

      upsertClienta: (c) => set(s => {
        const clientas = s.data.clientas
        const idx = clientas.findIndex(x => x.id === c.id)
        const newClientas = idx >= 0
          ? clientas.map((x, i) => i === idx ? { ...x, ...c } : x)
          : [...clientas, c as Clienta]
        return { data: { ...s.data, clientas: newClientas } }
      }),

      deleteClienta: (id) => set(s => ({
        data: { ...s.data, clientas: s.data.clientas.filter(c => c.id !== id) }
      })),

      upsertServicio: (srv) => set(s => {
        const servicios = s.data.servicios
        const idx = servicios.findIndex(x => x.id === srv.id)
        const newSrv = idx >= 0
          ? servicios.map((x, i) => i === idx ? { ...x, ...srv } : x)
          : [...servicios, srv as Servicio]
        return { data: { ...s.data, servicios: newSrv } }
      }),

      deleteServicio: (id) => set(s => ({
        data: { ...s.data, servicios: s.data.servicios.filter(x => x.id !== id) }
      })),

      upsertProducto: (p) => set(s => {
        const productos = s.data.productos
        const idx = productos.findIndex(x => x.id === p.id)
        const newP = idx >= 0
          ? productos.map((x, i) => i === idx ? { ...x, ...p } : x)
          : [...productos, p as Producto]
        return { data: { ...s.data, productos: newP } }
      }),

      deleteProducto: (id) => set(s => ({
        data: { ...s.data, productos: s.data.productos.filter(x => x.id !== id) }
      })),

      upsertEstilista: (e) => set(s => {
        const estilistas = s.data.estilistas
        const idx = estilistas.findIndex(x => x.id === e.id)
        const newE = idx >= 0
          ? estilistas.map((x, i) => i === idx ? { ...x, ...e } : x)
          : [...estilistas, e as Estilista]
        return { data: { ...s.data, estilistas: newE } }
      }),

      deleteEstilista: (id) => set(s => ({
        data: { ...s.data, estilistas: s.data.estilistas.filter(x => x.id !== id) }
      })),

      addVenta: (v) => set(s => {
        let productos = [...s.data.productos]
        const movs: Movimiento[] = []
        const txs: Transaccion[] = []

        v.lineas.forEach((l: LineaVenta) => {
          if (l.tipo === 'producto') {
            const idx = productos.findIndex(p => p.nombre === l.nombre)
            if (idx >= 0) {
              productos = productos.map((p, i) => i === idx ? { ...p, stock: p.stock - l.cant, vendidos: p.vendidos + l.cant } : p)
              movs.push({
                id: 'mv' + Date.now() + Math.random(),
                fecha: new Date().toLocaleDateString('es-MX', { day:'2-digit', month:'short' }) + ' · ' + new Date().toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' }),
                prod: l.nombre,
                tipo: 'salida',
                cant: l.cant,
                motivo: 'Venta · ' + v.ticket,
                ref: v.id,
              })
            }
          }
        })

        const productLines = v.lineas.filter(l => l.tipo === 'producto')
        if (productLines.length > 0) {
          txs.push({
            id: 'tx' + Date.now(),
            ticket: v.ticket,
            fecha: v.fecha,
            cliente: v.cliente,
            est: v.lineas.find(l => l.est)?.est || '',
            items: productLines.map(l => ({ n: l.nombre, q: l.cant, p: l.precio })),
            total: productLines.reduce((s, l) => s + l.precio * l.cant, 0),
            pago: v.pago,
            tipo: v.lineas.some(l => l.tipo === 'servicio') ? 'mixto' : 'producto',
          })
        }

        // Update clienta stats when sale has a linked clienteId
        let clientas = [...s.data.clientas]
        if (v.clienteId) {
          const idx = clientas.findIndex(c => c.id === v.clienteId)
          if (idx >= 0) {
            const cl = clientas[idx]
            const totalVenta = v.lineas.reduce((sum, l) => sum + l.precio * l.cant, 0) - (v.desc || 0)
            const newVisitas = cl.visitas + 1
            const newGasto = cl.gasto + totalVenta
            clientas = clientas.map((c, i) => i !== idx ? c : {
              ...cl,
              visitas: newVisitas,
              gasto: newGasto,
              ticket: Math.round(newGasto / newVisitas),
              ultima: new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) + ' ' + new Date().getFullYear(),
            })
          }
        }

        return {
          data: {
            ...s.data,
            ventas: [v, ...s.data.ventas],
            productos,
            clientas,
            movimientos: [...movs, ...s.data.movimientos],
            transacciones: [...txs, ...s.data.transacciones],
          }
        }
      }),

      updateVenta: (id, patch) => set(s => ({
        data: { ...s.data, ventas: s.data.ventas.map(v => v.id === id ? { ...v, ...patch } : v) }
      })),

      upsertUsuario: (u) => set(s => {
        const usuarios = s.data.usuarios
        const idx = usuarios.findIndex(x => x.id === u.id)
        const newU = idx >= 0
          ? usuarios.map((x, i) => i === idx ? { ...x, ...u } : x)
          : [...usuarios, u as Usuario]
        return { data: { ...s.data, usuarios: newU } }
      }),

      venderProducto: (productoId, cant, clienta, pago, estId) => {
        const { data, addVenta } = get()
        const prod = data.productos.find(p => p.id === productoId)
        if (!prod || prod.stock < cant) return
        const ticket = '#' + (1043 + data.ventas.length)
        const venta: Venta = {
          id: 'v' + Date.now(),
          ticket,
          fecha: new Date().toLocaleDateString('es-MX', { day:'2-digit', month:'short' }) + ' · ' + new Date().toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' }),
          cliente: clienta || 'Mostrador',
          clienteId: '',
          pago,
          estado: 'pagada',
          desc: 0,
          anticipo: 0,
          lineas: [{ tipo: 'producto', nombre: prod.nombre, est: estId, cant, precio: prod.precio, com: 10 }],
        }
        addVenta(venta)
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ data: state.data }),
    }
  )
)

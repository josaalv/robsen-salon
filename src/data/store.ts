import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { defaultData } from './mockData'
import { db } from '../lib/db'
import { toast } from '../components/ui'
import type { RBData, Cita, Clienta, Servicio, Producto, Venta, LineaVenta, Estilista, Movimiento, Transaccion, SalonConfig, Usuario, Plantilla, Bloqueo, Gasto } from '../types'

const STORAGE_KEY = 'rb_data_v3'

interface Store {
  data: RBData
  syncing: boolean
  resetData: () => void
  loadFromSupabase: () => Promise<boolean>
  migrateToSupabase: () => Promise<boolean>
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
  upsertPlantilla: (p: Partial<Plantilla> & { id: string }) => void
  ajustarStock: (productoId: string, cant: number, motivo: string) => void
  upsertBloqueo: (b: Bloqueo) => void
  deleteBloqueo: (id: string) => void
  addGasto: (g: Gasto) => void
  deleteGasto: (id: string) => void
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      data: defaultData,
      syncing: false,

      resetData: () => set({ data: defaultData }),

      // ─── Cargar desde Supabase al iniciar sesión ─────────────────────────
      loadFromSupabase: async () => {
        set({ syncing: true })
        const result = await db.loadAll()
        set({ syncing: false })
        if (!result) return false

        // Si Supabase está vacío pero hay datos locales → migrar automáticamente
        if (result.usuarios.length === 0) {
          const localData = get().data
          if (localData.usuarios.length > 0) {
            set({ syncing: true })
            await db.seedAll(localData)
            set({ syncing: false })
            // Recargar tras migración
            const fresh = await db.loadAll()
            if (fresh && fresh.usuarios.length > 0) {
              set(s => ({
                data: {
                  ...s.data,
                  ...(fresh.config ? { config: fresh.config } : {}),
                  estilistas:   fresh.estilistas,
                  servicios:    fresh.servicios,
                  clientas:     fresh.clientas,
                  ventas:       fresh.ventas,
                  productos:    fresh.productos,
                  plantillas:   fresh.plantillas,
                  usuarios:     fresh.usuarios,
                  movimientos:  fresh.movimientos,
                  bloqueos:     fresh.bloqueos,
                  gastos:       fresh.gastos,
                  hoy:          fresh.citas.hoy,
                  citasFuturas: fresh.citas.futuras,
                }
              }))
            }
          }
          return true
        }

        // Supabase tiene datos — es la fuente de verdad
        set(s => ({
          data: {
            ...s.data,
            ...(result.config ? { config: result.config } : {}),
            estilistas:   result.estilistas,
            servicios:    result.servicios,
            clientas:     result.clientas,
            ventas:       result.ventas,
            productos:    result.productos,
            plantillas:   result.plantillas,
            usuarios:     result.usuarios,
            movimientos:  result.movimientos,
            bloqueos:     result.bloqueos,
            gastos:       result.gastos,
            hoy:          result.citas.hoy,
            citasFuturas: result.citas.futuras,
          }
        }))
        return true
      },

      // ─── Migrar datos locales a Supabase ─────────────────────────────────
      migrateToSupabase: async () => {
        set({ syncing: true })
        const ok = await db.seedAll(get().data)
        set({ syncing: false })
        return ok
      },

      updateConfig: (patch) => {
        set(s => ({ data: { ...s.data, config: { ...s.data.config, ...patch } } }))
        const cfg = get().data.config
        db.saveConfig(cfg).catch(() => {})
      },

      upsertCita: (cita) => {
        let merged: Cita
        set(s => {
          const hoy = s.data.hoy
          const idx = hoy.findIndex(c => c.id === cita.id)
          merged = idx >= 0 ? { ...hoy[idx], ...cita } : cita as Cita
          const newHoy = idx >= 0
            ? hoy.map((c, i) => i === idx ? merged : c)
            : [...hoy, merged].sort((a, b) => a.h.localeCompare(b.h))
          return { data: { ...s.data, hoy: newHoy } }
        })
        db.upsertCita(merged!).catch(() => {})
      },

      deleteCita: (id) => {
        set(s => ({ data: { ...s.data, hoy: s.data.hoy.filter(c => c.id !== id) } }))
        db.deleteCita(id).catch(() => {})
      },

      upsertCitaFutura: (cita) => {
        let merged: Cita
        set(s => {
          const futuras = s.data.citasFuturas || []
          const idx = futuras.findIndex(c => c.id === cita.id)
          merged = idx >= 0 ? { ...futuras[idx], ...cita } : cita as Cita
          const newFuturas = idx >= 0
            ? futuras.map((c, i) => i === idx ? merged : c)
            : [...futuras, merged].sort((a, b) => {
                const fd = (a.fecha || '').localeCompare(b.fecha || '')
                return fd !== 0 ? fd : a.h.localeCompare(b.h)
              })
          return { data: { ...s.data, citasFuturas: newFuturas } }
        })
        db.upsertCita(merged!).catch(() => {})
      },

      deleteCitaFutura: (id) => {
        set(s => ({ data: { ...s.data, citasFuturas: (s.data.citasFuturas || []).filter(c => c.id !== id) } }))
        db.deleteCita(id).catch(() => {})
      },

      upsertClienta: (c) => {
        let merged: Clienta
        set(s => {
          const clientas = s.data.clientas
          const idx = clientas.findIndex(x => x.id === c.id)
          merged = idx >= 0 ? { ...clientas[idx], ...c } : c as Clienta
          const newClientas = idx >= 0
            ? clientas.map((x, i) => i === idx ? merged : x)
            : [...clientas, merged]
          return { data: { ...s.data, clientas: newClientas } }
        })
        db.upsertClienta(merged!).catch(() => {})
      },

      deleteClienta: (id) => {
        set(s => ({ data: { ...s.data, clientas: s.data.clientas.filter(c => c.id !== id) } }))
        db.deleteClienta(id).catch(() => {})
      },

      upsertServicio: (srv) => {
        let merged: Servicio
        set(s => {
          const servicios = s.data.servicios
          const idx = servicios.findIndex(x => x.id === srv.id)
          merged = idx >= 0 ? { ...servicios[idx], ...srv } : srv as Servicio
          const newSrv = idx >= 0
            ? servicios.map((x, i) => i === idx ? merged : x)
            : [...servicios, merged]
          return { data: { ...s.data, servicios: newSrv } }
        })
        db.upsertServicio(merged!).catch(() => {})
      },

      deleteServicio: (id) => {
        set(s => ({ data: { ...s.data, servicios: s.data.servicios.filter(x => x.id !== id) } }))
        db.deleteServicio(id).catch(() => {})
      },

      upsertProducto: (p) => {
        let merged: Producto
        set(s => {
          const productos = s.data.productos
          const idx = productos.findIndex(x => x.id === p.id)
          merged = idx >= 0 ? { ...productos[idx], ...p } : p as Producto
          const newP = idx >= 0
            ? productos.map((x, i) => i === idx ? merged : x)
            : [...productos, merged]
          return { data: { ...s.data, productos: newP } }
        })
        db.upsertProducto(merged!).catch(() => {})
      },

      deleteProducto: (id) => {
        set(s => ({ data: { ...s.data, productos: s.data.productos.filter(x => x.id !== id) } }))
        db.deleteProducto(id).catch(() => {})
      },

      upsertEstilista: (e) => {
        let merged: Estilista
        set(s => {
          const estilistas = s.data.estilistas
          const idx = estilistas.findIndex(x => x.id === e.id)
          merged = idx >= 0 ? { ...estilistas[idx], ...e } : e as Estilista
          const newE = idx >= 0
            ? estilistas.map((x, i) => i === idx ? merged : x)
            : [...estilistas, merged]
          return { data: { ...s.data, estilistas: newE } }
        })
        db.upsertEstilista(merged!).catch(() => {})
      },

      deleteEstilista: (id) => {
        set(s => ({ data: { ...s.data, estilistas: s.data.estilistas.filter(x => x.id !== id) } }))
        db.deleteEstilista(id).catch(() => {})
      },

      addVenta: (v) => {
        let syncProductos: Producto[] = []
        let syncClienta: Clienta | null = null
        const syncMovs: Movimiento[] = []
        const syncTxs: Transaccion[] = []

        set(s => {
          let productos = [...s.data.productos]
          const movs: Movimiento[] = []
          const txs: Transaccion[] = []

          v.lineas.forEach((l: LineaVenta) => {
            if (l.tipo === 'producto') {
              const idx = productos.findIndex(p => p.nombre === l.nombre)
              if (idx >= 0) {
                productos = productos.map((p, i) => i === idx
                  ? { ...p, stock: p.stock - l.cant, vendidos: p.vendidos + l.cant } : p)
                movs.push({
                  id: 'mv' + Date.now() + Math.random(),
                  fecha: new Date().toLocaleDateString('es-MX', { day:'2-digit', month:'short' }) + ' · ' + new Date().toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' }),
                  prod: l.nombre, tipo: 'salida', cant: l.cant,
                  motivo: 'Venta · ' + v.ticket, ref: v.id,
                })
              }
            }
          })

          const productLines = v.lineas.filter(l => l.tipo === 'producto')
          if (productLines.length > 0) {
            txs.push({
              id: 'tx' + Date.now(), ticket: v.ticket, fecha: v.fecha, cliente: v.cliente,
              est: v.lineas.find(l => l.est)?.est || '',
              items: productLines.map(l => ({ n: l.nombre, q: l.cant, p: l.precio })),
              total: productLines.reduce((s, l) => s + l.precio * l.cant, 0),
              pago: v.pago, tipo: v.lineas.some(l => l.tipo === 'servicio') ? 'mixto' : 'producto',
            })
          }

          let clientas = [...s.data.clientas]
          if (v.clienteId) {
            const idx = clientas.findIndex(c => c.id === v.clienteId)
            if (idx >= 0) {
              const cl = clientas[idx]
              const totalVenta = v.lineas.reduce((sum, l) => sum + l.precio * l.cant, 0) - (v.desc || 0)
              const newVisitas = cl.visitas + 1
              const newGasto = cl.gasto + totalVenta
              syncClienta = {
                ...cl, visitas: newVisitas, gasto: newGasto,
                ticket: Math.round(newGasto / newVisitas),
                ultima: new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) + ' ' + new Date().getFullYear(),
              }
              clientas = clientas.map((c, i) => i !== idx ? c : syncClienta!)
            }
          }

          // Productos que cambiaron
          syncProductos = productos.filter((p, i) => s.data.productos[i]?.stock !== p.stock)
          syncMovs.push(...movs)
          syncTxs.push(...txs)

          return {
            data: {
              ...s.data,
              ventas: [v, ...s.data.ventas],
              productos, clientas,
              movimientos: [...movs, ...s.data.movimientos],
              transacciones: [...txs, ...s.data.transacciones],
            }
          }
        })

        // Supabase sync (fire-and-forget)
        db.addVenta(v).catch(() => {})
        syncProductos.forEach(p => db.upsertProducto(p).catch(() => {}))
        if (syncClienta) db.upsertClienta(syncClienta).catch(() => {})
        syncMovs.forEach(m => db.addMovimiento(m).catch(() => {}))
      },

      updateVenta: (id, patch) => {
        set(s => ({ data: { ...s.data, ventas: s.data.ventas.map(v => v.id === id ? { ...v, ...patch } : v) } }))
        db.updateVenta(id, patch).catch(() => {})
      },

      upsertUsuario: (u) => {
        let merged: Usuario
        set(s => {
          const usuarios = s.data.usuarios
          const idx = usuarios.findIndex(x => x.id === u.id)
          merged = idx >= 0 ? { ...usuarios[idx], ...u } : u as Usuario
          const newU = idx >= 0
            ? usuarios.map((x, i) => i === idx ? merged : x)
            : [...usuarios, merged]
          return { data: { ...s.data, usuarios: newU } }
        })
        db.upsertUsuario(merged!).catch(() => {})
      },

      upsertPlantilla: (p) => {
        let merged: Plantilla
        set(s => {
          const plantillas = s.data.plantillas
          const idx = plantillas.findIndex(x => x.id === p.id)
          merged = idx >= 0 ? { ...plantillas[idx], ...p } : p as Plantilla
          const newP = idx >= 0
            ? plantillas.map((x, i) => i === idx ? merged : x)
            : [...plantillas, merged]
          return { data: { ...s.data, plantillas: newP } }
        })
        db.upsertPlantilla(merged!).catch(() => {})
      },

      upsertBloqueo: (b) => {
        set(s => {
          const bloqueos = s.data.bloqueos || []
          const idx = bloqueos.findIndex(x => x.id === b.id)
          const newBloqueos = idx >= 0
            ? bloqueos.map((x, i) => i === idx ? b : x)
            : [...bloqueos, b]
          return { data: { ...s.data, bloqueos: newBloqueos } }
        })
        db.upsertBloqueo(b).catch(() => {})
      },

      deleteBloqueo: (id) => {
        set(s => ({ data: { ...s.data, bloqueos: (s.data.bloqueos || []).filter(b => b.id !== id) } }))
        db.deleteBloqueo(id).catch(() => {})
      },

      addGasto: (g) => {
        set(s => ({ data: { ...s.data, gastos: [...(s.data.gastos || []), g] } }))
        db.upsertGasto(g).catch(() => {})
      },

      deleteGasto: (id) => {
        set(s => ({ data: { ...s.data, gastos: (s.data.gastos || []).filter(g => g.id !== id) } }))
        db.deleteGasto(id).catch(() => {})
      },

      ajustarStock: (productoId, cant, motivo) => {
        let syncProd: Producto | null = null
        const syncMov: Movimiento[] = []

        set(s => {
          const prod = s.data.productos.find(p => p.id === productoId)
          if (!prod) return {}
          const newStock = Math.max(0, prod.stock + cant)
          const updated = { ...prod, stock: newStock }
          syncProd = updated
          const ahora = new Date().toLocaleDateString('es-MX', { day:'2-digit', month:'short' }) + ' · ' + new Date().toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' })
          const mov: Movimiento = {
            id: 'mv' + Date.now(), fecha: ahora, prod: prod.nombre,
            tipo: cant > 0 ? 'entrada' : 'salida', cant: Math.abs(cant), motivo, ref: 'manual',
          }
          syncMov.push(mov)
          return {
            data: {
              ...s.data,
              productos: s.data.productos.map(p => p.id === productoId ? updated : p),
              movimientos: [mov, ...s.data.movimientos],
            }
          }
        })

        if (syncProd) db.upsertProducto(syncProd).catch(() => {})
        syncMov.forEach(m => db.addMovimiento(m).catch(() => {}))
      },

      venderProducto: (productoId, cant, clienta, pago, estId) => {
        const { data, addVenta } = get()
        const prod = data.productos.find(p => p.id === productoId)
        if (!prod || prod.stock < cant) { toast('Stock insuficiente'); return }
        const ticket = '#' + (1000 + data.ventas.length + 1)
        const clienteEncontrado = clienta ? data.clientas.find(c => c.nombre === clienta) : null
        const com = (data.config.comisiones as Record<string, number>)['_producto'] ?? 10
        const venta: Venta = {
          id: 'v' + Date.now(), ticket,
          fecha: new Date().toLocaleDateString('es-MX', { day:'2-digit', month:'short' }) + ' · ' + new Date().toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' }),
          cliente: clienta || 'Mostrador', clienteId: clienteEncontrado?.id || '', pago, estado: 'pagada', desc: 0, anticipo: 0,
          lineas: [{ tipo: 'producto', nombre: prod.nombre, est: estId, cant, precio: prod.precio, com }],
        }
        addVenta(venta)
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        data: {
          ...state.data,
          usuarios: state.data.usuarios.map(({ pass: _p, ...u }) => u),
        }
      }),
    }
  )
)

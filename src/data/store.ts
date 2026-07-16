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
  loadFromSupabase: () => Promise<boolean>
  updateConfig: (patch: Partial<SalonConfig>) => Promise<void>
  upsertCita: (cita: Partial<Cita> & { id: string }) => Promise<void>
  deleteCita: (id: string) => Promise<void>
  upsertCitaFutura: (cita: Partial<Cita> & { id: string }) => Promise<void>
  deleteCitaFutura: (id: string) => Promise<void>
  upsertClienta: (c: Partial<Clienta> & { id: string }) => Promise<void>
  deleteClienta: (id: string) => Promise<void>
  upsertServicio: (s: Partial<Servicio> & { id: string }) => Promise<void>
  deleteServicio: (id: string) => Promise<void>
  upsertProducto: (p: Partial<Producto> & { id: string }) => Promise<void>
  deleteProducto: (id: string) => Promise<void>
  upsertEstilista: (e: Partial<Estilista> & { id: string }) => Promise<void>
  deleteEstilista: (id: string) => Promise<void>
  addVenta: (v: Venta) => Promise<void>
  updateVenta: (id: string, patch: Partial<Venta>) => Promise<void>
  deleteVenta: (id: string) => Promise<void>
  venderProducto: (productoId: string, cant: number, clienta: string, pago: string, estId: string | null) => Promise<void>
  upsertUsuario: (u: Partial<Usuario> & { id: string }) => Promise<void>
  deleteUsuario: (id: string) => void
  upsertPlantilla: (p: Partial<Plantilla> & { id: string }) => Promise<void>
  ajustarStock: (productoId: string, cant: number, motivo: string) => Promise<void>
  upsertBloqueo: (b: Bloqueo) => Promise<void>
  deleteBloqueo: (id: string) => Promise<void>
  addGasto: (g: Gasto) => Promise<void>
  deleteGasto: (id: string) => Promise<void>
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      data: defaultData,
      syncing: false,

      // ─── Cargar desde Supabase al iniciar sesión ─────────────────────────
      loadFromSupabase: async () => {
        set({ syncing: true })
        try {
          const result = await db.loadAll()
          if (!result) return false

          // Si Supabase está vacío pero hay datos locales → migrar automáticamente
          if (result.usuarios.length === 0) {
            const localData = get().data
            if (localData.usuarios.length > 0) {
              await db.seedAll(localData)
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
        } catch {
          return false
        } finally {
          set({ syncing: false })
        }
      },

      updateConfig: async (patch) => {
        const previous = get().data.config
        set(s => ({ data: { ...s.data, config: { ...s.data.config, ...patch } } }))
        try {
          await db.saveConfig(get().data.config)
        } catch (err) {
          set(s => ({ data: { ...s.data, config: previous } }))
          throw err
        }
      },

      upsertCita: async (cita) => {
        const previous = get().data.hoy
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
        try {
          await db.upsertCita(merged!)
        } catch (err) {
          set(s => ({ data: { ...s.data, hoy: previous } }))
          throw err
        }
      },

      deleteCita: async (id) => {
        const previous = get().data.hoy
        set(s => ({ data: { ...s.data, hoy: s.data.hoy.filter(c => c.id !== id) } }))
        try {
          await db.deleteCita(id)
        } catch (err) {
          set(s => ({ data: { ...s.data, hoy: previous } }))
          throw err
        }
      },

      upsertCitaFutura: async (cita) => {
        const previous = get().data.citasFuturas
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
        try {
          await db.upsertCita(merged!)
        } catch (err) {
          set(s => ({ data: { ...s.data, citasFuturas: previous } }))
          throw err
        }
      },

      deleteCitaFutura: async (id) => {
        const previous = get().data.citasFuturas
        set(s => ({ data: { ...s.data, citasFuturas: (s.data.citasFuturas || []).filter(c => c.id !== id) } }))
        try {
          await db.deleteCita(id)
        } catch (err) {
          set(s => ({ data: { ...s.data, citasFuturas: previous } }))
          throw err
        }
      },

      upsertClienta: async (c) => {
        const previous = get().data.clientas
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
        try {
          await db.upsertClienta(merged!)
        } catch (err) {
          set(s => ({ data: { ...s.data, clientas: previous } }))
          throw err
        }
      },

      deleteClienta: async (id) => {
        const previous = get().data.clientas
        set(s => ({ data: { ...s.data, clientas: s.data.clientas.filter(c => c.id !== id) } }))
        try {
          await db.deleteClienta(id)
        } catch (err) {
          set(s => ({ data: { ...s.data, clientas: previous } }))
          throw err
        }
      },

      upsertServicio: async (srv) => {
        const previous = get().data.servicios
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
        try {
          await db.upsertServicio(merged!)
        } catch (err) {
          set(s => ({ data: { ...s.data, servicios: previous } }))
          throw err
        }
      },

      deleteServicio: async (id) => {
        const previous = get().data.servicios
        set(s => ({ data: { ...s.data, servicios: s.data.servicios.filter(x => x.id !== id) } }))
        try {
          await db.deleteServicio(id)
        } catch (err) {
          set(s => ({ data: { ...s.data, servicios: previous } }))
          throw err
        }
      },

      upsertProducto: async (p) => {
        const previous = get().data.productos
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
        try {
          await db.upsertProducto(merged!)
        } catch (err) {
          set(s => ({ data: { ...s.data, productos: previous } }))
          throw err
        }
      },

      deleteProducto: async (id) => {
        const previous = get().data.productos
        set(s => ({ data: { ...s.data, productos: s.data.productos.filter(x => x.id !== id) } }))
        try {
          await db.deleteProducto(id)
        } catch (err) {
          set(s => ({ data: { ...s.data, productos: previous } }))
          throw err
        }
      },

      upsertEstilista: async (e) => {
        const previous = get().data.estilistas
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
        try {
          await db.upsertEstilista(merged!)
        } catch (err) {
          set(s => ({ data: { ...s.data, estilistas: previous } }))
          throw err
        }
      },

      deleteEstilista: async (id) => {
        const previous = get().data.estilistas
        set(s => ({ data: { ...s.data, estilistas: s.data.estilistas.filter(x => x.id !== id) } }))
        try {
          await db.deleteEstilista(id)
        } catch (err) {
          set(s => ({ data: { ...s.data, estilistas: previous } }))
          throw err
        }
      },

      addVenta: async (v) => {
        let syncClienta: Clienta | null = null
        const syncTxs: Transaccion[] = []
        const previous = {
          ventas: get().data.ventas,
          productos: get().data.productos,
          clientas: get().data.clientas,
          movimientos: get().data.movimientos,
          transacciones: get().data.transacciones,
        }

        set(s => {
          let productos = [...s.data.productos]
          const movs: Movimiento[] = []
          const txs: Transaccion[] = []

          v.lineas.forEach((l: LineaVenta) => {
            if (l.tipo === 'producto') {
              const idx = l.productoId
                ? productos.findIndex(p => p.id === l.productoId)
                : productos.findIndex(p => p.nombre === l.nombre)
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

        // db.addVenta ahora es una sola transacción (venta + líneas + stock
        // + movimiento de kardex, ver crear_venta_con_lineas) — ya no hace
        // falta sincronizar productos/movimientos por separado. Las
        // estadísticas de clienta sí quedan fuera de esa transacción.
        try {
          await db.addVenta(v)
        } catch (err) {
          set(s => ({ data: { ...s.data, ...previous } }))
          throw err
        }
        // La venta ya quedó registrada de forma transaccional (RPC). Actualizar
        // las estadísticas de la clienta es best-effort: si el rol no tiene
        // permiso para escribir clientas (p. ej. estilista), NO revertimos una
        // venta ya cobrada — solo se omite la sincronización de estadísticas.
        if (syncClienta) {
          try { await db.upsertClienta(syncClienta) }
          catch (e) { console.error('[addVenta:syncClienta]', e) }
        }
      },

      updateVenta: async (id, patch) => {
        const previous = get().data.ventas
        set(s => ({ data: { ...s.data, ventas: s.data.ventas.map(v => v.id === id ? { ...v, ...patch } : v) } }))
        try {
          await db.updateVenta(id, patch)
        } catch (err) {
          set(s => ({ data: { ...s.data, ventas: previous } }))
          throw err
        }
      },

      deleteVenta: async (id) => {
        // Borrar una venta es el inverso de crearla: repone el stock/vendidos de
        // los productos y revierte las estadísticas de la clienta. El stock y el
        // movimiento inverso también se hacen en la BD (RPC eliminar_venta); las
        // estadísticas de clienta van por separado, igual que en addVenta.
        const venta = get().data.ventas.find(v => v.id === id)
        const previous = {
          ventas: get().data.ventas,
          productos: get().data.productos,
          clientas: get().data.clientas,
        }
        let syncClienta: Clienta | null = null

        set(s => {
          let productos = [...s.data.productos]
          venta?.lineas.forEach(l => {
            if (l.tipo !== 'producto') return
            const idx = l.productoId
              ? productos.findIndex(p => p.id === l.productoId)
              : productos.findIndex(p => p.nombre === l.nombre)
            if (idx >= 0) productos = productos.map((p, i) => i === idx
              ? { ...p, stock: p.stock + l.cant, vendidos: Math.max(0, p.vendidos - l.cant) } : p)
          })

          let clientas = [...s.data.clientas]
          if (venta?.clienteId) {
            const idx = clientas.findIndex(c => c.id === venta.clienteId)
            if (idx >= 0) {
              const cl = clientas[idx]
              const totalVenta = venta.lineas.reduce((sum, l) => sum + l.precio * l.cant, 0) - (venta.desc || 0)
              const newVisitas = Math.max(0, cl.visitas - 1)
              const newGasto = Math.max(0, cl.gasto - totalVenta)
              syncClienta = { ...cl, visitas: newVisitas, gasto: newGasto, ticket: newVisitas ? Math.round(newGasto / newVisitas) : 0 }
              clientas = clientas.map((c, i) => i === idx ? syncClienta! : c)
            }
          }

          return { data: { ...s.data, ventas: s.data.ventas.filter(v => v.id !== id), productos, clientas } }
        })

        try {
          await db.deleteVenta(id)
        } catch (err) {
          set(s => ({ data: { ...s.data, ...previous } }))
          throw err
        }
        // El borrado ya se hizo de forma transaccional (RPC). La reversión de
        // estadísticas de la clienta es best-effort: no revertimos el borrado si
        // solo falla la sincronización de estadísticas.
        if (syncClienta) {
          try { await db.upsertClienta(syncClienta) }
          catch (e) { console.error('[deleteVenta:syncClienta]', e) }
        }
      },

      upsertUsuario: async (u) => {
        const previous = get().data.usuarios
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
        try {
          await db.upsertUsuario(merged!)
        } catch (err) {
          set(s => ({ data: { ...s.data, usuarios: previous } }))
          throw err
        }
      },

      // La eliminación real (perfil + cuenta de Auth) ya ocurrió vía
      // db.eliminarUsuario antes de llamar esto — aquí solo se sincroniza
      // el estado local.
      deleteUsuario: (id) => {
        set(s => ({ data: { ...s.data, usuarios: s.data.usuarios.filter(u => u.id !== id) } }))
      },

      upsertPlantilla: async (p) => {
        const previous = get().data.plantillas
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
        try {
          await db.upsertPlantilla(merged!)
        } catch (err) {
          set(s => ({ data: { ...s.data, plantillas: previous } }))
          throw err
        }
      },

      upsertBloqueo: async (b) => {
        const previous = get().data.bloqueos
        set(s => {
          const bloqueos = s.data.bloqueos || []
          const idx = bloqueos.findIndex(x => x.id === b.id)
          const newBloqueos = idx >= 0
            ? bloqueos.map((x, i) => i === idx ? b : x)
            : [...bloqueos, b]
          return { data: { ...s.data, bloqueos: newBloqueos } }
        })
        try {
          await db.upsertBloqueo(b)
        } catch (err) {
          set(s => ({ data: { ...s.data, bloqueos: previous } }))
          throw err
        }
      },

      deleteBloqueo: async (id) => {
        const previous = get().data.bloqueos
        set(s => ({ data: { ...s.data, bloqueos: (s.data.bloqueos || []).filter(b => b.id !== id) } }))
        try {
          await db.deleteBloqueo(id)
        } catch (err) {
          set(s => ({ data: { ...s.data, bloqueos: previous } }))
          throw err
        }
      },

      addGasto: async (g) => {
        const previous = get().data.gastos
        set(s => ({ data: { ...s.data, gastos: [...(s.data.gastos || []), g] } }))
        try {
          await db.upsertGasto(g)
        } catch (err) {
          set(s => ({ data: { ...s.data, gastos: previous } }))
          throw err
        }
      },

      deleteGasto: async (id) => {
        const previous = get().data.gastos
        set(s => ({ data: { ...s.data, gastos: (s.data.gastos || []).filter(g => g.id !== id) } }))
        try {
          await db.deleteGasto(id)
        } catch (err) {
          set(s => ({ data: { ...s.data, gastos: previous } }))
          throw err
        }
      },

      ajustarStock: async (productoId, cant, motivo) => {
        let syncProd: Producto | null = null
        const syncMov: Movimiento[] = []
        const previous = {
          productos: get().data.productos,
          movimientos: get().data.movimientos,
        }

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

        if (!syncProd) return
        try {
          await db.updateStock(productoId, syncProd.stock)
          for (const m of syncMov) await db.addMovimiento(m)
        } catch (err) {
          set(s => ({ data: { ...s.data, ...previous } }))
          throw err
        }
      },

      venderProducto: async (productoId, cant, clienta, pago, estId) => {
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
          lineas: [{ tipo: 'producto', nombre: prod.nombre, productoId: prod.id, est: estId, cant, precio: prod.precio, com }],
        }
        await addVenta(venta)
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        data: state.data,
      }),
    }
  )
)

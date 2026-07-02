import { supabase } from './supabase'
import type { Cita, Clienta, Estilista, Servicio, Producto, Venta, Movimiento, Plantilla, Usuario, SalonConfig, RBData, Bloqueo, Gasto } from '../types'

const BUCKET = 'media'

// ─── Mappers DB ↔ TypeScript ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapCita = (r: any): Cita => ({
  id: r.id, h: r.h, dur: r.dur, cl: r.cl,
  clienteId: r.cliente_id ?? undefined,
  tel: r.tel ?? undefined,
  email: r.email ?? undefined,
  srv: r.srv,
  servicioId: r.servicio_id ?? undefined,
  est: r.est, estado: r.estado, total: r.total, ant: r.ant,
  notas: r.notas ?? undefined,
  fecha: r.fecha ?? undefined,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toCitaRow = (c: Partial<Cita> & { id: string }) => ({
  id: c.id, h: c.h, dur: c.dur, cl: c.cl,
  cliente_id: c.clienteId ?? null,
  tel: c.tel ?? null,
  email: c.email ?? null,
  srv: c.srv,
  servicio_id: c.servicioId ?? null,
  est: c.est, estado: c.estado, total: c.total, ant: c.ant ?? 0,
  notas: c.notas ?? null,
  fecha: c.fecha ?? null,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapVenta = (r: any, lineas: any[]): Venta => ({
  id: r.id, ticket: r.ticket, fecha: r.fecha, cliente: r.cliente,
  clienteId: r.cliente_id ?? '',
  pago: r.pago, estado: r.estado,
  desc: r.descuento ?? 0,
  anticipo: r.anticipo ?? 0,
  citaId: r.cita_id ?? undefined,
  lineas: lineas.filter(l => l.venta_id === r.id).map(l => ({
    tipo: l.tipo, nombre: l.nombre, est: l.est ?? null,
    cant: l.cant, precio: l.precio, com: l.com,
  })),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapConfig = (r: any): SalonConfig => ({
  agendaStart: r.agenda_start,
  agendaEnd: r.agenda_end,
  slotMin: r.slot_min,
  diasAbiertos: r.dias_abiertos,
  nombre: r.nombre, direccion: r.direccion, tel: r.tel, whatsapp: r.whatsapp,
  anticipoPct: r.anticipo_pct,
  requerirAnticipo: r.requerir_anticipo,
  iva: r.iva,
  metodospago: r.metodospago,
  acento: r.acento,
  comisiones: r.comisiones || {},
  escalaComisiones: r.escala_comisiones || [],
  logo: r.logo ?? undefined,
  notifs: r.notifs,
})

const toConfigRow = (c: SalonConfig) => ({
  agenda_start: c.agendaStart, agenda_end: c.agendaEnd, slot_min: c.slotMin,
  dias_abiertos: c.diasAbiertos,
  nombre: c.nombre, direccion: c.direccion, tel: c.tel, whatsapp: c.whatsapp,
  anticipo_pct: c.anticipoPct, requerir_anticipo: c.requerirAnticipo,
  iva: c.iva, metodospago: c.metodospago, acento: c.acento,
  comisiones: c.comisiones, escala_comisiones: c.escalaComisiones || [], notifs: c.notifs,
  logo: c.logo ?? null,
})

// Mapper explícito para clientas — evita enviar columnas desconocidas
const toClientaRow = (c: Clienta) => ({
  id: c.id,
  nombre: c.nombre,
  tel: c.tel,
  email: c.email ?? null,
  estado: c.estado,
  ultima: c.ultima,
  ticket: c.ticket,
  fav: c.fav,
  est: c.est,
  visitas: c.visitas,
  gasto: c.gasto,
  ini: c.ini,
  cumple: c.cumple,
  ciclo: c.ciclo,
  notas: c.notas ?? null,
  formulas: c.formulas ?? [],
  fotos: c.fotos ?? [],
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapClienta = (r: any): Clienta => ({
  id: r.id,
  nombre: r.nombre,
  tel: r.tel ?? '',
  email: r.email ?? undefined,
  estado: r.estado,
  ultima: r.ultima ?? '',
  ticket: r.ticket ?? 0,
  fav: r.fav ?? '',
  est: r.est ?? '',
  visitas: r.visitas ?? 0,
  gasto: r.gasto ?? 0,
  ini: r.ini ?? '',
  cumple: r.cumple ?? '',
  ciclo: r.ciclo ?? 8,
  notas: r.notas ?? undefined,
  formulas: r.formulas ?? [],
  fotos: r.fotos ?? [],
})

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export const db = {

  // ─── Storage: archivos de imagen ────────────────────────────────────────────
  async uploadMedia(path: string, file: File): Promise<string | null> {
    if (!supabase) return null
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
    if (error) { console.error('[storage.upload]', path, error.message); return null }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return `${data.publicUrl}?t=${Date.now()}`
  },

  async deleteMedia(paths: string[]): Promise<void> {
    if (!supabase || paths.length === 0) return
    const { error } = await supabase.storage.from(BUCKET).remove(paths)
    if (error) console.error('[storage.delete]', error.message)
  },

  // Extrae el path relativo de una URL pública de Supabase Storage
  pathFromUrl(url: string): string {
    const marker = `/object/public/${BUCKET}/`
    const idx = url.indexOf(marker)
    return idx >= 0 ? url.slice(idx + marker.length) : ''
  },

  // — Config —
  async getConfig(): Promise<SalonConfig | null> {
    if (!supabase) return null
    const { data, error } = await supabase.from('config').select('*').limit(1).maybeSingle()
    if (error) console.error('[db.getConfig]', error.message)
    return data ? mapConfig(data) : null
  },
  async saveConfig(cfg: SalonConfig) {
    if (!supabase) return
    const { error } = await supabase.from('config').upsert(
      { id: 'main', ...toConfigRow(cfg) },
      { onConflict: 'id' }
    )
    if (error) console.error('[db.saveConfig]', error.message)
  },

  // — Estilistas —
  async getEstilistas(): Promise<Estilista[]> {
    if (!supabase) return []
    const { data } = await supabase.from('estilistas').select('*')
    return (data ?? []) as Estilista[]
  },
  async upsertEstilista(e: Estilista) {
    if (!supabase) return
    const { error } = await supabase.from('estilistas').upsert(e, { onConflict: 'id' })
    if (error) console.error('[db.upsertEstilista]', error.message)
  },
  async deleteEstilista(id: string) {
    if (!supabase) return
    await supabase.from('estilistas').delete().eq('id', id)
  },

  // — Servicios —
  async getServicios(): Promise<Servicio[]> {
    if (!supabase) return []
    const { data } = await supabase.from('servicios').select('*')
    return (data ?? []).map((r: any): Servicio => ({
      id: r.id, nombre: r.nombre, cat: r.cat, precio: r.precio, dur: r.dur,
      anticipo: r.anticipo ?? false, online: r.online ?? false, prof: r.prof ?? [],
      descripcion: r.descripcion ?? undefined,
      precioVisible: r.precio_visible ?? true,
      precioVariable: r.precio_variable ?? false,
      domicilio: r.domicilio ?? false,
      comValor: r.com_valor ?? 0,
      comTipo: r.com_tipo ?? 'porcentaje',
      activo: r.activo ?? true,
    }))
  },
  async upsertServicio(s: Servicio) {
    if (!supabase) return
    const { error } = await supabase.from('servicios').upsert({
      id: s.id, nombre: s.nombre, cat: s.cat, precio: s.precio, dur: s.dur,
      anticipo: s.anticipo, online: s.online, prof: s.prof,
      descripcion: s.descripcion ?? null,
      precio_visible: s.precioVisible ?? true,
      precio_variable: s.precioVariable ?? false,
      domicilio: s.domicilio ?? false,
      com_valor: s.comValor ?? 0,
      com_tipo: s.comTipo ?? 'porcentaje',
      activo: s.activo ?? true,
    }, { onConflict: 'id' })
    if (error) { console.error('[db.upsertServicio]', error.message); throw error }
  },
  async deleteServicio(id: string) {
    if (!supabase) return
    await supabase.from('servicios').delete().eq('id', id)
  },

  // — Clientas —
  async getClientas(): Promise<Clienta[]> {
    if (!supabase) return []
    const { data, error } = await supabase.from('clientas').select('*')
    if (error) console.error('[db.getClientas]', error.message)
    return (data ?? []).map(mapClienta)
  },
  async upsertClienta(c: Clienta) {
    if (!supabase) return
    const { error } = await supabase.from('clientas').upsert(toClientaRow(c), { onConflict: 'id' })
    if (error) { console.error('[db.upsertClienta]', error.message); throw error }
  },
  async deleteClienta(id: string) {
    if (!supabase) return
    await supabase.from('clientas').delete().eq('id', id)
  },

  // — Citas —
  async getCitas(): Promise<{ hoy: Cita[]; futuras: Cita[] }> {
    if (!supabase) return { hoy: [], futuras: [] }
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('citas').select('*')
    const all = (data ?? []).map(mapCita)
    return {
      hoy:    all.filter(c => !c.fecha || c.fecha === today),
      futuras: all.filter(c => c.fecha && c.fecha > today),
    }
  },
  async upsertCita(c: Partial<Cita> & { id: string }) {
    if (!supabase) return
    const { error } = await supabase.from('citas').upsert(toCitaRow(c), { onConflict: 'id' })
    if (error) console.error('[db.upsertCita]', error.message)
  },
  async deleteCita(id: string) {
    if (!supabase) return
    await supabase.from('citas').delete().eq('id', id)
  },

  // — Ventas —
  async getVentas(): Promise<Venta[]> {
    if (!supabase) return []
    const [{ data: ventas }, { data: lineas }] = await Promise.all([
      supabase.from('ventas').select('*').order('fecha', { ascending: false }),
      supabase.from('lineas_venta').select('*'),
    ])
    return (ventas ?? []).map(v => mapVenta(v, lineas ?? []))
  },
  async addVenta(v: Venta) {
    if (!supabase) return
    const { error } = await supabase.from('ventas').insert({
      id: v.id, ticket: v.ticket, fecha: v.fecha, cliente: v.cliente,
      cliente_id: v.clienteId || null, pago: v.pago, estado: v.estado,
      descuento: v.desc, anticipo: v.anticipo, cita_id: v.citaId ?? null,
    })
    if (error) { console.error('[db.addVenta]', error.message); return }
    if (v.lineas.length > 0) {
      await supabase.from('lineas_venta').insert(
        v.lineas.map(l => ({
          venta_id: v.id, tipo: l.tipo, nombre: l.nombre,
          est: l.est ?? null, cant: l.cant, precio: l.precio, com: l.com,
        }))
      )
    }
  },
  async updateVenta(id: string, patch: Partial<Venta>) {
    if (!supabase) return
    const row: Record<string, unknown> = {}
    if (patch.estado    !== undefined) row.estado    = patch.estado
    if (patch.anticipo  !== undefined) row.anticipo  = patch.anticipo
    if (patch.desc      !== undefined) row.descuento = patch.desc
    if (patch.pago      !== undefined) row.pago      = patch.pago
    if (Object.keys(row).length) await supabase.from('ventas').update(row).eq('id', id)
  },
  async getVentaByCitaId(citaId: string): Promise<Venta | null> {
    if (!supabase) return null
    const { data: vRow } = await supabase.from('ventas').select('*').eq('cita_id', citaId).maybeSingle()
    if (!vRow) return null
    const { data: lineas } = await supabase.from('lineas_venta').select('*').eq('venta_id', vRow.id)
    return mapVenta(vRow, lineas ?? [])
  },

  // — Productos —
  async getProductos(): Promise<Producto[]> {
    if (!supabase) return []
    const { data } = await supabase.from('productos').select('*')
    return (data ?? []) as Producto[]
  },
  async upsertProducto(p: Producto) {
    if (!supabase) return
    const { error } = await supabase.from('productos').upsert(p, { onConflict: 'id' })
    if (error) console.error('[db.upsertProducto]', error.message)
  },
  async deleteProducto(id: string) {
    if (!supabase) return
    await supabase.from('productos').delete().eq('id', id)
  },

  // — Movimientos —
  async getMovimientos(): Promise<Movimiento[]> {
    if (!supabase) return []
    const { data } = await supabase.from('movimientos').select('*').order('fecha', { ascending: false }).limit(200)
    return (data ?? []) as Movimiento[]
  },
  async addMovimiento(m: Movimiento) {
    if (!supabase) return
    const { error } = await supabase.from('movimientos').insert(m)
    if (error) console.error('[db.addMovimiento]', error.message)
  },

  // — Gastos —
  async getGastos(): Promise<Gasto[]> {
    if (!supabase) return []
    const { data } = await supabase.from('gastos').select('*').order('fecha', { ascending: false })
    return (data ?? []) as Gasto[]
  },
  async upsertGasto(g: Gasto) {
    if (!supabase) return
    const { error } = await supabase.from('gastos').upsert(g, { onConflict: 'id' })
    if (error) console.error('[db.upsertGasto]', error.message)
  },
  async deleteGasto(id: string) {
    if (!supabase) return
    await supabase.from('gastos').delete().eq('id', id)
  },

  // — Bloqueos —
  async getBloqueos(): Promise<Bloqueo[]> {
    if (!supabase) return []
    const { data } = await supabase.from('bloqueos').select('*')
    return (data ?? []) as Bloqueo[]
  },
  async upsertBloqueo(b: Bloqueo) {
    if (!supabase) return
    const { error } = await supabase.from('bloqueos').upsert(b, { onConflict: 'id' })
    if (error) console.error('[db.upsertBloqueo]', error.message)
  },
  async deleteBloqueo(id: string) {
    if (!supabase) return
    await supabase.from('bloqueos').delete().eq('id', id)
  },

  // — Plantillas —
  async getPlantillas(): Promise<Plantilla[]> {
    if (!supabase) return []
    const { data } = await supabase.from('plantillas').select('*')
    return (data ?? []) as Plantilla[]
  },
  async upsertPlantilla(p: Plantilla) {
    if (!supabase) return
    const { error } = await supabase.from('plantillas').upsert(p, { onConflict: 'id' })
    if (error) console.error('[db.upsertPlantilla]', error.message)
  },

  // — Usuarios —
  async getUsuarios(): Promise<Usuario[]> {
    if (!supabase) return []
    const { data, error } = await supabase.from('usuarios').select('*')
    if (error) console.error('[db.getUsuarios]', error.message)
    return (data ?? []) as Usuario[]
  },
  async getUsuarioById(id: string): Promise<Usuario | null> {
    if (!supabase) return null
    const { data, error } = await supabase.from('usuarios').select('*').eq('id', id).maybeSingle()
    if (error) console.error('[db.getUsuarioById]', error.message)
    return data as Usuario | null
  },
  async getUsuarioByAuthId(authUserId: string): Promise<Usuario | null> {
    if (!supabase) return null
    const { data, error } = await supabase.from('usuarios').select('*').eq('auth_user_id', authUserId).maybeSingle()
    if (error) console.error('[db.getUsuarioByAuthId]', error.message)
    return data as Usuario | null
  },
  async upsertUsuario(u: Usuario): Promise<Usuario> {
    if (!supabase) throw new Error('Sin conexión a Supabase')
    const { data, error } = await supabase
      .from('usuarios')
      .upsert(u, { onConflict: 'id' })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as Usuario
  },
  async getUsuarioByEmailOrTel(query: string): Promise<Usuario | null> {
    if (!supabase) return null
    const q = query.toLowerCase().trim()
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .or(`email.eq.${q},tel.eq.${q}`)
      .eq('activo', true)
      .maybeSingle()
    if (error) console.error('[db.getUsuarioByEmailOrTel]', error.message)
    return data as Usuario | null
  },
  async clearUsuarioAvatar(id: string): Promise<Usuario> {
    if (!supabase) throw new Error('Sin conexión a Supabase')
    const { data, error } = await supabase
      .from('usuarios')
      .update({ avatar: null })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as Usuario
  },

  // ─── Carga completa desde Supabase ────────────────────────────────────────
  async loadAll() {
    if (!supabase) return null
    const results = await Promise.allSettled([
      db.getConfig(),
      db.getEstilistas(),
      db.getServicios(),
      db.getClientas(),
      db.getCitas(),
      db.getVentas(),
      db.getProductos(),
      db.getPlantillas(),
      db.getUsuarios(),
      db.getMovimientos(),
      db.getBloqueos(),
      db.getGastos(),
    ])
    const [cfg, est, srv, cl, citas, ventas, prod, plant, usr, movs, blqs, gsts] = results
    return {
      config:      cfg.status    === 'fulfilled' ? cfg.value    : null,
      estilistas:  est.status    === 'fulfilled' ? est.value    : [],
      servicios:   srv.status    === 'fulfilled' ? srv.value    : [],
      clientas:    cl.status     === 'fulfilled' ? cl.value     : [],
      citas:       citas.status  === 'fulfilled' ? citas.value  : { hoy: [], futuras: [] },
      ventas:      ventas.status === 'fulfilled' ? ventas.value : [],
      productos:   prod.status   === 'fulfilled' ? prod.value   : [],
      plantillas:  plant.status  === 'fulfilled' ? plant.value  : [],
      usuarios:    usr.status    === 'fulfilled' ? usr.value    : [],
      movimientos: movs.status   === 'fulfilled' ? movs.value   : [],
      bloqueos:    blqs.status   === 'fulfilled' ? blqs.value   : [],
      gastos:      gsts.status   === 'fulfilled' ? gsts.value   : [],
    }
  },

  // ─── Migración: sube todos los datos locales a Supabase ───────────────────
  async seedAll(data: RBData): Promise<boolean> {
    if (!supabase) return false
    try {
      await db.saveConfig(data.config)

      if (data.estilistas.length)
        await supabase.from('estilistas').upsert(data.estilistas, { onConflict: 'id' })

      if (data.servicios.length)
        await supabase.from('servicios').upsert(data.servicios, { onConflict: 'id' })

      if (data.clientas.length)
        await supabase.from('clientas').upsert(data.clientas.map(toClientaRow), { onConflict: 'id' })

      const allCitas = [...data.hoy, ...(data.citasFuturas || [])]
      if (allCitas.length)
        await supabase.from('citas').upsert(allCitas.map(toCitaRow), { onConflict: 'id' })

      if (data.productos.length)
        await supabase.from('productos').upsert(data.productos, { onConflict: 'id' })

      if (data.plantillas.length)
        await supabase.from('plantillas').upsert(data.plantillas, { onConflict: 'id' })

      if (data.usuarios.length)
        await supabase.from('usuarios').upsert(data.usuarios, { onConflict: 'id' })

      for (const v of data.ventas) {
        await supabase.from('ventas').upsert({
          id: v.id, ticket: v.ticket, fecha: v.fecha, cliente: v.cliente,
          cliente_id: v.clienteId || null, pago: v.pago, estado: v.estado,
          descuento: v.desc, anticipo: v.anticipo,
        }, { onConflict: 'id' })
        await supabase.from('lineas_venta').delete().eq('venta_id', v.id)
        if (v.lineas.length) {
          await supabase.from('lineas_venta').insert(
            v.lineas.map(l => ({
              venta_id: v.id, tipo: l.tipo, nombre: l.nombre,
              est: l.est ?? null, cant: l.cant, precio: l.precio, com: l.com,
            }))
          )
        }
      }

      if (data.movimientos.length)
        await supabase.from('movimientos').upsert(data.movimientos, { onConflict: 'id' })

      if (data.bloqueos?.length)
        await supabase.from('bloqueos').upsert(data.bloqueos, { onConflict: 'id' })

      if (data.gastos?.length)
        await supabase.from('gastos').upsert(data.gastos, { onConflict: 'id' })

      return true
    } catch (e) {
      console.error('[db.seedAll]', e)
      return false
    }
  },
}

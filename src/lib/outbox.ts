import { db } from './db'
import { supabase } from './supabase'
import { offlineDb, type OutboxEntityType, type OutboxOperation, type OutboxItem, type ConflictType } from './offlineDb'
import type { Cita, Clienta, Venta } from '../types'

// ─── Clasificación de errores ───────────────────────────────────────────────
// Regla central de todo el motor de sync: si el error trae un código de
// Postgres/PostgREST, el servidor sí respondió y rechazó el cambio a
// propósito → es un conflicto real, nunca se reintenta solo. Si no trae
// código, la petición nunca llegó a tener respuesta (fetch falló) → es una
// falla de red genuina, se reintenta con backoff. db.ts relanza el error
// crudo de supabase-js (con .code) en las funciones de escritura en alcance
// — ver comentarios en db.ts sobre por qué ya no se envuelve en `new Error`.
export type ClassifiedError =
  | { kind: 'conflict'; conflictType: ConflictType }
  | { kind: 'auth' }
  | { kind: 'network' }

export function classifyError(err: unknown): ClassifiedError {
  const code = (err as { code?: string } | null)?.code
  const message = String((err as { message?: string } | null)?.message || '')

  if (!code) return { kind: 'network' }

  if (code === 'P0001' && /ya existe una cita/i.test(message)) {
    return { kind: 'conflict', conflictType: 'overlap' }
  }
  if (code === '23505') {
    // La única unique-violation posible en las 3 entidades en alcance es el
    // teléfono de clientas (idx_clientas_tel_unico).
    return { kind: 'conflict', conflictType: 'duplicate_phone' }
  }
  if (code === '42501' || /row-level security|permission denied/i.test(message)) {
    return { kind: 'conflict', conflictType: 'rls_denied' }
  }
  if (code === 'PGRST301' || /jwt|token is expired/i.test(message)) {
    return { kind: 'auth' }
  }
  // Código desconocido: el servidor sí contestó y rechazó — se trata como
  // conflicto (necesita revisión humana) en vez de reintentar algo que
  // probablemente fallará siempre igual.
  return { kind: 'conflict', conflictType: null }
}

// ─── Pub/sub para que la UI (topbar, bandeja de conflictos) reaccione ───────
export type OutboxEvent =
  | { type: 'synced'; entityType: OutboxEntityType; id: string; result?: unknown }
  | { type: 'conflict'; entityType: OutboxEntityType; id: string; conflictType: ConflictType }
  | { type: 'queued'; entityType: OutboxEntityType; id: string }
  | { type: 'counts'; pending: number; conflict: number }

const listeners = new Set<(e: OutboxEvent) => void>()

export function subscribeOutbox(listener: (e: OutboxEvent) => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function emit(e: OutboxEvent) { listeners.forEach(l => l(e)) }

async function emitCounts() {
  const pending = await offlineDb.outbox.where('status').anyOf('pending', 'sending').count()
  const conflict = await offlineDb.outbox.where('status').equals('conflict').count()
  emit({ type: 'counts', pending, conflict })
}

async function getCurrentUserId(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.id ?? null
}

// ─── Encolar ─────────────────────────────────────────────────────────────
// El id de cada renglón de la cola ES el id de la propia entidad (cita/
// clienta/venta) — permite "coalescer": una segunda edición offline del
// mismo registro sobrescribe el mismo renglón en vez de encolar una
// operación aparte que podría reproducirse fuera de orden.
export async function enqueue(entityType: OutboxEntityType, operation: OutboxOperation, id: string, payload: unknown): Promise<void> {
  const existing = await offlineDb.outbox.get(id)

  let mergedPayload = payload
  let mergedOperation = operation

  if (existing && entityType === 'venta' && existing.operation === 'upsert' && operation === 'update') {
    // La venta todavía no se creó en el servidor — no tiene caso mandar un
    // "update" aparte, se funde el patch directo en la venta pendiente.
    const { patch } = payload as { patch: Partial<Venta> }
    mergedPayload = { ...(existing.payload as Venta), ...patch }
    mergedOperation = 'upsert'
  } else if (existing && entityType === 'venta' && existing.operation === 'upsert' && operation === 'delete') {
    // Nunca llegó a existir en el servidor — se cancela sin más, no hay nada que borrar allá.
    await offlineDb.outbox.delete(id)
    await emitCounts()
    return
  }

  const userId = existing?.userId ?? await getCurrentUserId()
  const item: OutboxItem = {
    id, entityType, operation: mergedOperation, payload: mergedPayload, userId,
    createdAt: existing?.createdAt ?? Date.now(),
    attempts: 0, lastAttemptAt: null, lastError: null,
    status: 'pending', conflictType: null,
  }
  await offlineDb.outbox.put(item)
  emit({ type: 'queued', entityType, id })
  await emitCounts()
  if (navigator.onLine) void processOutbox()
}

// ─── Reproducir un renglón contra Supabase ──────────────────────────────────
async function replayItem(item: OutboxItem): Promise<{ ok: true; result?: unknown } | { ok: false; classified: ClassifiedError }> {
  try {
    let result: unknown
    if (item.entityType === 'cita') {
      if (item.operation === 'delete') await db.deleteCita(item.id)
      else await db.upsertCita(item.payload as Partial<Cita> & { id: string })
    } else if (item.entityType === 'clienta') {
      if (item.operation === 'delete') await db.deleteClienta(item.id)
      else await db.upsertClienta(item.payload as Clienta)
    } else {
      if (item.operation === 'delete') await db.deleteVenta(item.id)
      else if (item.operation === 'update') {
        const { patch } = item.payload as { patch: Partial<Venta> }
        await db.updateVenta(item.id, patch)
      } else {
        result = await db.addVenta(item.payload as Venta)
      }
    }
    return { ok: true, result }
  } catch (err) {
    return { ok: false, classified: classifyError(err) }
  }
}

// ─── Drenar la cola ──────────────────────────────────────────────────────
let draining = false

export async function processOutbox(): Promise<void> {
  if (draining) return
  draining = true
  try {
    const types: OutboxEntityType[] = ['cita', 'clienta', 'venta']
    for (const entityType of types) {
      const items = await offlineDb.outbox
        .where('entityType').equals(entityType)
        .filter(i => i.status === 'pending')
        .sortBy('createdAt')

      for (const item of items) {
        // Backoff exponencial acotado tras un fallo de red — evita
        // martillar Supabase con una conexión intermitente.
        if (item.lastAttemptAt) {
          const waitMs = Math.min(30000, 5000 * Math.pow(2, Math.min(item.attempts, 3)))
          if (Date.now() - item.lastAttemptAt < waitMs) continue
        }

        await offlineDb.outbox.update(item.id, { status: 'sending', lastAttemptAt: Date.now(), attempts: item.attempts + 1 })
        const outcome = await replayItem(item)

        if (outcome.ok === true) {
          await offlineDb.outbox.delete(item.id)
          emit({ type: 'synced', entityType, id: item.id, result: outcome.result })
        } else if (outcome.classified.kind === 'network' || outcome.classified.kind === 'auth') {
          await offlineDb.outbox.update(item.id, { status: 'pending', lastError: outcome.classified.kind })
          // Sigue sin haber red real — no tiene caso seguir con el resto de
          // este tipo ahora mismo, se reintenta en el próximo disparador.
          if (outcome.classified.kind === 'network') break
        } else {
          await offlineDb.outbox.update(item.id, {
            status: 'conflict',
            conflictType: outcome.classified.conflictType,
            lastError: outcome.classified.conflictType ?? 'desconocido',
          })
          emit({ type: 'conflict', entityType, id: item.id, conflictType: outcome.classified.conflictType })
        }
      }
    }
  } finally {
    draining = false
    await emitCounts()
  }
}

// ─── Disparadores de sincronización ─────────────────────────────────────
let started = false

export function startSyncEngine(): void {
  if (started) return
  started = true
  window.addEventListener('online', () => { void processOutbox() })
  // navigator.onLine da falsos positivos (LAN sin salida real a internet) —
  // este timer es el respaldo real: la señal de verdad es si el último
  // intento trajo o no un código de error de Postgres/PostgREST.
  setInterval(() => { void processOutbox() }, 25000)
  if (navigator.onLine) void processOutbox()
  void emitCounts()
}

// ─── Consultas de apoyo (loadFromSupabase, bandeja de conflictos) ──────────

// ids que loadFromSupabase debe proteger de un reemplazo ciego por los datos
// del servidor — todavía no sincronizados, o en conflicto pendiente de
// resolver (su versión local es la única que existe hasta que se resuelva).
export async function getProtectedIds(entityType: OutboxEntityType): Promise<Set<string>> {
  const items = await offlineDb.outbox
    .where('entityType').equals(entityType)
    .filter(i => i.status !== 'done')
    .toArray()
  return new Set(items.map(i => i.id))
}

export async function getConflictItems(): Promise<OutboxItem[]> {
  return offlineDb.outbox.where('status').equals('conflict').toArray()
}

export async function discardOutboxItem(id: string): Promise<void> {
  await offlineDb.outbox.delete(id)
  await emitCounts()
}

export async function retryOutboxItem(id: string): Promise<void> {
  await offlineDb.outbox.update(id, { status: 'pending', attempts: 0, lastAttemptAt: null, conflictType: null })
  void processOutbox()
}

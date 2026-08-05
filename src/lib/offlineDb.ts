import Dexie, { type Table } from 'dexie'

export type OutboxEntityType = 'cita' | 'clienta' | 'venta'
export type OutboxOperation = 'upsert' | 'update' | 'delete'
export type OutboxStatus = 'pending' | 'sending' | 'conflict' | 'done'
export type ConflictType = 'overlap' | 'duplicate_phone' | 'rls_denied' | null

// Un renglón por entidad pendiente de sincronizar — el id es el mismo id
// (client-generado) de la cita/clienta/venta, no uno propio de la cola. Así,
// si se edita 2 veces offline el mismo registro, la segunda edición
// sobrescribe este mismo renglón en vez de encolar una operación aparte que
// podría reproducirse fuera de orden.
export interface OutboxItem {
  id: string
  entityType: OutboxEntityType
  operation: OutboxOperation
  // Argumentos exactos que ya recibe la función correspondiente de db.ts —
  // ver replayItem en outbox.ts para el mapeo por entityType/operation.
  payload: unknown
  userId: string | null
  createdAt: number
  attempts: number
  lastAttemptAt: number | null
  lastError: string | null
  status: OutboxStatus
  conflictType: ConflictType
}

class OfflineDatabase extends Dexie {
  outbox!: Table<OutboxItem, string>

  constructor() {
    super('rb_offline')
    this.version(1).stores({
      // Índices en entityType/status: el motor de sync recorre "pendientes
      // por tipo de entidad" y la bandeja de conflictos filtra por status.
      outbox: 'id, entityType, status, createdAt',
    })
  }
}

export const offlineDb = new OfflineDatabase()

import type { VisitStatus } from '../../domain/enums'
import type { StoreVisit, StoreVisitWithCustomer } from '../../domain/models/store-visit'

export interface NewStoreVisit {
  userId: string
  entryTokenJti: string
  gateId: string
}

export interface StoreVisitQuery {
  status: VisitStatus
  limit: number
}

/** Cierre de una visita ACTIVE por el webhook de salida */
export interface VisitClosing {
  visitId: string
  exitEventId: string
  exitedAt: Date
}

export interface StoreVisitRepository {
  /**
   * En una transacción (serializada por cliente): marca ABANDONED la visita ACTIVE previa del cliente, si la hay,
   * y abre la nueva.
   * @throws ConflictError `ENTRY_TOKEN_REUSED` si el `jti` ya se usó
   */
  open(visit: NewStoreVisit): Promise<StoreVisit>
  /**
   * Cierra como COMPLETED una visita sin venta.
   * @throws ConflictError `VISIT_CLOSED` si ya no estaba ACTIVE · `EVENT_ID_CONFLICT` si el evento ya cerró otra visita
   */
  complete(closing: VisitClosing): Promise<void>
  findById(id: string): Promise<StoreVisit | null>
  findByExitEventId(exitEventId: string): Promise<StoreVisit | null>
  /** La visita ACTIVE más reciente de cualquier cliente (ShelfSight asume un cliente a la vez frente a la repisa) */
  findLatestActive(): Promise<StoreVisit | null>
  findActiveByUser(userId: string): Promise<StoreVisit | null>
  /** Más recientes primero, con el nombre del cliente */
  list(query: StoreVisitQuery): Promise<StoreVisitWithCustomer[]>
}

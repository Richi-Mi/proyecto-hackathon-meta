import type { ShelfAction, ShelfEventStatus } from '../../domain/enums'
import type { ShelfEvent, ShelfEventFrames, ShelfReviewReason } from '../../domain/models/shelf-event'
import type { Page, PageRequest } from '../common/pagination'

export interface NewShelfEvent {
  cameraId: string
  status: ShelfEventStatus
  action: ShelfAction
  productId: string | null
  quantity: number
  confidence: number | null
  reviewReason: ShelfReviewReason | null
  note: string | null
  model: string | null
  changeRatio: number | null
  visitId?: string | null
  capturedAt: Date
  frames: ShelfEventFrames
  resolvedAt?: Date | null
  resolvedBy?: string | null
}

export interface ShelfEventResolution {
  status: ShelfEventStatus
  action?: ShelfAction
  productId?: string | null
  quantity?: number
  reviewReason?: ShelfReviewReason | null
  movementId?: string | null
  visitId?: string | null
  resolvedBy?: string | null
  resolvedAt?: Date | null
}

export interface ShelfEventRepository {
  create(event: NewShelfEvent): Promise<ShelfEvent>
  findById(id: string): Promise<ShelfEvent | null>
  findFrames(id: string): Promise<ShelfEventFrames | null>
  list(filters: { status?: ShelfEventStatus }, page: PageRequest): Promise<Page<ShelfEvent>>
  /**
   * Cambia el estado solo si el actual está en `from` (evita aplicar dos veces el mismo evento).
   * Devuelve el evento actualizado, o null si el estado ya no era uno de `from`.
   */
  /** Carrito virtual de la visita: Σ eventos APPLIED (salida suma, entrada resta), solo productos con piezas > 0 */
  cart(visitId: string): Promise<Map<string, number>>
  transition(id: string, from: ShelfEventStatus[], changes: ShelfEventResolution): Promise<ShelfEvent | null>
}

import type { ShelfAction, ShelfEventStatus } from '../enums'

/** Por qué un evento de la cámara no se aplicó solo y quedó en la cola de revisión. */
export const SHELF_REVIEW_REASONS = [
  'VISION_UNAVAILABLE',
  'VISION_ERROR',
  'UNKNOWN_PRODUCT',
  'LOW_CONFIDENCE',
  'QUANTITY_TOO_HIGH',
  'INSUFFICIENT_STOCK',
  /** Regresaron a la repisa más piezas de las que el cliente llevaba en su carrito */
  'NOT_IN_CART',
] as const
export type ShelfReviewReason = (typeof SHELF_REVIEW_REASONS)[number]

/** Una interacción con la repisa: foto antes/después + lo que interpretó la visión + su efecto en el stock. */
export interface ShelfEvent {
  id: string
  cameraId: string
  status: ShelfEventStatus
  action: ShelfAction
  productId: string | null
  productName: string | null
  quantity: number
  /** 0–1, según el modelo de visión; null si no hubo análisis */
  confidence: number | null
  reviewReason: ShelfReviewReason | null
  /** Explicación del modelo o del error */
  note: string | null
  model: string | null
  /** Fracción de la imagen que cambió entre antes y después (detector de movimiento del teléfono) */
  changeRatio: number | null
  movementId: string | null
  /** Visita (cliente dentro de la tienda) a cuyo carrito se aplicó el evento; null = movimiento de inventario */
  visitId: string | null
  capturedAt: Date
  createdAt: Date
  resolvedAt: Date | null
  resolvedBy: string | null
}

export interface ShelfEventFrames {
  before: ShelfImage
  after: ShelfImage
}

export interface ShelfImage {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  data: Uint8Array
}

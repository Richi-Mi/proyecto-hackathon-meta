import type { ShelfAction, ShelfEventStatus, ShelfReviewReason } from '@/lib/api/types'

export const SHELF_STATUS: Record<ShelfEventStatus, { label: string; className: string }> = {
  APPLIED: { label: 'Aplicado', className: 'bg-emerald-100 text-emerald-700' },
  PENDING_REVIEW: { label: 'Por revisar', className: 'bg-amber-100 text-amber-700' },
  NO_CHANGE: { label: 'Sin cambio', className: 'bg-muted text-muted-foreground' },
  REJECTED: { label: 'Descartado', className: 'bg-muted text-muted-foreground line-through' },
}

export const SHELF_ACTION: Record<ShelfAction, string> = {
  REMOVED: 'Salió',
  ADDED: 'Entró',
  MOVED: 'Se movió',
  NONE: 'Sin cambio',
}

export const SHELF_REVIEW_REASON: Record<ShelfReviewReason, string> = {
  VISION_UNAVAILABLE: 'Sin modelo de visión configurado',
  VISION_ERROR: 'Falló el modelo de visión',
  UNKNOWN_PRODUCT: 'No reconoció el producto',
  LOW_CONFIDENCE: 'Confianza baja',
  QUANTITY_TOO_HIGH: 'Muchas piezas en un solo evento',
  INSUFFICIENT_STOCK: 'No hay suficiente stock registrado',
}

/** "−2 Coca-Cola 600 ml" / "+12 Sabritas" */
export function describeShelfEvent(event: { action: ShelfAction; quantity: number; product: { id: string; name: string | null } | null }) {
  if (event.action !== 'REMOVED' && event.action !== 'ADDED') return SHELF_ACTION[event.action]
  const sign = event.action === 'REMOVED' ? '−' : '+'
  const name = event.product ? (event.product.name ?? event.product.id) : 'producto desconocido'
  return `${sign}${event.quantity} ${name}`
}

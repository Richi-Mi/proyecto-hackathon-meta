export enum Role {
  OWNER = 'OWNER',
  CUSTOMER = 'CUSTOMER',
}

export enum ProductStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DISCONTINUED = 'DISCONTINUED',
}

export enum VisitStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  ABANDONED = 'ABANDONED',
}

export enum SaleType {
  AUTOMATED = 'AUTOMATED',
  MANUAL = 'MANUAL',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  TRANSFER = 'TRANSFER',
  /** Cobro automático con el método guardado del cliente (flujo Smart Store). */
  CARD_ON_FILE = 'CARD_ON_FILE',
}

export enum PaymentStatus {
  PAID = 'PAID',
  PENDING = 'PENDING',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum SaleStatus {
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum MovementType {
  SALE = 'SALE',
  CANCELLATION = 'CANCELLATION',
  RESTOCK = 'RESTOCK',
  ADJUSTMENT = 'ADJUSTMENT',
}

/** Resultado de un evento de la cámara de repisa (ShelfSight). */
export enum ShelfEventStatus {
  /** El movimiento de inventario ya se aplicó (automático o confirmado por el dueño). */
  APPLIED = 'APPLIED',
  /** Espera a que el dueño lo confirme o lo descarte. */
  PENDING_REVIEW = 'PENDING_REVIEW',
  /** El modelo no vio cambio de producto (alguien pasó la mano, se acomodó algo). */
  NO_CHANGE = 'NO_CHANGE',
  /** El dueño lo descartó. */
  REJECTED = 'REJECTED',
}

/** Lo que la visión cree que pasó en la repisa. */
export enum ShelfAction {
  REMOVED = 'REMOVED',
  ADDED = 'ADDED',
  MOVED = 'MOVED',
  NONE = 'NONE',
}

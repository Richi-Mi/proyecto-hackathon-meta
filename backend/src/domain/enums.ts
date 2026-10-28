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

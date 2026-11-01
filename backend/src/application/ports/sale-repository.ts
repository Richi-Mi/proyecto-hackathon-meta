import type { PaymentMethod, PaymentStatus, ProductStatus, SaleStatus, SaleType } from '../../domain/enums'
import type { Sale, SaleItem } from '../../domain/models/sale'
import type { Page, PageRequest } from '../common/pagination'
import type { VisitClosing } from './store-visit-repository'

export interface SaleFilters {
  /** Incluido */
  from?: Date
  /** Excluido */
  to?: Date
  type?: SaleType
  status?: SaleStatus
  paymentMethod?: PaymentMethod
  folio?: number
  customerId?: string
}

export interface CancellationDraft {
  cancelledById: string
  reason: string
  /** PAID → REFUNDED; los cobros pendientes o fallidos conservan su estado */
  paymentStatus: PaymentStatus
}

/** Producto bloqueado (FOR UPDATE) durante el registro de la venta */
export interface LockedProduct {
  id: string
  name: string
  price: number
  purchaseCost: number
  taxRate: number
  stock: number
  status: ProductStatus
}

export interface SaleDraft {
  saleType: SaleType
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  /** Por defecto, ahora */
  dateTime?: Date
  customerId: string | null
  cashierId: string | null
  externalEventId: string | null
  paymentReference: string | null
  subtotal: number
  taxAmount: number
  totalAmount: number
  cashReceived: number | null
  changeGiven: number | null
  items: Omit<SaleItem, 'id'>[]
  /** Solo AUTOMATED: la visita se cierra (COMPLETED) en la misma transacción que la venta */
  visit?: VisitClosing
}

export interface PaymentResult {
  paymentStatus: PaymentStatus
  paymentReference: string | null
}

export interface SaleRepository {
  /**
   * En una transacción: bloquea los productos (orden por id, sin deadlocks), ejecuta `build`
   * —que aplica las reglas de negocio y puede lanzar errores— y persiste la venta, sus partidas,
   * el descuento de stock y los movimientos SALE del kardex. Los productos inexistentes o dados
   * de baja no aparecen en el mapa.
   * @throws ConflictError `DUPLICATE_SALE_EVENT` si `externalEventId` ya existe · `VISIT_CLOSED` si la visita
   * ya no estaba ACTIVE · `EVENT_ID_CONFLICT` si el evento ya cerró otra visita
   */
  recordSale(productIds: string[], build: (products: Map<string, LockedProduct>) => SaleDraft): Promise<Sale>
  /**
   * En una transacción: bloquea la venta, ejecuta `apply` —que valida si se puede cancelar y puede
   * lanzar errores (también el reembolso en la pasarela, que así revierte la cancelación si falla)—, repone el stock
   * de cada partida con movimientos CANCELLATION y marca la venta. Devuelve null si la venta no existe.
   */
  cancel(saleId: string, apply: (sale: Sale) => CancellationDraft | Promise<CancellationDraft>): Promise<Sale | null>
  /** Registra el resultado del cobro de una venta con pago PENDING; si ya no estaba PENDING no la toca. */
  setPaymentResult(saleId: string, result: PaymentResult): Promise<Sale>
  /** Orden: más recientes primero */
  list(filters: SaleFilters, page: PageRequest): Promise<Page<Sale>>
  findById(id: string): Promise<Sale | null>
  findByExternalEventId(externalEventId: string): Promise<Sale | null>
  count(): Promise<number>
}

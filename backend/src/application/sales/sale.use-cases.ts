import { PaymentMethod, PaymentStatus, ProductStatus, Role, SaleStatus, SaleType } from '../../domain/enums'
import { ConflictError, InvalidInputError, NotFoundError, UnprocessableError } from '../../domain/errors'
import { roundMoney } from '../../domain/money'
import type { BusinessProfile } from '../../domain/models/business-profile'
import type { Sale } from '../../domain/models/sale'
import { toBusinessProfile } from '../../domain/models/store-settings'
import { priceLine, priceSale, taxBreakdown, type TaxBreakdownLine } from '../../domain/sales/pricing'
import type { Page, PageRequest } from '../common/pagination'
import type { PaymentGateway } from '../ports/payment-gateway'
import type { LockedProduct, SaleDraft, SaleFilters, SaleRepository } from '../ports/sale-repository'
import type { StoreSettingsRepository } from '../ports/store-settings-repository'
import type { UserRepository } from '../ports/user-repository'

export interface ManualSaleInput {
  items: { productId: string; quantity: number }[]
  paymentMethod: PaymentMethod.CASH | PaymentMethod.CARD | PaymentMethod.TRANSFER
  cashReceived?: number
  paymentReference?: string
  customerId?: string | null
}

export interface ManualSaleOptions {
  /** Header Idempotency-Key: reintentos con la misma llave devuelven la misma venta */
  idempotencyKey?: string
  /** Solo para el seed (ventas históricas); no se expone por HTTP */
  at?: Date
}

export interface Receipt {
  business: BusinessProfile
  sale: Sale
  taxBreakdown: TaxBreakdownLine[]
  printedAt: Date
}

export class SaleUseCases {
  constructor(
    private readonly sales: SaleRepository,
    private readonly users: UserRepository,
    private readonly settings: StoreSettingsRepository,
    private readonly gateway: PaymentGateway,
  ) {}

  list(filters: SaleFilters, page: PageRequest): Promise<Page<Sale>> {
    if (filters.from && filters.to && filters.from >= filters.to) {
      throw new InvalidInputError('INVALID_RANGE', '`from` debe ser anterior a `to`')
    }
    return this.sales.list(filters, page)
  }

  async getById(id: string): Promise<Sale> {
    const sale = await this.sales.findById(id)
    if (!sale) throw new NotFoundError('SALE_NOT_FOUND', `No existe la venta ${id}`)
    return sale
  }

  /** Datos para reimprimir el ticket: negocio, venta y desglose de IVA por tasa. */
  async getReceipt(id: string): Promise<Receipt> {
    const [sale, settings] = await Promise.all([this.getById(id), this.settings.get()])
    return { business: toBusinessProfile(settings), sale, taxBreakdown: taxBreakdown(sale.items), printedAt: new Date() }
  }

  /**
   * Cancela la venta completa: repone el stock y marca el pago como reembolsado. Un cobro CARD_ON_FILE se reembolsa
   * en la pasarela dentro de la transacción (con la venta bloqueada: no hay doble reembolso); si falla, no se cancela.
   */
  async cancel(id: string, actorId: string, reason: string): Promise<Sale> {
    const trimmed = reason.trim()
    if (trimmed.length < 3) throw new InvalidInputError('INVALID_REASON', 'Indica el motivo de la cancelación')

    const cancelled = await this.sales.cancel(id, async (sale) => {
      if (sale.status === SaleStatus.CANCELLED) {
        throw new ConflictError('SALE_ALREADY_CANCELLED', `El ticket #${sale.folio} ya estaba cancelado`)
      }
      if (sale.paymentMethod === PaymentMethod.CARD_ON_FILE && sale.paymentStatus === PaymentStatus.PAID) {
        await this.refund(sale)
      }
      return {
        cancelledById: actorId,
        reason: trimmed,
        paymentStatus: sale.paymentStatus === PaymentStatus.PAID ? PaymentStatus.REFUNDED : sale.paymentStatus,
      }
    })
    if (!cancelled) throw new NotFoundError('SALE_NOT_FOUND', `No existe la venta ${id}`)
    return cancelled
  }

  private async refund(sale: Sale) {
    try {
      if (!sale.paymentReference) throw new Error('La venta no tiene referencia de cobro')
      await this.gateway.refund({ transactionId: sale.paymentReference, amount: sale.totalAmount, reference: sale.id })
    } catch (error) {
      console.error(`Reembolso del ticket #${sale.folio} rechazado`, error)
      throw new UnprocessableError('REFUND_FAILED', `La pasarela no pudo reembolsar el ticket #${sale.folio}; intenta de nuevo`)
    }
  }

  /** Venta de mostrador: precios e impuestos se calculan con los datos bloqueados en la base, nunca con los del cliente. */
  async createManualSale(input: ManualSaleInput, cashierId: string, options: ManualSaleOptions = {}): Promise<Sale> {
    const externalEventId = options.idempotencyKey ? `pos:${options.idempotencyKey}` : null
    if (externalEventId) {
      const previous = await this.sales.findByExternalEventId(externalEventId)
      if (previous) return previous
    }

    const quantities = mergeQuantities(input.items)
    if (input.paymentMethod === PaymentMethod.CASH && input.cashReceived === undefined) {
      throw new InvalidInputError('CASH_RECEIVED_REQUIRED', 'Indica con cuánto paga el cliente en efectivo')
    }
    if (input.customerId) {
      const customer = await this.users.findById(input.customerId)
      if (customer?.role !== Role.CUSTOMER) {
        throw new InvalidInputError('CUSTOMER_NOT_FOUND', `No existe el cliente ${input.customerId}`)
      }
    }

    try {
      return await this.sales.recordSale([...quantities.keys()], (products) =>
        buildManualSale(input, quantities, products, { cashierId, externalEventId, at: options.at }),
      )
    } catch (error) {
      // Dos peticiones simultáneas con la misma llave: gana la primera y ambas reciben la misma venta
      if (externalEventId && error instanceof ConflictError && error.code === 'DUPLICATE_SALE_EVENT') {
        const winner = await this.sales.findByExternalEventId(externalEventId)
        if (winner) return winner
      }
      throw error
    }
  }
}

function mergeQuantities(items: ManualSaleInput['items']) {
  if (items.length === 0) throw new InvalidInputError('EMPTY_SALE', 'La venta debe tener al menos un producto')
  const quantities = new Map<string, number>()
  for (const { productId, quantity } of items) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new InvalidInputError('INVALID_QUANTITY', `Cantidad inválida para ${productId}`)
    }
    quantities.set(productId, (quantities.get(productId) ?? 0) + quantity)
  }
  return quantities
}

function buildManualSale(
  input: ManualSaleInput,
  quantities: Map<string, number>,
  products: Map<string, LockedProduct>,
  context: { cashierId: string; externalEventId: string | null; at?: Date },
): SaleDraft {
  const missing = [...quantities.keys()].filter((id) => !products.has(id))
  if (missing.length > 0) {
    throw new NotFoundError('PRODUCT_NOT_FOUND', `No existe el producto ${missing.join(', ')}`, { productIds: missing })
  }

  const lines = [...quantities].map(([productId, quantity]) => ({ product: products.get(productId)!, quantity }))

  const inactive = lines.filter(({ product }) => product.status !== ProductStatus.ACTIVE)
  if (inactive.length > 0) {
    throw new ConflictError(
      'PRODUCT_INACTIVE',
      `No se puede vender: ${inactive.map(({ product }) => product.name).join(', ')}`,
      { productIds: inactive.map(({ product }) => product.id) },
    )
  }

  const shortages = lines.filter(({ product, quantity }) => quantity > product.stock)
  if (shortages.length > 0) {
    throw new ConflictError(
      'INSUFFICIENT_STOCK',
      `Stock insuficiente: ${shortages.map(({ product }) => product.name).join(', ')}`,
      shortages.map(({ product, quantity }) => ({ productId: product.id, requested: quantity, available: product.stock })),
    )
  }

  const priced = lines.map(({ product, quantity }) => ({ product, quantity, unitPrice: product.price, taxRate: product.taxRate }))
  const totals = priceSale(priced)

  let cashReceived: number | null = null
  let changeGiven: number | null = null
  if (input.paymentMethod === PaymentMethod.CASH) {
    cashReceived = roundMoney(input.cashReceived ?? 0)
    if (cashReceived < totals.totalAmount) {
      throw new UnprocessableError(
        'CASH_INSUFFICIENT',
        `El efectivo recibido ($${cashReceived.toFixed(2)}) no cubre el total ($${totals.totalAmount.toFixed(2)})`,
      )
    }
    changeGiven = roundMoney(cashReceived - totals.totalAmount)
  }

  return {
    saleType: SaleType.MANUAL,
    paymentMethod: input.paymentMethod,
    paymentStatus: PaymentStatus.PAID,
    dateTime: context.at,
    customerId: input.customerId ?? null,
    cashierId: context.cashierId,
    externalEventId: context.externalEventId,
    paymentReference: input.paymentReference?.trim() || null,
    ...totals,
    cashReceived,
    changeGiven,
    items: priced.map(({ product, quantity, unitPrice, taxRate }) => ({
      productId: product.id,
      productName: product.name,
      quantity,
      unitPrice,
      unitCost: product.purchaseCost,
      taxRate,
      subtotal: priceLine({ quantity, unitPrice, taxRate }).total,
    })),
  }
}

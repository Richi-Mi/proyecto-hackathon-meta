import { PaymentMethod, PaymentStatus, ProductStatus, Role, SaleType, VisitStatus } from '../../domain/enums'
import {
  ConflictError,
  ForbiddenError,
  InvalidInputError,
  NotFoundError,
  UnauthorizedError,
  UnprocessableError,
} from '../../domain/errors'
import type { Sale } from '../../domain/models/sale'
import type { StoreVisit, StoreVisitWithCustomer } from '../../domain/models/store-visit'
import { priceLine, priceSale } from '../../domain/sales/pricing'
import type { EntryPassSigner } from '../ports/entry-pass-signer'
import type { PaymentGateway } from '../ports/payment-gateway'
import type { ProductRepository } from '../ports/product-repository'
import type { LockedProduct, SaleDraft, SaleRepository } from '../ports/sale-repository'
import type { DeviceKeyVerifier, WebhookSignatureVerifier } from '../ports/store-device-auth'
import type { StoreVisitQuery, StoreVisitRepository, VisitClosing } from '../ports/store-visit-repository'
import type { UserRepository } from '../ports/user-repository'

export interface StoreEntryInput {
  token: string
  gateId: string
}

export interface StoreEntry {
  visitId: string
  user: { id: string; name: string }
  enteredAt: Date
}

export interface CheckoutItemInput {
  productId?: string
  barcode?: string
  quantity: number
}

export interface CheckoutInput {
  eventId: string
  visitId: string
  exitedAt: Date
  items: CheckoutItemInput[]
}

export interface CheckoutResult {
  visitId: string
  saleId: string | null
  folio: number | null
  totalAmount: number
  /** null si la visita se cerró sin venta */
  paymentStatus: PaymentStatus | null
}

export interface SimulatedVisit extends CheckoutResult {
  customer: { id: string; name: string }
  itemCount: number
}

export interface StoreConfig {
  /** Correo del cliente que usa el simulador de visitas */
  simulationCustomerEmail: string
  entryPassTtlSeconds: number
}

/** Puerta por defecto cuando el teléfono del propietario no indica una */
export const DEFAULT_GATE_ID = 'PUERTA-TELEFONO'

/** Tolerancia ante relojes desfasados entre el sistema de cámaras y el servidor */
const CLOCK_SKEW_MS = 5 * 60 * 1000
/** Prefijo de `sales.external_event_id` para no chocar con las llaves de idempotencia del POS (`pos:`) */
const eventKey = (eventId: string) => `checkout:${eventId}`

/** Flujo automático (Smart Store): entrada con QR, salida por webhook de cámaras y cobro con el método guardado. */
export class StoreUseCases {
  constructor(
    private readonly users: UserRepository,
    private readonly visits: StoreVisitRepository,
    private readonly sales: SaleRepository,
    private readonly products: ProductRepository,
    private readonly signer: EntryPassSigner,
    private readonly gateway: PaymentGateway,
    private readonly devices: DeviceKeyVerifier,
    private readonly webhooks: WebhookSignatureVerifier,
    private readonly config: StoreConfig,
  ) {}

  assertDevice(deviceKey: string | undefined): void {
    if (!this.devices.isValid(deviceKey)) throw new UnauthorizedError('INVALID_DEVICE_KEY', 'Dispositivo no autorizado')
  }

  assertSignature(rawBody: string, signature: string | undefined): void {
    if (!this.webhooks.isValid(rawBody, signature)) throw new UnauthorizedError('INVALID_SIGNATURE', 'Firma del webhook inválida')
  }

  /** El escáner valida el QR (firma, expiración y un solo uso) y abre la visita. */
  async registerEntry({ token, gateId }: StoreEntryInput): Promise<StoreEntry> {
    const claims = await this.signer.verify(token)
    const user = claims && (await this.users.findById(claims.userId))
    if (!claims || user?.role !== Role.CUSTOMER) {
      throw new UnauthorizedError('INVALID_ENTRY_TOKEN', 'El código QR no es válido o ya expiró')
    }
    if (!user.isActive) throw new ForbiddenError('ACCOUNT_DISABLED', 'La cuenta está desactivada')

    const visit = await this.visits.open({ userId: user.id, entryTokenJti: claims.jti, gateId: gateId.trim() })
    return { visitId: visit.id, user: { id: user.id, name: user.name }, enteredAt: visit.enteredAt }
  }

  /**
   * Webhook de salida: registra la venta AUTOMATED (sin rechazar por stock), cierra la visita en la misma
   * transacción y después intenta el cobro. Idempotente por `eventId`.
   */
  async checkout(input: CheckoutInput): Promise<CheckoutResult> {
    const visit = await this.visits.findById(input.visitId)
    if (!visit) throw new NotFoundError('VISIT_NOT_FOUND', `No existe la visita ${input.visitId}`)
    if (visit.exitEventId === input.eventId) return this.previousResult(visit)
    if (visit.status !== VisitStatus.ACTIVE) {
      throw new ConflictError('VISIT_CLOSED', visit.status === VisitStatus.ABANDONED ? 'La visita fue abandonada' : 'La visita ya estaba cerrada')
    }
    if (await this.visits.findByExitEventId(input.eventId)) {
      throw new ConflictError('EVENT_ID_CONFLICT', `El evento ${input.eventId} ya cerró otra visita`)
    }
    if (input.exitedAt < visit.enteredAt || input.exitedAt.getTime() > Date.now() + CLOCK_SKEW_MS) {
      throw new InvalidInputError('INVALID_EXITED_AT', '`exitedAt` debe estar entre la entrada y el momento actual')
    }

    const quantities = await this.resolveItems(input.items)
    const closing: VisitClosing = { visitId: visit.id, exitEventId: input.eventId, exitedAt: input.exitedAt }

    let sale: Sale
    try {
      if (quantities.size === 0) {
        await this.visits.complete(closing)
        return { visitId: visit.id, saleId: null, folio: null, totalAmount: 0, paymentStatus: null }
      }
      sale = await this.sales.recordSale([...quantities.keys()], (products) =>
        buildAutomatedSale(quantities, products, { customerId: visit.userId, eventId: input.eventId, closing }),
      )
    } catch (error) {
      // Carrera con un reintento del mismo evento: gana el primero y ambos reciben la misma respuesta
      if (error instanceof ConflictError) {
        const current = await this.visits.findById(visit.id)
        if (current?.exitEventId === input.eventId) return this.previousResult(current)
      }
      throw error
    }

    return toResult(visit.id, await this.charge(sale, visit.userId))
  }

  /**
   * Puerta operada por el propietario: su teléfono lee el QR y abre la visita (mismas reglas que el escáner).
   * Un QR inválido es un dato inválido (422), no una sesión inválida: un 401 cerraría la sesión del propietario.
   */
  async admitAtGate({ token, gateId }: { token: string; gateId?: string }): Promise<StoreEntry> {
    try {
      return await this.registerEntry({ token, gateId: gateId?.trim() || DEFAULT_GATE_ID })
    } catch (error) {
      if (error instanceof UnauthorizedError && error.code === 'INVALID_ENTRY_TOKEN') {
        throw new UnprocessableError(error.code, error.message)
      }
      throw error
    }
  }

  listVisits(query: StoreVisitQuery): Promise<StoreVisitWithCustomer[]> {
    return this.visits.list(query)
  }

  /** El propietario registra lo que se llevó el cliente (mismas reglas que el webhook de las cámaras). */
  checkoutAtGate(visitId: string, items: CheckoutItemInput[]): Promise<CheckoutResult> {
    return this.checkout({ eventId: `gate-${crypto.randomUUID()}`, visitId, exitedAt: new Date(), items })
  }

  /** Visita completa del cliente demo para la presentación (mismos casos de uso que los dispositivos). */
  async simulateVisit(random: () => number = Math.random): Promise<SimulatedVisit> {
    const customer = await this.users.findByEmail(this.config.simulationCustomerEmail)
    if (customer?.role !== Role.CUSTOMER) {
      throw new NotFoundError(
        'SIMULATION_CUSTOMER_NOT_FOUND',
        `No existe el cliente demo ${this.config.simulationCustomerEmail}; ejecuta bun run db:seed`,
      )
    }

    const { data } = await this.products.list({ status: ProductStatus.ACTIVE, sort: 'name' }, { page: 1, limit: 100 })
    const inStock = data.filter((product) => product.stock > 0)
    const pool = [...(inStock.length > 0 ? inStock : data)]
    if (pool.length === 0) throw new UnprocessableError('NO_PRODUCTS_AVAILABLE', 'No hay productos activos para simular')

    const items: CheckoutItemInput[] = []
    const count = Math.min(pool.length, 1 + Math.floor(random() * 4))
    for (let i = 0; i < count; i++) {
      const [product] = pool.splice(Math.floor(random() * pool.length), 1)
      const maxQuantity = product!.stock > 0 ? Math.min(2, product!.stock) : 1
      items.push({ productId: product!.id, quantity: 1 + Math.floor(random() * maxQuantity) })
    }

    const token = await this.signer.sign({
      userId: customer.id,
      jti: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + this.config.entryPassTtlSeconds * 1000),
    })
    const entry = await this.registerEntry({ token, gateId: 'SIMULADOR' })
    const result = await this.checkout({ eventId: `sim-${crypto.randomUUID()}`, visitId: entry.visitId, exitedAt: new Date(), items })
    return {
      ...result,
      customer: entry.user,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    }
  }

  /** Productos por SKU o código de barras; las partidas repetidas se suman. */
  private async resolveItems(items: CheckoutItemInput[]): Promise<Map<string, number>> {
    const quantities = new Map<string, number>()
    for (const item of items) {
      let productId = item.productId
      if (!productId) {
        if (!item.barcode) throw new InvalidInputError('ITEM_CODE_REQUIRED', 'Cada partida requiere productId o barcode')
        const product = await this.products.findByCode(item.barcode)
        if (!product) {
          throw new NotFoundError('PRODUCT_NOT_FOUND', `No existe el producto con código ${item.barcode}`, {
            barcodes: [item.barcode],
          })
        }
        productId = product.id
      }
      quantities.set(productId, (quantities.get(productId) ?? 0) + item.quantity)
    }
    return quantities
  }

  /** Cobro con el método guardado del cliente; cualquier fallo de la pasarela deja la venta como adeudo (FAILED). */
  private async charge(sale: Sale, customerId: string): Promise<Sale> {
    let paymentStatus = PaymentStatus.FAILED
    let paymentReference: string | null = null
    try {
      const customer = await this.users.findById(customerId)
      const result = await this.gateway.charge({
        customerRef: customer?.paymentCustomerRef ?? null,
        amount: sale.totalAmount,
        reference: sale.id,
      })
      if (result.approved) {
        paymentStatus = PaymentStatus.PAID
        paymentReference = result.transactionId
      }
    } catch (error) {
      console.error(`Cobro del ticket #${sale.folio} falló en la pasarela`, error)
    }
    return this.sales.setPaymentResult(sale.id, { paymentStatus, paymentReference })
  }

  private async previousResult(visit: StoreVisit): Promise<CheckoutResult> {
    const sale = visit.exitEventId ? await this.sales.findByExternalEventId(eventKey(visit.exitEventId)) : null
    return sale ? toResult(visit.id, sale) : { visitId: visit.id, saleId: null, folio: null, totalAmount: 0, paymentStatus: null }
  }
}

const toResult = (visitId: string, sale: Sale): CheckoutResult => ({
  visitId,
  saleId: sale.id,
  folio: sale.folio,
  totalAmount: sale.totalAmount,
  paymentStatus: sale.paymentStatus,
})

/**
 * Venta automática: la mercancía ya salió, así que no se valida stock (puede quedar negativo) ni estado del producto.
 * Los productos inexistentes o dados de baja sí se rechazan: no hay con qué valorar la partida.
 */
function buildAutomatedSale(
  quantities: Map<string, number>,
  products: Map<string, LockedProduct>,
  context: { customerId: string; eventId: string; closing: VisitClosing },
): SaleDraft {
  const missing = [...quantities.keys()].filter((id) => !products.has(id))
  if (missing.length > 0) {
    throw new NotFoundError('PRODUCT_NOT_FOUND', `No existe el producto ${missing.join(', ')}`, { productIds: missing })
  }

  const priced = [...quantities].map(([productId, quantity]) => {
    const product = products.get(productId)!
    return { product, quantity, unitPrice: product.price, taxRate: product.taxRate }
  })

  return {
    saleType: SaleType.AUTOMATED,
    paymentMethod: PaymentMethod.CARD_ON_FILE,
    paymentStatus: PaymentStatus.PENDING,
    dateTime: context.closing.exitedAt,
    customerId: context.customerId,
    cashierId: null,
    externalEventId: eventKey(context.eventId),
    paymentReference: null,
    ...priceSale(priced),
    cashReceived: null,
    changeGiven: null,
    items: priced.map(({ product, quantity, unitPrice, taxRate }) => ({
      productId: product.id,
      productName: product.name,
      quantity,
      unitPrice,
      unitCost: product.purchaseCost,
      taxRate,
      subtotal: priceLine({ quantity, unitPrice, taxRate }).total,
    })),
    visit: context.closing,
  }
}

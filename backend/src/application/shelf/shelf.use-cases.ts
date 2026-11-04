import { MovementType, ProductStatus, ShelfAction, ShelfEventStatus, VisitStatus } from '../../domain/enums'
import { ConflictError, InvalidInputError, NotFoundError, UnprocessableError } from '../../domain/errors'
import type { InventoryMovement } from '../../domain/models/inventory'
import { roundMoney } from '../../domain/money'
import type { Product } from '../../domain/models/product'
import type { ShelfEvent, ShelfEventFrames, ShelfImage, ShelfReviewReason } from '../../domain/models/shelf-event'
import type { StoreVisit } from '../../domain/models/store-visit'
import type { Page, PageRequest } from '../common/pagination'
import type { InventoryRepository } from '../ports/inventory-repository'
import type { ProductRepository } from '../ports/product-repository'
import type { NewShelfEvent, ShelfEventRepository } from '../ports/shelf-event-repository'
import type { CatalogEntry, ShelfAnalysis, ShelfVisionAnalyzer } from '../ports/shelf-vision'
import type { StoreVisitRepository } from '../ports/store-visit-repository'
import type { UserRepository } from '../ports/user-repository'
import type { CheckoutResult, StoreUseCases } from '../store/store.use-cases'

export interface ShelfPolicy {
  /** Confianza mínima del modelo para aplicar el movimiento sin revisión */
  autoApplyConfidence: number
  /** Más piezas que esto en un solo evento → revisión (un error del modelo movería mucho stock) */
  maxAutoQuantity: number
}

export interface ShelfEventInput {
  cameraId: string
  capturedAt?: Date
  changeRatio?: number
  frames: ShelfEventFrames
}

export interface ShelfConfirmation {
  action: ShelfAction.REMOVED | ShelfAction.ADDED
  productId: string
  quantity: number
}

export interface VisitCartLine {
  productId: string
  name: string
  quantity: number
  /** IVA incluido */
  unitPrice: number
  subtotal: number
}

/** Cliente dentro de la tienda y lo que la cámara le ha visto tomar */
export interface VisitCart {
  visitId: string
  enteredAt: Date
  customer: { id: string; name: string }
  items: VisitCartLine[]
  itemCount: number
  total: number
}

export interface VisitCheckout extends CheckoutResult {
  items: VisitCartLine[]
}

export interface ProductIdentificationResult {
  product: Product | null
  confidence: number
  reason: string
  model: string | null
}

const CATALOG_LIMIT = 300
const MAX_QUANTITY = 999

/**
 * ShelfSight: convierte cada interacción con la repisa (foto antes/después) en un movimiento.
 * - Con un cliente dentro de la tienda (visita ACTIVE), lo que sale de la repisa va a SU carrito y se cobra al salir.
 * - Sin cliente, es un movimiento de inventario (resurtido o merma).
 * Si la visión no está segura, el evento va a la cola de revisión y nada cambia hasta que el dueño confirme.
 */
export class ShelfUseCases {
  constructor(
    private readonly events: ShelfEventRepository,
    private readonly products: ProductRepository,
    private readonly inventory: InventoryRepository,
    private readonly vision: ShelfVisionAnalyzer,
    private readonly visits: StoreVisitRepository,
    private readonly users: UserRepository,
    private readonly store: StoreUseCases,
    private readonly policy: ShelfPolicy,
  ) {}

  visionStatus() {
    return {
      visionEnabled: this.vision.enabled,
      model: this.vision.model,
      autoApplyConfidence: this.policy.autoApplyConfidence,
      maxAutoQuantity: this.policy.maxAutoQuantity,
    }
  }

  async ingest(input: ShelfEventInput, actorId: string): Promise<ShelfEvent> {
    const capturedAt = input.capturedAt ?? new Date()
    if (Number.isNaN(capturedAt.getTime()) || capturedAt.getTime() > Date.now() + 5 * 60_000) {
      throw new InvalidInputError('INVALID_CAPTURED_AT', 'capturedAt no puede estar en el futuro')
    }
    // ShelfSight asume un cliente a la vez frente a la repisa: el que entró más recientemente
    const visit = await this.visits.findLatestActive()
    const base = {
      cameraId: input.cameraId.trim(),
      capturedAt,
      changeRatio: input.changeRatio ?? null,
      frames: input.frames,
      model: this.vision.model,
      visitId: visit?.id ?? null,
    }

    if (!this.vision.enabled) {
      return this.events.create(
        pending(base, 'VISION_UNAVAILABLE', 'No hay modelo de visión configurado (VISION_API_KEY): revisa el evento a mano'),
      )
    }

    const catalog = await this.loadCatalog()
    let analysis: ShelfAnalysis
    try {
      analysis = await this.vision.analyze(input.frames, catalog)
    } catch (error) {
      return this.events.create(pending(base, 'VISION_ERROR', `Falló el modelo de visión: ${errorMessage(error)}`.slice(0, 1000)))
    }

    const detected = {
      ...base,
      action: analysis.action,
      quantity: clampQuantity(analysis.quantity),
      confidence: Math.min(1, Math.max(0, analysis.confidence)),
      note: analysis.reason.slice(0, 1000) || null,
      productId: matchProduct(analysis.productId, catalog),
    }

    if (detected.action === ShelfAction.NONE || detected.action === ShelfAction.MOVED || detected.quantity === 0) {
      return this.events.create({ ...detected, status: ShelfEventStatus.NO_CHANGE, reviewReason: null })
    }
    const reviewReason = this.reviewReason(detected)
    if (reviewReason) {
      return this.events.create({ ...detected, status: ShelfEventStatus.PENDING_REVIEW, reviewReason })
    }

    // Cliente dentro: va a su carrito (el stock baja hasta que paga, como cualquier venta)
    if (visit) {
      if (await this.cartAccepts(visit.id, detected.productId!, detected.action, detected.quantity)) {
        return this.events.create({
          ...detected,
          status: ShelfEventStatus.APPLIED,
          reviewReason: null,
          resolvedAt: new Date(),
          resolvedBy: actorId,
        })
      }
      return this.events.create({ ...detected, status: ShelfEventStatus.PENDING_REVIEW, reviewReason: 'NOT_IN_CART' })
    }

    // Sin cliente: movimiento de inventario. Se guarda primero como pendiente: si el movimiento falla, el stock no cambió
    const event = await this.events.create({ ...detected, status: ShelfEventStatus.PENDING_REVIEW, reviewReason: null })
    try {
      const movement = await this.applyMovement(event, detected.productId!, detected.action, detected.quantity, null)
      const applied = await this.events.transition(event.id, [ShelfEventStatus.PENDING_REVIEW], {
        status: ShelfEventStatus.APPLIED,
        movementId: movement.id,
        resolvedAt: new Date(),
        resolvedBy: actorId,
      })
      return applied ?? event
    } catch (error) {
      const reason: ShelfReviewReason =
        error instanceof ConflictError && error.code === 'INSUFFICIENT_STOCK' ? 'INSUFFICIENT_STOCK' : 'UNKNOWN_PRODUCT'
      return (
        (await this.events.transition(event.id, [ShelfEventStatus.PENDING_REVIEW], {
          status: ShelfEventStatus.PENDING_REVIEW,
          reviewReason: reason,
        })) ?? event
      )
    }
  }

  list(filters: { status?: ShelfEventStatus }, page: PageRequest): Promise<Page<ShelfEvent>> {
    return this.events.list(filters, page)
  }

  async get(id: string): Promise<{ event: ShelfEvent; frames: ShelfEventFrames }> {
    const [event, frames] = await Promise.all([this.events.findById(id), this.events.findFrames(id)])
    if (!event || !frames) throw notFound(id)
    return { event, frames }
  }

  /**
   * El dueño confirma (o corrige) lo que pasó. Si el evento era de un cliente que sigue en la tienda, va a su carrito;
   * si no (o es un resurtido que no estaba en el carrito), se aplica al inventario.
   */
  async confirm(id: string, input: ShelfConfirmation, actorId: string): Promise<ShelfEvent> {
    if (input.quantity < 1 || input.quantity > MAX_QUANTITY) {
      throw new InvalidInputError('INVALID_QUANTITY', `La cantidad debe estar entre 1 y ${MAX_QUANTITY}`)
    }
    const event = await this.events.findById(id)
    if (!event) throw notFound(id)
    if (!(await this.products.findById(input.productId))) {
      throw new NotFoundError('PRODUCT_NOT_FOUND', `No existe el producto ${input.productId}`)
    }

    const visit = event.visitId ? await this.visits.findById(event.visitId) : null
    const toCart =
      visit?.status === VisitStatus.ACTIVE && (await this.cartAccepts(visit.id, input.productId, input.action, input.quantity))

    const claimed = await this.events.transition(id, [ShelfEventStatus.PENDING_REVIEW, ShelfEventStatus.NO_CHANGE], {
      status: ShelfEventStatus.APPLIED,
      action: input.action,
      productId: input.productId,
      quantity: input.quantity,
      reviewReason: null,
      visitId: toCart ? visit!.id : null,
      resolvedBy: actorId,
      resolvedAt: new Date(),
    })
    if (!claimed) throw alreadyResolved(event)
    if (toCart) return claimed

    try {
      const movement = await this.applyMovement(event, input.productId, input.action, input.quantity, actorId)
      return (await this.events.transition(id, [ShelfEventStatus.APPLIED], { status: ShelfEventStatus.APPLIED, movementId: movement.id })) ?? claimed
    } catch (error) {
      // Se regresa el evento a como estaba para que el dueño pueda intentarlo otra vez
      await this.events.transition(id, [ShelfEventStatus.APPLIED], {
        status: event.status,
        action: event.action,
        productId: event.productId,
        quantity: event.quantity,
        reviewReason: event.reviewReason,
        visitId: event.visitId,
        resolvedBy: null,
        resolvedAt: null,
      })
      throw error
    }
  }

  async reject(id: string, actorId: string): Promise<ShelfEvent> {
    const event = await this.events.findById(id)
    if (!event) throw notFound(id)
    const rejected = await this.events.transition(id, [ShelfEventStatus.PENDING_REVIEW, ShelfEventStatus.NO_CHANGE], {
      status: ShelfEventStatus.REJECTED,
      resolvedBy: actorId,
      resolvedAt: new Date(),
    })
    if (!rejected) throw alreadyResolved(event)
    return rejected
  }

  // ── Carrito de la visita ────────────────────────────────────────────────────

  /** Para el dueño: el cliente que está frente a la repisa (el que entró más recientemente). */
  async currentVisit(): Promise<VisitCart | null> {
    const visit = await this.visits.findLatestActive()
    return visit ? this.buildCart(visit) : null
  }

  /** Para el cliente: su visita activa y lo que lleva. */
  async customerVisit(userId: string): Promise<VisitCart | null> {
    const visit = await this.visits.findActiveByUser(userId)
    return visit ? this.buildCart(visit) : null
  }

  /** El cliente sale: su carrito se vuelve una venta AUTOMATED y se cobra con su método guardado. */
  async customerCheckout(userId: string): Promise<VisitCheckout> {
    const visit = await this.visits.findActiveByUser(userId)
    if (!visit) throw new NotFoundError('NO_ACTIVE_VISIT', 'No tienes una visita activa en la tienda')
    return this.checkoutVisit(visit)
  }

  /** El dueño cobra la salida del cliente que está en la tienda (respaldo si el cliente no toca "Salir"). */
  async checkoutCurrentVisit(): Promise<VisitCheckout> {
    const visit = await this.visits.findLatestActive()
    if (!visit) throw new NotFoundError('NO_ACTIVE_VISIT', 'No hay ningún cliente dentro de la tienda')
    return this.checkoutVisit(visit)
  }

  /** Puerta: el dueño (laptop/teléfono en la entrada) lee el QR del cliente y abre su visita. */
  doorEntry(input: { token: string; gateId: string }) {
    return this.store.registerEntry(input)
  }

  // ── Caja: identificar un producto con una foto ──────────────────────────────

  async identifyProduct(image: ShelfImage): Promise<ProductIdentificationResult> {
    if (!this.vision.enabled) {
      throw new UnprocessableError('VISION_UNAVAILABLE', 'No hay modelo de visión configurado (VISION_API_KEY)')
    }
    const catalog = await this.loadCatalog()
    let result
    try {
      result = await this.vision.identify(image, catalog)
    } catch (error) {
      throw new UnprocessableError('VISION_ERROR', `Falló el modelo de visión: ${errorMessage(error)}`.slice(0, 500))
    }
    const productId = matchProduct(result.productId, catalog)
    return {
      product: productId ? await this.products.findById(productId) : null,
      confidence: Math.min(1, Math.max(0, result.confidence)),
      reason: result.reason.slice(0, 500),
      model: this.vision.model,
    }
  }

  private async checkoutVisit(visit: StoreVisit): Promise<VisitCheckout> {
    const cart = await this.buildCart(visit)
    const result = await this.store.checkout({
      // Determinista: un doble toque en "Salir" no cobra dos veces
      eventId: `cart-${visit.id}`,
      visitId: visit.id,
      exitedAt: new Date(),
      items: cart.items.map((line) => ({ productId: line.productId, quantity: line.quantity })),
    })
    return { ...result, items: cart.items }
  }

  private async buildCart(visit: StoreVisit): Promise<VisitCart> {
    const [quantities, customer] = await Promise.all([this.events.cart(visit.id), this.users.findById(visit.userId)])
    const items: VisitCartLine[] = []
    for (const [productId, quantity] of quantities) {
      const product = await this.products.findById(productId)
      if (!product) continue
      items.push({ productId, name: product.name, quantity, unitPrice: product.price, subtotal: roundMoney(product.price * quantity) })
    }
    items.sort((a, b) => a.name.localeCompare(b.name, 'es'))
    return {
      visitId: visit.id,
      enteredAt: visit.enteredAt,
      customer: { id: visit.userId, name: customer?.name ?? 'Cliente' },
      items,
      itemCount: items.reduce((sum, line) => sum + line.quantity, 0),
      total: roundMoney(items.reduce((sum, line) => sum + line.subtotal, 0)),
    }
  }

  /** Lo que sale siempre entra al carrito; lo que regresa solo si el cliente lo traía. */
  private async cartAccepts(visitId: string, productId: string, action: ShelfAction, quantity: number): Promise<boolean> {
    if (action === ShelfAction.REMOVED) return true
    if (action !== ShelfAction.ADDED) return false
    return ((await this.events.cart(visitId)).get(productId) ?? 0) >= quantity
  }

  private reviewReason(detected: { productId: string | null; confidence: number; quantity: number }): ShelfReviewReason | null {
    if (!detected.productId) return 'UNKNOWN_PRODUCT'
    if (detected.confidence < this.policy.autoApplyConfidence) return 'LOW_CONFIDENCE'
    if (detected.quantity > this.policy.maxAutoQuantity) return 'QUANTITY_TOO_HIGH'
    return null
  }

  private async loadCatalog(): Promise<CatalogEntry[]> {
    const page = await this.products.list({ status: ProductStatus.ACTIVE, sort: 'name' }, { page: 1, limit: CATALOG_LIMIT })
    return page.data.map((product) => ({ id: product.id, name: product.name, category: product.category.name }))
  }

  private async applyMovement(
    event: ShelfEvent,
    productId: string,
    action: ShelfAction,
    quantity: number,
    userId: string | null,
  ): Promise<InventoryMovement> {
    const added = action === ShelfAction.ADDED
    const origin = userId ? 'confirmado por el dueño' : 'automático'
    const movement = await this.inventory.applyStockChange(
      {
        productId,
        type: added ? MovementType.RESTOCK : MovementType.ADJUSTMENT,
        quantityDelta: added ? quantity : -quantity,
        userId,
        note: `ShelfSight · ${event.cameraId} · ${added ? 'entrada a la repisa' : 'salida de la repisa'} (${origin})`,
      },
      (currentStock) => {
        if (!added && currentStock - quantity < 0) {
          throw new ConflictError(
            'INSUFFICIENT_STOCK',
            `La salida dejaría el stock en ${currentStock - quantity} (actual: ${currentStock})`,
          )
        }
      },
    )
    if (!movement) throw new NotFoundError('PRODUCT_NOT_FOUND', `No existe el producto ${productId}`)
    return movement
  }
}

type EventBase = Pick<NewShelfEvent, 'cameraId' | 'capturedAt' | 'changeRatio' | 'frames' | 'model' | 'visitId'>

const pending = (base: EventBase, reviewReason: ShelfReviewReason, note: string): NewShelfEvent => ({
  ...base,
  status: ShelfEventStatus.PENDING_REVIEW,
  action: ShelfAction.NONE,
  productId: null,
  quantity: 0,
  confidence: null,
  reviewReason,
  note,
})

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

const clampQuantity = (quantity: number) =>
  Number.isFinite(quantity) ? Math.min(MAX_QUANTITY, Math.max(0, Math.round(quantity))) : 0

/** El modelo puede contestar con el SKU en otro formato o con el nombre del producto. */
function matchProduct(candidate: string | null, catalog: CatalogEntry[]): string | null {
  if (!candidate) return null
  const wanted = candidate.trim().toLowerCase()
  const found =
    catalog.find((entry) => entry.id.toLowerCase() === wanted) ?? catalog.find((entry) => entry.name.toLowerCase() === wanted)
  return found?.id ?? null
}

const notFound = (id: string) => new NotFoundError('SHELF_EVENT_NOT_FOUND', `No existe el evento de repisa ${id}`)

const alreadyResolved = (event: ShelfEvent) =>
  new ConflictError('SHELF_EVENT_RESOLVED', `El evento ya está ${event.status === ShelfEventStatus.APPLIED ? 'aplicado' : 'descartado'}`)

import { MovementType, ProductStatus, ShelfAction, ShelfEventStatus } from '../../domain/enums'
import { ConflictError, InvalidInputError, NotFoundError } from '../../domain/errors'
import type { InventoryMovement } from '../../domain/models/inventory'
import type { ShelfEvent, ShelfEventFrames, ShelfReviewReason } from '../../domain/models/shelf-event'
import type { Page, PageRequest } from '../common/pagination'
import type { InventoryRepository } from '../ports/inventory-repository'
import type { ProductRepository } from '../ports/product-repository'
import type { NewShelfEvent, ShelfEventRepository } from '../ports/shelf-event-repository'
import type { CatalogEntry, ShelfAnalysis, ShelfVisionAnalyzer } from '../ports/shelf-vision'

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

const CATALOG_LIMIT = 300
const MAX_QUANTITY = 999

/**
 * ShelfSight: convierte cada interacción con la repisa (foto antes/después) en un movimiento de inventario.
 * Si la visión no está segura, el evento va a la cola de revisión y el stock no cambia hasta que el dueño confirme.
 */
export class ShelfUseCases {
  constructor(
    private readonly events: ShelfEventRepository,
    private readonly products: ProductRepository,
    private readonly inventory: InventoryRepository,
    private readonly vision: ShelfVisionAnalyzer,
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
    const base = {
      cameraId: input.cameraId.trim(),
      capturedAt,
      changeRatio: input.changeRatio ?? null,
      frames: input.frames,
      model: this.vision.model,
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
      const message = error instanceof Error ? error.message : String(error)
      return this.events.create(pending(base, 'VISION_ERROR', `Falló el modelo de visión: ${message}`.slice(0, 1000)))
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

    // Se guarda primero como pendiente: si el movimiento falla, el evento queda en revisión y el stock no cambió
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
      return (await this.events.transition(event.id, [ShelfEventStatus.PENDING_REVIEW], { status: ShelfEventStatus.PENDING_REVIEW, reviewReason: reason })) ?? event
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

  /** El dueño confirma (o corrige) lo que pasó: se aplica el movimiento de inventario. */
  async confirm(id: string, input: ShelfConfirmation, actorId: string): Promise<ShelfEvent> {
    if (input.quantity < 1 || input.quantity > MAX_QUANTITY) {
      throw new InvalidInputError('INVALID_QUANTITY', `La cantidad debe estar entre 1 y ${MAX_QUANTITY}`)
    }
    const event = await this.events.findById(id)
    if (!event) throw notFound(id)

    const claimed = await this.events.transition(id, [ShelfEventStatus.PENDING_REVIEW, ShelfEventStatus.NO_CHANGE], {
      status: ShelfEventStatus.APPLIED,
      action: input.action,
      productId: input.productId,
      quantity: input.quantity,
      reviewReason: null,
      resolvedBy: actorId,
      resolvedAt: new Date(),
    })
    if (!claimed) throw alreadyResolved(event)

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

type EventBase = Pick<NewShelfEvent, 'cameraId' | 'capturedAt' | 'changeRatio' | 'frames' | 'model'>

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

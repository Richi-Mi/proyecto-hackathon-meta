import { t } from 'elysia'
import { ShelfAction, ShelfEventStatus } from '../../../domain/enums'
import { SHELF_REVIEW_REASONS } from '../../../domain/models/shelf-event'
import { DateTime, Money, PaginationQuery, Uuid } from './common.schema'
import { ProductSchema } from './product.schema'
import { CheckoutWebhookResponseSchema } from './store.schema'

/** JPEG/PNG/WebP como data URL (`data:image/jpeg;base64,…`) o base64 crudo; máx. ~3 MB por foto */
const ImagePayload = t.String({ minLength: 100, maxLength: 4_200_000 })

export const ShelfEventCreateRequest = t.Object({
  cameraId: t.String({ minLength: 1, maxLength: 64, examples: ['iphone-repisa-1'] }),
  capturedAt: t.Optional(DateTime),
  changeRatio: t.Optional(t.Number({ minimum: 0, maximum: 1, description: 'Fracción de la imagen que cambió' })),
  beforeImage: ImagePayload,
  afterImage: ImagePayload,
})

export const ShelfEventSchema = t.Object(
  {
    id: Uuid,
    cameraId: t.String(),
    status: t.Enum(ShelfEventStatus),
    action: t.Enum(ShelfAction),
    product: t.Nullable(t.Object({ id: t.String(), name: t.Nullable(t.String()) })),
    quantity: t.Integer({ minimum: 0 }),
    confidence: t.Nullable(t.Number({ minimum: 0, maximum: 1 })),
    reviewReason: t.Nullable(t.UnionEnum(SHELF_REVIEW_REASONS)),
    note: t.Nullable(t.String()),
    model: t.Nullable(t.String()),
    changeRatio: t.Nullable(t.Number({ minimum: 0, maximum: 1 })),
    movementId: t.Nullable(Uuid),
    visitId: t.Nullable(Uuid),
    capturedAt: DateTime,
    createdAt: DateTime,
    resolvedAt: t.Nullable(DateTime),
  },
  { title: 'ShelfEvent' },
)

export const ShelfEventDetailSchema = t.Composite(
  [ShelfEventSchema, t.Object({ beforeImage: t.String(), afterImage: t.String() })],
  { title: 'ShelfEventDetail' },
)

export const ShelfEventListQuery = t.Object({
  status: t.Optional(t.Enum(ShelfEventStatus)),
  ...PaginationQuery,
})

export const ShelfEventParams = t.Object({ id: Uuid })

export const ShelfEventConfirmRequest = t.Object({
  action: t.UnionEnum([ShelfAction.REMOVED, ShelfAction.ADDED]),
  productId: t.String({ minLength: 1, maxLength: 64 }),
  quantity: t.Integer({ minimum: 1, maximum: 999 }),
})

export const ShelfVisionStatusSchema = t.Object(
  {
    visionEnabled: t.Boolean(),
    model: t.Nullable(t.String()),
    autoApplyConfidence: t.Number({ minimum: 0, maximum: 1 }),
    maxAutoQuantity: t.Integer({ minimum: 1 }),
  },
  { title: 'ShelfVisionStatus' },
)

const VisitCartLineSchema = t.Object({
  productId: t.String(),
  name: t.String(),
  quantity: t.Integer({ minimum: 1 }),
  unitPrice: Money,
  subtotal: Money,
})

export const VisitCartSchema = t.Object(
  {
    visitId: Uuid,
    enteredAt: DateTime,
    customer: t.Object({ id: Uuid, name: t.String() }),
    items: t.Array(VisitCartLineSchema),
    itemCount: t.Integer({ minimum: 0 }),
    total: Money,
  },
  { title: 'VisitCart' },
)

export const CurrentVisitSchema = t.Object({ visit: t.Nullable(VisitCartSchema) }, { title: 'CurrentVisit' })

export const VisitCheckoutSchema = t.Composite([CheckoutWebhookResponseSchema, t.Object({ items: t.Array(VisitCartLineSchema) })], {
  title: 'VisitCheckout',
})

export const ProductIdentifyRequest = t.Object({ image: ImagePayload })

export const ProductIdentificationSchema = t.Object(
  {
    product: t.Nullable(ProductSchema),
    confidence: t.Number({ minimum: 0, maximum: 1 }),
    reason: t.String(),
    model: t.Nullable(t.String()),
  },
  { title: 'ProductIdentification' },
)

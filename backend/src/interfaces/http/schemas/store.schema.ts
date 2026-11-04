import { t } from 'elysia'
import { PaymentStatus, VisitStatus } from '../../../domain/enums'
import { DateTime, Money, Uuid } from './common.schema'

const Party = t.Object({ id: Uuid, name: t.String() })

export const StoreEntryRequest = t.Object({
  token: t.String({ minLength: 1, maxLength: 2048 }),
  gateId: t.String({ minLength: 1, maxLength: 64 }),
})

export const StoreEntryResponseSchema = t.Object(
  { visitId: Uuid, user: Party, enteredAt: DateTime },
  { title: 'StoreEntryResponse' },
)

// additionalProperties: sin esto Elysia descarta los demás headers
export const DeviceHeaders = t.Object({ 'x-device-key': t.Optional(t.String()) }, { additionalProperties: true })
export const SignatureHeaders = t.Object({ 'x-signature': t.Optional(t.String()) }, { additionalProperties: true })

/** Partidas de una salida: las comparten el webhook de las cámaras y la puerta del propietario */
const CheckoutItems = t.Array(
  t.Object({
    productId: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
    barcode: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
    quantity: t.Integer({ minimum: 1, maximum: 999 }),
  }),
  { maxItems: 100 },
)

/** Se valida a mano (`Value.Check`) después de verificar la firma sobre el cuerpo crudo. */
export const CheckoutWebhookRequest = t.Object(
  {
    eventId: t.String({ minLength: 1, maxLength: 100 }),
    visitId: Uuid,
    exitedAt: DateTime,
    items: CheckoutItems,
  },
  { title: 'CheckoutWebhookRequest' },
)

const checkoutFields = {
  visitId: Uuid,
  saleId: t.Nullable(Uuid),
  folio: t.Nullable(t.Integer()),
  totalAmount: Money,
  paymentStatus: t.Nullable(t.Enum(PaymentStatus)),
}

export const CheckoutWebhookResponseSchema = t.Object(checkoutFields, { title: 'CheckoutWebhookResponse' })

export const SimulatedVisitSchema = t.Object(
  { customer: Party, ...checkoutFields, itemCount: t.Integer() },
  { title: 'SimulatedVisit' },
)

// ── Puerta operada por el propietario (Store Gate) ───────────────────────────

export const GateEntryRequest = t.Object(
  {
    token: t.String({ minLength: 1, maxLength: 2048 }),
    gateId: t.Optional(t.String({ minLength: 1, maxLength: 64, default: 'PUERTA-TELEFONO' })),
  },
  { title: 'GateEntryRequest' },
)

export const GateCheckoutRequest = t.Object({ items: CheckoutItems }, { title: 'GateCheckoutRequest' })

export const StoreVisitQuery = t.Object({
  status: t.Enum(VisitStatus, { default: VisitStatus.ACTIVE }),
  limit: t.Integer({ minimum: 1, maximum: 100, default: 50 }),
})

export const StoreVisitParams = t.Object({ id: Uuid })

export const StoreVisitSchema = t.Object(
  {
    id: Uuid,
    customer: Party,
    gateId: t.String(),
    status: t.Enum(VisitStatus),
    enteredAt: DateTime,
    exitedAt: t.Nullable(DateTime),
  },
  { title: 'StoreVisit' },
)

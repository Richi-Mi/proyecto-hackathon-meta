import { t } from 'elysia'
import { PaymentMethod, PaymentStatus, SaleStatus, SaleType } from '../../../domain/enums'
import { DateTime, Money, TaxRate, Uuid } from './common.schema'

const Party = t.Object({ id: Uuid, name: t.String() })

export const SaleItemSchema = t.Object(
  {
    id: Uuid,
    productId: t.String(),
    productName: t.String(),
    quantity: t.Integer({ minimum: 1 }),
    unitPrice: Money,
    taxRate: TaxRate,
    subtotal: Money,
  },
  { title: 'SaleItem' },
)

export const SaleDetailSchema = t.Object(
  {
    id: Uuid,
    folio: t.Integer(),
    dateTime: DateTime,
    saleType: t.Enum(SaleType),
    paymentMethod: t.Enum(PaymentMethod),
    paymentStatus: t.Enum(PaymentStatus),
    status: t.Enum(SaleStatus),
    totalAmount: Money,
    itemCount: t.Integer({ description: 'Piezas totales del ticket' }),
    customer: t.Nullable(Party),
    items: t.Array(SaleItemSchema),
    subtotal: Money,
    taxAmount: Money,
    cashReceived: t.Nullable(Money),
    changeGiven: t.Nullable(Money),
    paymentReference: t.Nullable(t.String()),
    cashier: t.Nullable(Party),
    cancelledAt: t.Nullable(DateTime),
    cancelReason: t.Nullable(t.String()),
  },
  { title: 'SaleDetail' },
)

export const ManualSaleRequest = t.Object({
  items: t.Array(
    t.Object({
      productId: t.String({ minLength: 1, maxLength: 64 }),
      quantity: t.Integer({ minimum: 1, maximum: 999 }),
    }),
    { minItems: 1, maxItems: 100 },
  ),
  paymentMethod: t.UnionEnum([PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.TRANSFER]),
  cashReceived: t.Optional(t.Number({ ...Money, description: 'Requerido si CASH' })),
  paymentReference: t.Optional(t.String({ maxLength: 128, description: 'Folio de terminal o transferencia' })),
  customerId: t.Optional(t.Nullable(Uuid)),
})

// additionalProperties: sin esto Elysia descarta los demás headers, incluido Authorization
export const IdempotencyHeaders = t.Object(
  { 'idempotency-key': t.Optional(t.String({ format: 'uuid', description: 'Evita doble cobro por doble clic' })) },
  { additionalProperties: true },
)

export const SaleParams = t.Object({ id: Uuid })

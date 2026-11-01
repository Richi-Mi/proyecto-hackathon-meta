import { t } from 'elysia'
import { DateTime, TaxRate } from './common.schema'

const Printer = t.Object({
  connection: t.UnionEnum(['BLUETOOTH', 'NETWORK', 'USB', 'NONE']),
  address: t.Nullable(t.String({ maxLength: 100, description: 'MAC, IP:puerto o vendorId:productId (hex, p. ej. 0416:5011)' })),
  paperWidthMm: t.Union([t.Literal(58), t.Literal(80)]),
})

const BarcodeScanner = t.Object({ mode: t.UnionEnum(['KEYBOARD_WEDGE', 'BLUETOOTH', 'CAMERA']) })

const CardTerminal = t.Object({
  provider: t.Nullable(t.String({ maxLength: 50 })),
  terminalId: t.Nullable(t.String({ maxLength: 50 })),
})

export const PeripheralsSchema = t.Object(
  { printer: t.Optional(Printer), barcodeScanner: t.Optional(BarcodeScanner), cardTerminal: t.Optional(CardTerminal) },
  { title: 'Peripherals', description: 'Cada dispositivo es opcional (ausente = sin configurar).' },
)

export const StoreSettingsSchema = t.Object(
  {
    businessName: t.String(),
    legalName: t.Nullable(t.String()),
    rfc: t.Nullable(t.String()),
    address: t.String(),
    phone: t.Nullable(t.String()),
    logoUrl: t.Nullable(t.String()),
    currency: t.Literal('MXN'),
    defaultTaxRate: TaxRate,
    pricesIncludeTax: t.Literal(true),
    ticketFooter: t.Nullable(t.String()),
    peripherals: PeripheralsSchema,
    updatedAt: t.Optional(DateTime),
  },
  { title: 'StoreSettings' },
)

// Sin `default` (ver product.schema.ts): en un PATCH sobrescribirían los valores guardados.
export const StoreSettingsUpdate = t.Partial(
  t.Object({
    businessName: t.String({ minLength: 1, maxLength: 150 }),
    legalName: t.Nullable(t.String({ maxLength: 200 })),
    rfc: t.Nullable(
      t.String({
        pattern: '^[A-Za-zÑñ&]{3,4}[0-9]{6}[A-Za-z0-9]{3}$',
        description: '12 caracteres (persona moral) o 13 (persona física); se guarda en mayúsculas',
      }),
    ),
    address: t.String({ minLength: 1, maxLength: 500 }),
    phone: t.Nullable(t.String({ maxLength: 20 })),
    logoUrl: t.Nullable(t.String({ format: 'uri', maxLength: 500 })),
    defaultTaxRate: TaxRate,
    ticketFooter: t.Nullable(t.String({ maxLength: 500 })),
    peripherals: PeripheralsSchema,
  }),
  { minProperties: 1, description: 'Cualquier subconjunto de StoreSettings excepto currency, pricesIncludeTax y updatedAt.' },
)

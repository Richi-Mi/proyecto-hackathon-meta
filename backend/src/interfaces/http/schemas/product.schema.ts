import { t } from 'elysia'
import { PRODUCT_SORTS } from '../../../application/ports/product-repository'
import { ProductStatus } from '../../../domain/enums'
import { CategorySchema } from './category.schema'
import { DateTime, Money, PaginationQuery, TaxRate, Uuid } from './common.schema'

const Sku = t.String({ minLength: 1, maxLength: 64, pattern: '^[A-Za-z0-9_-]+$', description: 'SKU' })

export const ProductSchema = t.Object(
  {
    id: t.String({ description: 'SKU' }),
    barcode: t.Nullable(t.String()),
    name: t.String(),
    description: t.Nullable(t.String()),
    category: CategorySchema,
    price: Money,
    purchaseCost: Money,
    taxRate: TaxRate,
    stock: t.Integer(),
    minStockAlert: t.Integer({ minimum: 0 }),
    status: t.Enum(ProductStatus),
    imageUrl: t.Nullable(t.String()),
    isQuickAccess: t.Boolean(),
    isLowStock: t.Boolean({ description: 'derivado: stock <= minStockAlert' }),
    createdAt: DateTime,
    updatedAt: DateTime,
  },
  { title: 'Product' },
)

// Sin `default`: Elysia aplica los defaults al validar, y en un PATCH sobrescribirían los valores guardados.
const editableFields = {
  barcode: t.Optional(t.Nullable(t.String({ maxLength: 64 }))),
  name: t.String({ minLength: 1, maxLength: 150 }),
  description: t.Optional(t.Nullable(t.String({ maxLength: 2000 }))),
  categoryId: Uuid,
  price: Money,
  purchaseCost: Money,
  taxRate: t.Optional(TaxRate),
  minStockAlert: t.Optional(t.Integer({ minimum: 0 })),
  status: t.Optional(t.Enum(ProductStatus)),
  imageUrl: t.Optional(t.Nullable(t.String({ format: 'uri', maxLength: 500 }))),
  isQuickAccess: t.Optional(t.Boolean()),
}

export const ProductCreate = t.Object({
  id: Sku,
  ...editableFields,
  taxRate: t.Optional(t.Number({ ...TaxRate, default: 0.16 })),
  minStockAlert: t.Optional(t.Integer({ minimum: 0, default: 5 })),
  status: t.Optional(t.Enum(ProductStatus, { default: ProductStatus.ACTIVE })),
  isQuickAccess: t.Optional(t.Boolean({ default: false })),
  initialStock: t.Optional(t.Integer({ minimum: 0, default: 0, description: 'Genera un movimiento RESTOCK' })),
})

export const ProductUpdate = t.Partial(t.Object(editableFields), {
  minProperties: 1,
  description: 'El stock no se edita aquí; usar /products/{id}/stock-adjustments',
})

export const ProductParams = t.Object({ id: t.String({ minLength: 1, maxLength: 64 }) })

export const ProductListQuery = t.Object({
  search: t.Optional(t.String({ maxLength: 100, description: 'Nombre, SKU o código de barras' })),
  categoryId: t.Optional(Uuid),
  status: t.Optional(t.Enum(ProductStatus)),
  lowStock: t.Optional(t.Boolean({ description: 'stock <= minStockAlert' })),
  quickAccess: t.Optional(t.Boolean({ description: 'Solo productos del grid del POS' })),
  sort: t.Optional(t.UnionEnum(PRODUCT_SORTS, { default: 'name' })),
  ...PaginationQuery,
})

export const ProductLookupQuery = t.Object({ code: t.String({ minLength: 1, maxLength: 64 }) })

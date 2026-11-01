import type { Product, ProductCreate, ProductStatus, ProductUpdate } from '@/lib/api/types'
import type { FieldErrors } from './form-errors'

/** Valores del formulario como texto (lo que el usuario teclea); se convierten al enviar. */
export interface ProductFormValues {
  id: string
  barcode: string
  name: string
  description: string
  categoryId: string
  price: string
  purchaseCost: string
  taxRate: string
  initialStock: string
  minStockAlert: string
  status: ProductStatus
  isQuickAccess: boolean
  imageUrl: string
}

export type ProductField = keyof ProductFormValues

export const PRODUCT_FIELDS = [
  'id',
  'barcode',
  'name',
  'description',
  'categoryId',
  'price',
  'purchaseCost',
  'taxRate',
  'initialStock',
  'minStockAlert',
  'status',
  'isQuickAccess',
  'imageUrl',
] as const satisfies readonly ProductField[]

/** Tasas de IVA vigentes en México para abarrotes */
export const TAX_RATES = [
  { value: '0', label: '0 % · alimentos básicos' },
  { value: '0.08', label: '8 % · zona fronteriza' },
  { value: '0.16', label: '16 % · general' },
]

export const STATUS_OPTIONS: { value: ProductStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Activo (a la venta)' },
  { value: 'INACTIVE', label: 'Inactivo (oculto en el POS)' },
  { value: 'DISCONTINUED', label: 'Descontinuado' },
]

/** `defaultTaxRate`: tasa propuesta para un producto nuevo (`defaultTaxRate` de /settings). */
export function toFormValues(product?: Product, defaultTaxRate = 0.16): ProductFormValues {
  return {
    id: product?.id ?? '',
    barcode: product?.barcode ?? '',
    name: product?.name ?? '',
    description: product?.description ?? '',
    categoryId: product?.category.id ?? '',
    price: product ? String(product.price) : '',
    purchaseCost: product ? String(product.purchaseCost) : '',
    taxRate: String(product?.taxRate ?? defaultTaxRate),
    initialStock: '0',
    minStockAlert: String(product?.minStockAlert ?? 5),
    status: product?.status ?? 'ACTIVE',
    isQuickAccess: product?.isQuickAccess ?? false,
    imageUrl: product?.imageUrl ?? '',
  }
}

const isMoney = (value: string) => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0
const isCount = (value: string) => /^\d+$/.test(value.trim())

/** Mismas reglas que ProductCreate/ProductUpdate en docs/specs/openapi.yaml */
export function validateProduct(values: ProductFormValues, mode: 'create' | 'edit'): FieldErrors<ProductField> {
  const errors: FieldErrors<ProductField> = {}
  if (mode === 'create') {
    if (!values.id.trim()) errors.id = 'El SKU es obligatorio'
    else if (!/^[A-Za-z0-9_-]{1,64}$/.test(values.id.trim())) errors.id = 'Solo letras, números, guion y guion bajo (máx. 64)'
    if (!isCount(values.initialStock)) errors.initialStock = 'Número entero, 0 o más'
  }
  if (!values.name.trim()) errors.name = 'El nombre es obligatorio'
  if (!values.categoryId) errors.categoryId = 'Elige una categoría'
  if (!isMoney(values.price)) errors.price = 'Precio inválido'
  if (!isMoney(values.purchaseCost)) errors.purchaseCost = 'Costo inválido'
  if (!isCount(values.minStockAlert)) errors.minStockAlert = 'Número entero, 0 o más'
  if (values.imageUrl.trim() && !URL.canParse(values.imageUrl.trim())) errors.imageUrl = 'URL inválida'
  return errors
}

const optional = (value: string) => value.trim() || null

function toPayload(values: ProductFormValues) {
  return {
    barcode: optional(values.barcode),
    name: values.name.trim(),
    description: optional(values.description),
    categoryId: values.categoryId,
    price: Number(values.price),
    purchaseCost: Number(values.purchaseCost),
    taxRate: Number(values.taxRate),
    minStockAlert: Number(values.minStockAlert),
    status: values.status,
    isQuickAccess: values.isQuickAccess,
    imageUrl: optional(values.imageUrl),
  }
}

export const toCreatePayload = (values: ProductFormValues): ProductCreate => ({
  id: values.id.trim(),
  ...toPayload(values),
  initialStock: Number(values.initialStock),
})

/** PATCH parcial: solo lo que cambió respecto al producto guardado. */
export function toUpdatePayload(values: ProductFormValues, original: Product): ProductUpdate {
  const next = toPayload(values)
  const current = { ...toPayload(toFormValues(original)) }
  return Object.fromEntries(
    Object.entries(next).filter(([key, value]) => current[key as keyof typeof current] !== value),
  ) as ProductUpdate
}

/** Precio sin IVA, margen en pesos y en % (para la vista previa del formulario). */
export function marginPreview(values: ProductFormValues) {
  if (!isMoney(values.price) || !isMoney(values.purchaseCost)) return null
  const base = Number(values.price) / (1 + Number(values.taxRate))
  const margin = base - Number(values.purchaseCost)
  return { base, margin, percent: base > 0 ? margin / base : 0 }
}

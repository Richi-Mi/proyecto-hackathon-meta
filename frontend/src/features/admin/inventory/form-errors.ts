import { ApiError, getErrorMessage } from '@/lib/api/client'

export type FieldErrors<K extends string> = Partial<Record<K, string>>

/** Códigos de negocio del contrato que corresponden a un campo concreto del formulario. */
const FIELD_BY_CODE: Record<string, string> = {
  PRODUCT_ALREADY_EXISTS: 'id',
  BARCODE_ALREADY_EXISTS: 'barcode',
  CATEGORY_NOT_FOUND: 'categoryId',
  CATEGORY_NAME_TAKEN: 'name',
  INSUFFICIENT_STOCK: 'quantity',
  INVALID_QUANTITY: 'quantity',
  INVALID_UNIT_COST: 'unitCost',
}

interface ValidationIssue {
  path?: string
  message?: string
}

/**
 * Convierte un error de la API en errores por campo (si aplican a este formulario)
 * y un mensaje general para lo demás.
 */
export function toFieldErrors<K extends string>(error: unknown, fields: readonly K[]) {
  const known = new Set<string>(fields)
  const result: { fields: FieldErrors<K>; message?: string } = { fields: {} }

  if (!(error instanceof ApiError)) return { ...result, message: getErrorMessage(error) }

  const field = FIELD_BY_CODE[error.code]
  if (field && known.has(field)) {
    result.fields[field as K] = error.message
    return result
  }
  if (error.code === 'VALIDATION_ERROR' && Array.isArray(error.details)) {
    for (const issue of error.details as ValidationIssue[]) {
      const name = issue.path?.split('/')[1]
      if (name && known.has(name)) result.fields[name as K] ??= issue.message ?? 'Valor inválido'
    }
    if (Object.keys(result.fields).length > 0) return result
  }
  return { ...result, message: error.message }
}

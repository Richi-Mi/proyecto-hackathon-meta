import { QueryFailedError } from 'typeorm'

interface PgDriverError {
  code?: string
  detail?: string
}

/** Si `error` es una violación de UNIQUE (23505), devuelve la columna afectada; si no, null. */
export function uniqueViolationColumn(error: unknown): string | null {
  if (!(error instanceof QueryFailedError)) return null
  const driverError = error.driverError as PgDriverError
  if (driverError.code !== '23505') return null
  return /Key \(([^)]+)\)/.exec(driverError.detail ?? '')?.[1] ?? 'unknown'
}

/** Violación de llave foránea (23503). */
export function isForeignKeyViolation(error: unknown): boolean {
  return error instanceof QueryFailedError && (error.driverError as PgDriverError).code === '23503'
}

/** Escapa comodines de LIKE para buscar el texto literal. */
export const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&')

import type { ValueTransformer } from 'typeorm'

/** `pg` devuelve NUMERIC como string para no perder precisión; la API trabaja con number (2 decimales). */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
}

export const money = { type: 'numeric', precision: 12, scale: 2, transformer: numericTransformer } as const
export const rate = { type: 'numeric', precision: 5, scale: 4, transformer: numericTransformer } as const

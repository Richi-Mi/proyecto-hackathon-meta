import { t, type TSchema } from 'elysia'

// Esquemas TypeBox (`t` de Elysia es TypeBox) espejo de components/schemas en docs/specs/openapi.yaml

export const Uuid = t.String({ format: 'uuid' })
export const DateTime = t.String({ format: 'date-time' })
export const Money = t.Number({ minimum: 0, description: 'MXN; el servidor redondea a 2 decimales' })
export const TaxRate = t.Number({ minimum: 0, maximum: 1, examples: [0, 0.16] })

export const ErrorResponse = t.Object(
  {
    error: t.Object({
      code: t.String({ examples: ['VALIDATION_ERROR', 'INSUFFICIENT_STOCK'] }),
      message: t.String(),
      details: t.Optional(t.Unknown()),
      traceId: t.Optional(t.String({ description: 'Trace ID de OpenTelemetry' })),
    }),
  },
  { title: 'Error' },
)

export const PaginationQuery = {
  page: t.Integer({ minimum: 1, default: 1 }),
  limit: t.Integer({ minimum: 1, maximum: 100, default: 20 }),
}

export const paginated = <T extends TSchema>(item: T) =>
  t.Object({
    data: t.Array(item),
    meta: t.Object({ page: t.Integer(), limit: t.Integer(), total: t.Integer() }),
  })

/** Respuestas de error documentadas en el contrato para cada status. */
export const errors = <const S extends readonly number[]>(...statuses: S) =>
  Object.fromEntries(statuses.map((status) => [status, ErrorResponse])) as Record<S[number], typeof ErrorResponse>

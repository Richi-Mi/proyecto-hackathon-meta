import { getCurrentSpan } from '@elysiajs/opentelemetry'
import { Elysia } from 'elysia'
import { DomainError, type DomainErrorKind } from '../../../domain/errors'

const STATUS_BY_KIND: Record<DomainErrorKind, number> = {
  INVALID_INPUT: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
}

/** Traduce cualquier error al formato del contrato: `{ error: { code, message, details?, traceId? } }`. */
export const errorHandler = new Elysia({ name: 'error-handler' }).onError({ as: 'global' }, ({ code, error, set }) => {
  const reply = (status: number, errorCode: string, message: string, details?: unknown) => {
    set.status = status
    return { error: { code: errorCode, message, details, traceId: getCurrentSpan()?.spanContext().traceId } }
  }

  if (error instanceof DomainError) {
    return reply(STATUS_BY_KIND[error.kind], error.code, error.message, error.details)
  }

  switch (code) {
    case 'VALIDATION':
      // Una respuesta que no cumple el contrato es un bug del servidor, no del cliente.
      if (error.type === 'response') {
        console.error('Respuesta fuera de contrato', error.all)
        return reply(500, 'INTERNAL_ERROR', 'Error interno del servidor')
      }
      return reply(
        400,
        'VALIDATION_ERROR',
        `Datos inválidos en ${error.type}`,
        error.all.map((issue) => ({ path: 'path' in issue ? issue.path : undefined, message: issue.summary ?? issue.message })),
      )
    case 'PARSE':
      return reply(400, 'INVALID_BODY', 'El cuerpo de la petición no es JSON válido')
    case 'NOT_FOUND':
      return reply(404, 'ROUTE_NOT_FOUND', 'Ruta no encontrada')
    default:
      console.error(error)
      return reply(500, 'INTERNAL_ERROR', 'Error interno del servidor')
  }
})

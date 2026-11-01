export type DomainErrorKind = 'INVALID_INPUT' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'UNPROCESSABLE'

/**
 * Error de negocio con un `code` estable para el cliente (p. ej. `INSUFFICIENT_STOCK`).
 * La capa HTTP traduce `kind` a un status; el dominio no conoce HTTP.
 */
export abstract class DomainError extends Error {
  abstract readonly kind: DomainErrorKind

  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = new.target.name
  }
}

export class InvalidInputError extends DomainError {
  readonly kind = 'INVALID_INPUT'
}

export class UnauthorizedError extends DomainError {
  readonly kind = 'UNAUTHORIZED'
}

export class ForbiddenError extends DomainError {
  readonly kind = 'FORBIDDEN'
}

export class NotFoundError extends DomainError {
  readonly kind = 'NOT_FOUND'
}

export class ConflictError extends DomainError {
  readonly kind = 'CONFLICT'
}

/** La petición es válida pero viola una regla de negocio (p. ej. efectivo insuficiente). */
export class UnprocessableError extends DomainError {
  readonly kind = 'UNPROCESSABLE'
}

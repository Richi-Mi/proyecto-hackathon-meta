import { Role } from '../../domain/enums'
import { ForbiddenError, UnauthorizedError } from '../../domain/errors'
import type { EntryPassSigner } from '../ports/entry-pass-signer'
import type { UserRepository } from '../ports/user-repository'

export interface EntryPass {
  token: string
  expiresAt: Date
  /** El cliente debe pedir un pase nuevo antes de que expire el actual */
  refreshInSeconds: number
}

export class CustomerUseCases {
  constructor(
    private readonly users: UserRepository,
    private readonly signer: EntryPassSigner,
    private readonly entryPassTtlSeconds: number,
  ) {}

  /** JWT de vida corta y un solo uso que la app muestra como QR en el escáner de entrada. */
  async issueEntryPass(userId: string): Promise<EntryPass> {
    const user = await this.users.findById(userId)
    if (!user?.isActive) throw new UnauthorizedError('INVALID_TOKEN', 'La sesión ya no es válida')
    if (user.role !== Role.CUSTOMER) {
      throw new ForbiddenError('CUSTOMERS_ONLY', 'Solo los clientes tienen pase de entrada')
    }

    // Precisión de segundos: es lo que guarda el claim `exp`
    const expiresAt = new Date((Math.floor(Date.now() / 1000) + this.entryPassTtlSeconds) * 1000)
    const token = await this.signer.sign({ userId: user.id, jti: crypto.randomUUID(), expiresAt })
    return { token, expiresAt, refreshInSeconds: Math.floor(this.entryPassTtlSeconds * 0.75) }
  }
}

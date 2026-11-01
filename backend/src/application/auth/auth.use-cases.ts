import { Role } from '../../domain/enums'
import { ForbiddenError, UnauthorizedError } from '../../domain/errors'
import { normalizeEmail, type User } from '../../domain/models/user'
import type { PasswordHasher } from '../ports/password-hasher'
import type { PaymentGateway } from '../ports/payment-gateway'
import type { UserRepository } from '../ports/user-repository'

export interface RegisterCustomerInput {
  name: string
  email: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

/** Portal desde el que se inicia sesión: el panel de administración solo admite OWNER. */
export type LoginPortal = 'CUSTOMER' | 'ADMIN'

export class AuthUseCases {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly gateway: PaymentGateway,
  ) {}

  /** Alta del cliente y de su método de pago en la pasarela (simulada: se vincula una tarjeta ficticia). */
  async registerCustomer(input: RegisterCustomerInput): Promise<User> {
    const user = await this.users.create({
      name: input.name.trim(),
      email: normalizeEmail(input.email),
      passwordHash: await this.hasher.hash(input.password),
      role: Role.CUSTOMER,
    })
    return this.linkPaymentMethod(user)
  }

  /**
   * Registra al cliente en la pasarela si aún no tiene referencia. Si la pasarela falla, la cuenta se crea igual:
   * sus compras automáticas quedarán como adeudo (FAILED) hasta que se vincule.
   */
  async linkPaymentMethod(user: User): Promise<User> {
    if (user.paymentCustomerRef) return user
    try {
      const paymentCustomerRef = await this.gateway.registerCustomer({ id: user.id, name: user.name, email: user.email })
      await this.users.setPaymentCustomerRef(user.id, paymentCustomerRef)
      return { ...user, paymentCustomerRef }
    } catch (error) {
      console.error(`No se pudo registrar a ${user.email} en la pasarela de pago`, error)
      return user
    }
  }

  async login(input: LoginInput, portal: LoginPortal): Promise<User> {
    const found = await this.users.findByEmailWithPassword(normalizeEmail(input.email))
    const valid = await this.hasher.verify(input.password, found?.passwordHash ?? null)
    if (!found || !valid) throw new UnauthorizedError('INVALID_CREDENTIALS', 'Email o contraseña incorrectos')

    const { passwordHash: _, ...user } = found
    if (!user.isActive) throw new UnauthorizedError('ACCOUNT_DISABLED', 'La cuenta está desactivada')
    if (portal === 'ADMIN' && user.role !== Role.OWNER) {
      throw new ForbiddenError('OWNER_ONLY', 'Solo el propietario puede entrar al panel de administración')
    }
    return user
  }

  async getCurrentUser(userId: string): Promise<User> {
    const user = await this.users.findById(userId)
    if (!user?.isActive) throw new UnauthorizedError('INVALID_TOKEN', 'La sesión ya no es válida')
    return user
  }
}

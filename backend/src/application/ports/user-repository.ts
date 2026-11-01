import type { Role } from '../../domain/enums'
import type { User } from '../../domain/models/user'

export interface NewUser {
  name: string
  email: string
  passwordHash: string
  role: Role
}

export interface UserRepository {
  findById(id: string): Promise<User | null>
  findByEmailWithPassword(email: string): Promise<(User & { passwordHash: string }) | null>
  findByEmail(email: string): Promise<User | null>
  /** @throws ConflictError `EMAIL_ALREADY_REGISTERED` */
  create(data: NewUser): Promise<User>
  setPaymentCustomerRef(id: string, ref: string): Promise<void>
}

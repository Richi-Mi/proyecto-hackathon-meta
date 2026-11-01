import { t } from 'elysia'
import { Role } from '../../../domain/enums'
import { DateTime, Uuid } from './common.schema'

export const UserSchema = t.Object(
  {
    id: Uuid,
    name: t.String(),
    email: t.String({ format: 'email' }),
    role: t.Enum(Role),
    createdAt: DateTime,
  },
  { title: 'User' },
)

export const RegisterRequest = t.Object({
  name: t.String({ minLength: 2, maxLength: 120 }),
  email: t.String({ format: 'email', maxLength: 254 }),
  password: t.String({ minLength: 8, maxLength: 128 }),
})

export const LoginRequest = t.Object({
  email: t.String({ format: 'email', maxLength: 254 }),
  password: t.String({ minLength: 1, maxLength: 128 }),
})

export const AuthResponse = t.Object(
  {
    accessToken: t.String(),
    expiresIn: t.Integer({ description: 'segundos' }),
    user: UserSchema,
  },
  { title: 'AuthResponse' },
)

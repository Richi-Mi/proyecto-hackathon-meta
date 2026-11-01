import { jwt } from '@elysiajs/jwt'
import { Elysia, t } from 'elysia'
import { Role } from '../../../domain/enums'
import { ForbiddenError, UnauthorizedError } from '../../../domain/errors'

export interface AuthPluginOptions {
  secret: string
  expiresInSeconds: number
}

export interface AuthContext {
  userId: string
  role: Role
}

/**
 * JWT de sesión (HS256) + macro `auth`:
 *   { auth: true }          → cualquier usuario autenticado
 *   { auth: [Role.OWNER] }  → solo esos roles (403 si no)
 * Inyecta `auth: { userId, role }` en el contexto del handler.
 */
export const createAuthPlugin = ({ secret, expiresInSeconds }: AuthPluginOptions) =>
  new Elysia({ name: 'auth' })
    .use(
      jwt({
        name: 'accessJwt',
        secret,
        exp: `${expiresInSeconds}s`,
        schema: t.Object({ sub: t.String(), role: t.Enum(Role) }),
      }),
    )
    .macro({
      auth: (roles: true | Role[]) => ({
        detail: { security: [{ bearerAuth: [] }] },
        async resolve({ accessJwt, headers }) {
          const [scheme, token] = headers.authorization?.split(' ') ?? []
          if (scheme !== 'Bearer' || !token) {
            throw new UnauthorizedError('MISSING_TOKEN', 'Se requiere el header Authorization: Bearer <token>')
          }
          const claims = await accessJwt.verify(token)
          if (!claims) throw new UnauthorizedError('INVALID_TOKEN', 'Token inválido o expirado')
          if (roles !== true && !roles.includes(claims.role)) {
            throw new ForbiddenError('INSUFFICIENT_ROLE', 'Tu rol no tiene permiso para esta operación')
          }
          return { auth: { userId: claims.sub, role: claims.role } satisfies AuthContext }
        },
      }),
    })

export type AuthPlugin = ReturnType<typeof createAuthPlugin>

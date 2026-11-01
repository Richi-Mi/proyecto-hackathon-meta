import { Elysia } from 'elysia'
import type { CustomerUseCases } from '../../../application/customers/customer.use-cases'
import { Role } from '../../../domain/enums'
import type { AuthPlugin } from '../plugins/auth.plugin'
import { errors } from '../schemas/common.schema'
import { EntryPassSchema } from '../schemas/customer.schema'

export const customerRoutes = (auth: AuthPlugin, useCases: CustomerUseCases) =>
  new Elysia({ prefix: '/me' })
    .use(auth)
    .get(
      '/entry-pass',
      async ({ auth }) => {
        const pass = await useCases.issueEntryPass(auth.userId)
        return { ...pass, expiresAt: pass.expiresAt.toISOString() }
      },
      {
        auth: [Role.CUSTOMER],
        response: { 200: EntryPassSchema, ...errors(401, 403) },
        detail: {
          tags: ['Customer'],
          summary: 'Genera el JWT de pase de entrada para el QR (TTL 60 s, un solo uso)',
          operationId: 'getEntryPass',
        },
      },
    )

import { Elysia, t } from 'elysia'

export const healthRoutes = (checkDatabase: () => Promise<boolean>) =>
  new Elysia().get(
    '/health',
    async () => ({ status: 'ok' as const, db: (await checkDatabase()) ? ('up' as const) : ('down' as const) }),
    {
      response: t.Object({ status: t.Literal('ok'), db: t.UnionEnum(['up', 'down']) }),
      detail: { tags: ['Health'], summary: 'Liveness/readiness', operationId: 'getHealth' },
    },
  )

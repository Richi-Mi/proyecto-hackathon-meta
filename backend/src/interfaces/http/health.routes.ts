import { Elysia, t } from 'elysia'
import type { DataSource } from 'typeorm'

export const healthRoutes = (dataSource: DataSource) =>
  new Elysia().get(
    '/health',
    async () => {
      const db = await dataSource.query('SELECT 1').then(
        () => 'up' as const,
        () => 'down' as const,
      )
      return { status: 'ok' as const, db }
    },
    {
      response: t.Object({ status: t.Literal('ok'), db: t.Union([t.Literal('up'), t.Literal('down')]) }),
      detail: { tags: ['Health'], summary: 'Liveness/readiness', operationId: 'getHealth' },
    },
  )

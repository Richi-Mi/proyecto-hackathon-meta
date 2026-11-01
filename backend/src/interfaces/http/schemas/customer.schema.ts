import { t } from 'elysia'
import { DateTime } from './common.schema'

export const EntryPassSchema = t.Object(
  {
    token: t.String({ description: 'JWT {sub, typ:"entry", jti, iat, exp}' }),
    expiresAt: DateTime,
    refreshInSeconds: t.Integer({ examples: [45] }),
  },
  { title: 'EntryPass' },
)

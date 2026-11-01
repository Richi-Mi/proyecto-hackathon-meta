import { t } from 'elysia'
import { Uuid } from './common.schema'

const HexColor = t.String({ pattern: '^#[0-9A-Fa-f]{6}$', examples: ['#2563EB'] })

export const CategorySchema = t.Object(
  {
    id: Uuid,
    name: t.String(),
    color: HexColor,
    icon: t.Nullable(t.String()),
    sortOrder: t.Integer(),
  },
  { title: 'Category' },
)

const categoryFields = {
  name: t.String({ minLength: 1, maxLength: 60 }),
  color: HexColor,
  icon: t.Optional(t.Nullable(t.String({ maxLength: 60 }))),
  sortOrder: t.Optional(t.Integer()),
}

export const CategoryInput = t.Object({ ...categoryFields, sortOrder: t.Optional(t.Integer({ default: 0 })) })

// Sin defaults (ver product.schema.ts)
export const CategoryUpdate = t.Partial(t.Object(categoryFields), { minProperties: 1 })

export const CategoryParams = t.Object({ id: Uuid })

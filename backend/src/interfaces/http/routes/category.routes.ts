import { Elysia, t } from 'elysia'
import type { CategoryUseCases } from '../../../application/categories/category.use-cases'
import { Role } from '../../../domain/enums'
import type { AuthPlugin } from '../plugins/auth.plugin'
import { presentCategory } from '../presenters'
import { CategoryInput, CategoryParams, CategorySchema, CategoryUpdate } from '../schemas/category.schema'
import { errors } from '../schemas/common.schema'

export const categoryRoutes = (auth: AuthPlugin, useCases: CategoryUseCases) =>
  new Elysia({ prefix: '/categories' })
    .use(auth)
    .guard({ auth: [Role.OWNER], detail: { tags: ['Categories'] } }, (app) =>
      app
        .get('', async () => (await useCases.list()).map(presentCategory), {
          response: { 200: t.Array(CategorySchema), ...errors(401, 403) },
          detail: { summary: 'Lista categorías', operationId: 'listCategories' },
        })
        .post('', async ({ body, status }) => status(201, presentCategory(await useCases.create(body))), {
          body: CategoryInput,
          response: { 201: CategorySchema, ...errors(400, 401, 403, 409) },
          detail: { summary: 'Crea categoría', operationId: 'createCategory' },
        })
        .patch('/:id', async ({ params, body }) => presentCategory(await useCases.update(params.id, body)), {
          params: CategoryParams,
          body: CategoryUpdate,
          response: { 200: CategorySchema, ...errors(400, 401, 403, 404, 409) },
          detail: { summary: 'Edita categoría', operationId: 'updateCategory' },
        })
        .delete(
          '/:id',
          async ({ params, set }) => {
            await useCases.delete(params.id)
            set.status = 204
          },
          {
            params: CategoryParams,
            response: { 204: t.Void(), ...errors(401, 403, 404, 409) },
            detail: { summary: 'Elimina categoría (409 si tiene productos)', operationId: 'deleteCategory' },
          },
        ),
    )

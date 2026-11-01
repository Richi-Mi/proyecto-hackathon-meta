import { Elysia, t } from 'elysia'
import type { ProductUseCases } from '../../../application/products/product.use-cases'
import { Role } from '../../../domain/enums'
import type { AuthPlugin } from '../plugins/auth.plugin'
import { presentPage, presentProduct } from '../presenters'
import { errors, paginated } from '../schemas/common.schema'
import {
  ProductCreate,
  ProductListQuery,
  ProductLookupQuery,
  ProductParams,
  ProductSchema,
  ProductUpdate,
} from '../schemas/product.schema'

export const productRoutes = (auth: AuthPlugin, useCases: ProductUseCases) =>
  new Elysia({ prefix: '/products' })
    .use(auth)
    .guard({ auth: [Role.OWNER], detail: { tags: ['Products'] } }, (app) =>
      app
        .get(
          '',
          async ({ query: { page, limit, sort = 'name', ...filters } }) =>
            presentPage(await useCases.list({ ...filters, sort }, { page, limit }), presentProduct),
          {
            query: ProductListQuery,
            response: { 200: paginated(ProductSchema), ...errors(400, 401, 403) },
            detail: {
              summary: 'Lista paginada con búsqueda y filtros (tabla de inventario y catálogo POS)',
              operationId: 'listProducts',
            },
          },
        )
        .post(
          '',
          async ({ body, auth, status }) => status(201, presentProduct(await useCases.create(body, auth.userId))),
          {
            body: ProductCreate,
            response: { 201: ProductSchema, ...errors(400, 401, 403, 409) },
            detail: { summary: 'Crea producto', operationId: 'createProduct' },
          },
        )
        .get('/lookup', async ({ query }) => presentProduct(await useCases.lookup(query.code)), {
          query: ProductLookupQuery,
          response: { 200: ProductSchema, ...errors(400, 401, 403, 404) },
          detail: {
            summary: 'Búsqueda exacta por código de barras o SKU (lector del POS)',
            operationId: 'lookupProduct',
          },
        })
        .get('/:id', async ({ params }) => presentProduct(await useCases.getById(params.id)), {
          params: ProductParams,
          response: { 200: ProductSchema, ...errors(401, 403, 404) },
          detail: { summary: 'Detalle de producto', operationId: 'getProduct' },
        })
        .patch('/:id', async ({ params, body }) => presentProduct(await useCases.update(params.id, body)), {
          params: ProductParams,
          body: ProductUpdate,
          response: { 200: ProductSchema, ...errors(400, 401, 403, 404, 409) },
          detail: {
            summary: 'Edita producto (el stock NO se edita aquí; usar stock-adjustments)',
            operationId: 'updateProduct',
          },
        })
        .delete(
          '/:id',
          async ({ params, set }) => {
            await useCases.delete(params.id)
            set.status = 204
          },
          {
            params: ProductParams,
            response: { 204: t.Void(), ...errors(401, 403, 404) },
            detail: { summary: 'Baja lógica (soft delete; conserva historial de ventas)', operationId: 'deleteProduct' },
          },
        ),
    )

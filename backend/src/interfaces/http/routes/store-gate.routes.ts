import { Elysia, t } from 'elysia'
import type { StoreUseCases } from '../../../application/store/store.use-cases'
import { Role } from '../../../domain/enums'
import type { AuthPlugin } from '../plugins/auth.plugin'
import { presentStoreVisit } from '../presenters'
import { errors } from '../schemas/common.schema'
import {
  CheckoutWebhookResponseSchema,
  GateCheckoutRequest,
  GateEntryRequest,
  StoreEntryResponseSchema,
  StoreVisitParams,
  StoreVisitQuery,
  StoreVisitSchema,
} from '../schemas/store.schema'

/**
 * Puerta operada por el propietario: su teléfono lee el QR del cliente y registra la salida.
 * Sustituye al escáner (`/store/entry`) y a las cámaras (`/webhooks/checkout`) con los mismos casos de uso.
 */
export const storeGateRoutes = (auth: AuthPlugin, useCases: StoreUseCases) =>
  new Elysia()
    .use(auth)
    .guard({ auth: [Role.OWNER], detail: { tags: ['Store Gate'] } }, (app) =>
      app
        .post(
          '/store-visits',
          async ({ body, status }) => {
            const entry = await useCases.admitAtGate(body)
            return status(201, { ...entry, enteredAt: entry.enteredAt.toISOString() })
          },
          {
            body: GateEntryRequest,
            response: { 201: StoreEntryResponseSchema, ...errors(400, 401, 403, 409, 422) },
            detail: {
              summary: 'El propietario escanea el QR del cliente con su teléfono y abre la visita',
              operationId: 'admitStoreVisit',
            },
          },
        )
        .get('/store-visits', async ({ query }) => (await useCases.listVisits(query)).map(presentStoreVisit), {
          query: StoreVisitQuery,
          response: { 200: t.Array(StoreVisitSchema), ...errors(400, 401, 403) },
          detail: {
            summary: 'Visitas a la tienda (por defecto, los clientes que están dentro ahora)',
            operationId: 'listStoreVisits',
          },
        })
        .post('/store-visits/:id/checkout', ({ params, body }) => useCases.checkoutAtGate(params.id, body.items), {
          params: StoreVisitParams,
          body: GateCheckoutRequest,
          response: { 200: CheckoutWebhookResponseSchema, ...errors(400, 401, 403, 404, 409) },
          detail: {
            summary: 'El propietario registra la salida del cliente con lo que se llevó',
            operationId: 'checkoutStoreVisit',
          },
        }),
    )

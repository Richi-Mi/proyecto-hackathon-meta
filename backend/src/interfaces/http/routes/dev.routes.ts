import { Elysia } from 'elysia'
import type { StoreUseCases } from '../../../application/store/store.use-cases'
import { Role } from '../../../domain/enums'
import type { AuthPlugin } from '../plugins/auth.plugin'
import { errors } from '../schemas/common.schema'
import { SimulatedVisitSchema } from '../schemas/store.schema'

/** Herramientas de demostración. Solo se montan si NODE_ENV ≠ production o ENABLE_STORE_SIMULATOR=true (ver `createApp`). */
export const devRoutes = (auth: AuthPlugin, store: StoreUseCases) =>
  new Elysia({ prefix: '/dev' }).use(auth).post('/simulate-visit', () => store.simulateVisit(), {
    auth: [Role.OWNER],
    response: { 200: SimulatedVisitSchema, ...errors(401, 403, 404, 422) },
    detail: {
      tags: ['Dev'],
      summary: 'Simula una visita completa del cliente demo (entrada con QR + salida con productos al azar)',
      operationId: 'simulateStoreVisit',
    },
  })

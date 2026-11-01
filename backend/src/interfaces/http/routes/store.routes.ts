import { Elysia } from 'elysia'
import { Value } from '@sinclair/typebox/value'
import type { StoreUseCases } from '../../../application/store/store.use-cases'
import { InvalidInputError } from '../../../domain/errors'
import { errors } from '../schemas/common.schema'
import {
  CheckoutWebhookRequest,
  CheckoutWebhookResponseSchema,
  DeviceHeaders,
  SignatureHeaders,
  StoreEntryRequest,
  StoreEntryResponseSchema,
} from '../schemas/store.schema'

/** Rutas de los dispositivos de la tienda: escáner de entrada (device key) y sistema de cámaras (firma HMAC). */
export const storeRoutes = (useCases: StoreUseCases) =>
  new Elysia({ detail: { tags: ['Store Devices'] } })
    .post(
      '/store/entry',
      async ({ body, headers, status }) => {
        useCases.assertDevice(headers['x-device-key'])
        const entry = await useCases.registerEntry(body)
        return status(201, { ...entry, enteredAt: entry.enteredAt.toISOString() })
      },
      {
        headers: DeviceHeaders,
        body: StoreEntryRequest,
        response: { 201: StoreEntryResponseSchema, ...errors(400, 401, 403, 409) },
        detail: {
          summary: 'El escáner valida el QR y abre una visita',
          operationId: 'registerStoreEntry',
          security: [{ deviceKey: [] }],
        },
      },
    )
    .post(
      '/webhooks/checkout',
      async ({ body, headers }) => {
        // La firma se calcula sobre los bytes recibidos: por eso el cuerpo llega como texto y se valida a mano
        const raw = typeof body === 'string' ? body : ''
        useCases.assertSignature(raw, headers['x-signature'])
        let payload: unknown
        try {
          payload = JSON.parse(raw)
        } catch {
          throw new InvalidInputError('INVALID_BODY', 'El cuerpo de la petición no es JSON válido')
        }
        if (!Value.Check(CheckoutWebhookRequest, payload)) {
          const details = [...Value.Errors(CheckoutWebhookRequest, payload)].map((issue) => ({
            path: issue.path,
            message: issue.message,
          }))
          throw new InvalidInputError('VALIDATION_ERROR', 'Datos inválidos en body', details)
        }
        return useCases.checkout({ ...payload, exitedAt: new Date(payload.exitedAt) })
      },
      {
        parse: 'text',
        headers: SignatureHeaders,
        response: { 200: CheckoutWebhookResponseSchema, ...errors(400, 401, 404, 409) },
        detail: {
          summary: 'Webhook de salida del sistema de cámaras → venta AUTOMATED + cobro + descuento de stock',
          operationId: 'handleCheckoutWebhook',
          security: [{ webhookSignature: [] }],
          requestBody: {
            required: true,
            // Los tipos de Elysia siguen OpenAPI 3.0 (exclusiveMaximum booleano); el esquema es JSON Schema válido
            content: { 'application/json': { schema: CheckoutWebhookRequest as never } },
          },
        },
      },
    )

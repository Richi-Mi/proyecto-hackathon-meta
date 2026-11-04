import { Elysia } from 'elysia'
import type { ShelfUseCases } from '../../../application/shelf/shelf.use-cases'
import { Role } from '../../../domain/enums'
import { InvalidInputError } from '../../../domain/errors'
import type { ShelfImage } from '../../../domain/models/shelf-event'
import type { AuthPlugin } from '../plugins/auth.plugin'
import { presentPage, presentProduct, presentShelfEvent, presentVisitCart } from '../presenters'
import { errors, paginated } from '../schemas/common.schema'
import { StoreEntryRequest, StoreEntryResponseSchema } from '../schemas/store.schema'
import {
  CurrentVisitSchema,
  ProductIdentificationSchema,
  ProductIdentifyRequest,
  ShelfEventConfirmRequest,
  ShelfEventCreateRequest,
  ShelfEventDetailSchema,
  ShelfEventListQuery,
  ShelfEventParams,
  ShelfEventSchema,
  ShelfVisionStatusSchema,
  VisitCheckoutSchema,
} from '../schemas/shelf.schema'

const MAX_IMAGE_BYTES = 3 * 1024 * 1024

/** ShelfSight: la cámara de repisa (un teléfono con la sesión del dueño) envía fotos antes/después. */
export const shelfRoutes = (auth: AuthPlugin, useCases: ShelfUseCases) =>
  new Elysia()
    .use(auth)
    .guard({ auth: [Role.OWNER], detail: { tags: ['Shelf'] } }, (app) =>
      app
        .get('/shelf/vision', () => useCases.visionStatus(), {
          response: { 200: ShelfVisionStatusSchema, ...errors(401, 403) },
          detail: { summary: 'Modelo de visión configurado y reglas de aplicación automática', operationId: 'getShelfVisionStatus' },
        })
        .post(
          '/shelf-events',
          async ({ body, auth, status }) => {
            const event = await useCases.ingest(
              {
                cameraId: body.cameraId,
                capturedAt: body.capturedAt ? new Date(body.capturedAt) : undefined,
                changeRatio: body.changeRatio,
                frames: { before: decodeImage(body.beforeImage, 'beforeImage'), after: decodeImage(body.afterImage, 'afterImage') },
              },
              auth.userId,
            )
            return status(201, presentShelfEvent(event))
          },
          {
            body: ShelfEventCreateRequest,
            response: { 201: ShelfEventSchema, ...errors(400, 401, 403) },
            detail: {
              summary: 'Interacción con la repisa (foto antes/después) → visión → movimiento de inventario o revisión',
              operationId: 'createShelfEvent',
            },
          },
        )
        .get(
          '/shelf-events',
          async ({ query: { page, limit, status } }) =>
            presentPage(await useCases.list({ status }, { page, limit }), presentShelfEvent),
          {
            query: ShelfEventListQuery,
            response: { 200: paginated(ShelfEventSchema), ...errors(400, 401, 403) },
            detail: { summary: 'Bitácora de eventos de repisa (más recientes primero)', operationId: 'listShelfEvents' },
          },
        )
        .get(
          '/shelf-events/:id',
          async ({ params }) => {
            const { event, frames } = await useCases.get(params.id)
            return { ...presentShelfEvent(event), beforeImage: toDataUrl(frames.before), afterImage: toDataUrl(frames.after) }
          },
          {
            params: ShelfEventParams,
            response: { 200: ShelfEventDetailSchema, ...errors(400, 401, 403, 404) },
            detail: { summary: 'Detalle de un evento con sus fotos', operationId: 'getShelfEvent' },
          },
        )
        .post(
          '/shelf-events/:id/confirm',
          async ({ params, body, auth }) => presentShelfEvent(await useCases.confirm(params.id, body, auth.userId)),
          {
            params: ShelfEventParams,
            body: ShelfEventConfirmRequest,
            response: { 200: ShelfEventSchema, ...errors(400, 401, 403, 404, 409) },
            detail: { summary: 'El dueño confirma o corrige el evento y se aplica al inventario', operationId: 'confirmShelfEvent' },
          },
        )
        .post(
          '/shelf-events/:id/reject',
          async ({ params, auth }) => presentShelfEvent(await useCases.reject(params.id, auth.userId)),
          {
            params: ShelfEventParams,
            response: { 200: ShelfEventSchema, ...errors(400, 401, 403, 404, 409) },
            detail: { summary: 'El dueño descarta el evento (el stock no cambia)', operationId: 'rejectShelfEvent' },
          },
        )
        .get('/shelf/visit', async () => {
          const cart = await useCases.currentVisit()
          return { visit: cart ? presentVisitCart(cart) : null }
        }, {
          response: { 200: CurrentVisitSchema, ...errors(401, 403) },
          detail: { summary: 'Cliente dentro de la tienda y su carrito (lo que la cámara le vio tomar)', operationId: 'getCurrentStoreVisit' },
        })
        .post('/shelf/visit/checkout', () => useCases.checkoutCurrentVisit(), {
          response: { 200: VisitCheckoutSchema, ...errors(401, 403, 404, 409) },
          detail: { summary: 'El dueño cobra la salida del cliente que está en la tienda', operationId: 'checkoutCurrentStoreVisit' },
        })
        .post(
          '/store/door-entry',
          async ({ body, status }) => {
            const entry = await useCases.doorEntry(body)
            return status(201, { ...entry, enteredAt: entry.enteredAt.toISOString() })
          },
          {
            body: StoreEntryRequest,
            response: { 201: StoreEntryResponseSchema, ...errors(400, 401, 403, 409) },
            detail: {
              tags: ['Store Devices'],
              summary: 'Puerta operada por el dueño: lee el QR del cliente con la cámara y abre su visita',
              operationId: 'registerDoorEntry',
            },
          },
        )
        .post(
          '/products/identify',
          async ({ body }) => {
            const result = await useCases.identifyProduct(decodeImage(body.image, 'image'))
            return { ...result, product: result.product ? presentProduct(result.product) : null }
          },
          {
            body: ProductIdentifyRequest,
            response: { 200: ProductIdentificationSchema, ...errors(400, 401, 403, 422) },
            detail: {
              tags: ['Products'],
              summary: 'Caja: identifica un producto con una foto (en lugar del lector de código de barras)',
              operationId: 'identifyProduct',
            },
          },
        ),
    )
    .guard({ auth: [Role.CUSTOMER], detail: { tags: ['Customer'] } }, (app) =>
      app
        .get('/me/visit', async ({ auth }) => {
          const cart = await useCases.customerVisit(auth.userId)
          return { visit: cart ? presentVisitCart(cart) : null }
        }, {
          response: { 200: CurrentVisitSchema, ...errors(401, 403) },
          detail: { summary: 'Mi visita activa y lo que llevo en el carrito', operationId: 'getMyVisit' },
        })
        .post('/me/visit/checkout', ({ auth }) => useCases.customerCheckout(auth.userId), {
          response: { 200: VisitCheckoutSchema, ...errors(401, 403, 404, 409) },
          detail: { summary: 'Salgo de la tienda: se cobra mi carrito con mi método guardado', operationId: 'checkoutMyVisit' },
        }),
    )

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,/

function decodeImage(payload: string, field: string): ShelfImage {
  const match = DATA_URL.exec(payload)
  const data = Buffer.from(match ? payload.slice(match[0].length) : payload, 'base64')
  const mimeType = (match?.[1] as ShelfImage['mimeType'] | undefined) ?? sniffMimeType(data)
  if (!mimeType || sniffMimeType(data) !== mimeType || data.length > MAX_IMAGE_BYTES) {
    throw new InvalidInputError('INVALID_IMAGE', `${field} debe ser una imagen JPEG, PNG o WebP de máximo 3 MB`)
  }
  return { mimeType, data: new Uint8Array(data) }
}

function sniffMimeType(data: Buffer): ShelfImage['mimeType'] | null {
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg'
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return 'image/png'
  if (data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  return null
}

const toDataUrl = (image: ShelfImage) => `data:${image.mimeType};base64,${Buffer.from(image.data).toString('base64')}`

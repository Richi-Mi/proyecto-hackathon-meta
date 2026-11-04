import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { RefundRequest } from '../src/application/ports/payment-gateway'
import type { ShelfAnalysis, ShelfVisionAnalyzer } from '../src/application/ports/shelf-vision'
import { ShelfAction } from '../src/domain/enums'
import { createContainer } from '../src/container'
import { env, parseList } from '../src/infrastructure/config/env'
import { AppDataSource } from '../src/infrastructure/database/data-source'
import { runSeed } from '../src/infrastructure/database/seed'
import { MockPaymentGateway } from '../src/infrastructure/payments/mock-payment-gateway'
import { JoseEntryPassSigner } from '../src/infrastructure/security/jose-entry-pass-signer'
import { HmacWebhookSignatureVerifier } from '../src/infrastructure/security/store-device-auth'
import { createApp } from '../src/interfaces/http/app'

const OWNER = { name: 'Dueña Pruebas', email: 'owner@test.mx', password: 'owner-password-123' }

/** Pasarela simulada que registra los reembolsos y puede rechazarlos a voluntad */
class SpyPaymentGateway extends MockPaymentGateway {
  refunds: RefundRequest[] = []
  rejectRefunds = false

  override async refund(request: RefundRequest) {
    if (this.rejectRefunds) throw new Error('Reembolso rechazado (prueba)')
    this.refunds.push(request)
    return super.refund(request)
  }
}

/** Visión de prueba: devuelve lo que la prueba le indique (o lanza un error) */
class FakeShelfVision implements ShelfVisionAnalyzer {
  readonly enabled = true
  readonly model = 'fake-vision'
  next: ShelfAnalysis | Error = { action: ShelfAction.NONE, productId: null, quantity: 0, confidence: 1, reason: '' }

  async analyze() {
    if (this.next instanceof Error) throw this.next
    return this.next
  }
}

const gateway = new SpyPaymentGateway()
const shelfVision = new FakeShelfVision()
const container = createContainer(AppDataSource, { paymentGateway: gateway, shelfVision })
const app = createApp({
  useCases: container.useCases,
  checkDatabase: container.checkDatabase,
  config: { jwtSecret: env.JWT_SECRET, jwtExpiresInSeconds: 3600, corsOrigins: ['http://localhost:5173'], devTools: true },
})

// cuerpo JSON arbitrario en las aserciones
type Json = any

async function call(method: string, path: string, options: { body?: unknown; token?: string } = {}) {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['content-type'] = 'application/json'
  if (options.token) headers.authorization = `Bearer ${options.token}`
  const response = await app.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
  )
  const text = await response.text()
  return { status: response.status, body: (text ? JSON.parse(text) : null) as Json }
}

let ownerToken = ''
let customerToken = ''
let customerId = ''
let categoryId = ''

beforeAll(async () => {
  await runSeed(AppDataSource, { owner: OWNER, withDemoCatalog: false })
  ownerToken = (await call('POST', '/api/v1/auth/admin/login', { body: OWNER })).body.accessToken
})

describe('health y documentación', () => {
  test('GET /health reporta la base de datos', async () => {
    const res = await call('GET', '/api/v1/health')
    expect(res).toEqual({ status: 200, body: { status: 'ok', db: 'up' } })
  })

  test('Swagger expone el spec con las rutas del bloque', async () => {
    const res = await call('GET', '/swagger/json')
    expect(res.status).toBe(200)
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining(['/api/v1/auth/register', '/api/v1/products', '/api/v1/products/{id}', '/api/v1/inventory/summary']),
    )
    expect(res.body.paths['/api/v1/products'].get.security).toEqual([{ bearerAuth: [] }])
  })

  test('ruta inexistente usa el formato de error del contrato', async () => {
    const res = await call('GET', '/api/v1/nope')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND')
  })
})

describe('auth', () => {
  test('registro de cliente devuelve token y usuario sin hash', async () => {
    const res = await call('POST', '/api/v1/auth/register', {
      body: { name: 'Ana Cliente', email: 'Ana@Correo.mx', password: 'secreta-123' },
    })
    expect(res.status).toBe(201)
    expect(res.body.expiresIn).toBe(3600)
    expect(res.body.user).toMatchObject({ name: 'Ana Cliente', email: 'ana@correo.mx', role: 'CUSTOMER' })
    expect(JSON.stringify(res.body)).not.toContain('passwordHash')
    customerToken = res.body.accessToken
    customerId = res.body.user.id
  })

  test('email duplicado (sin importar mayúsculas) → 409', async () => {
    const res = await call('POST', '/api/v1/auth/register', {
      body: { name: 'Otra Ana', email: 'ANA@correo.mx', password: 'secreta-123' },
    })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('EMAIL_ALREADY_REGISTERED')
  })

  test('payload inválido → 400 con detalles', async () => {
    const res = await call('POST', '/api/v1/auth/register', { body: { name: 'A', email: 'no-es-email', password: '123' } })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details.length).toBeGreaterThan(0)
  })

  test('JSON malformado → 400 INVALID_BODY', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{malformado',
      }),
    )
    expect(response.status).toBe(400)
    expect((await response.json()).error.code).toBe('INVALID_BODY')
  })

  test('contraseña incorrecta y email inexistente responden igual (401)', async () => {
    const wrongPassword = await call('POST', '/api/v1/auth/login', { body: { email: 'ana@correo.mx', password: 'x' } })
    const unknownEmail = await call('POST', '/api/v1/auth/login', { body: { email: 'nadie@correo.mx', password: 'x' } })
    expect(wrongPassword.status).toBe(401)
    expect(unknownEmail.body.error.code).toBe(wrongPassword.body.error.code)
  })

  test('un CUSTOMER no puede entrar al panel de administración (403)', async () => {
    const res = await call('POST', '/api/v1/auth/admin/login', { body: { email: 'ana@correo.mx', password: 'secreta-123' } })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('OWNER_ONLY')
  })

  test('GET /auth/me con y sin token', async () => {
    expect((await call('GET', '/api/v1/auth/me', { token: ownerToken })).body).toMatchObject({ email: OWNER.email, role: 'OWNER' })
    expect((await call('GET', '/api/v1/auth/me')).body.error.code).toBe('MISSING_TOKEN')
    expect((await call('GET', '/api/v1/auth/me', { token: 'basura' })).status).toBe(401)
  })

  test('un CUSTOMER no accede a rutas de propietario (403)', async () => {
    const res = await call('GET', '/api/v1/products', { token: customerToken })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('INSUFFICIENT_ROLE')
  })
})

describe('categorías', () => {
  test('crear, listar y nombre duplicado', async () => {
    const created = await call('POST', '/api/v1/categories', { token: ownerToken, body: { name: 'Bebidas', color: '#2563eb' } })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ name: 'Bebidas', color: '#2563EB', icon: null, sortOrder: 0 })
    categoryId = created.body.id

    const duplicate = await call('POST', '/api/v1/categories', { token: ownerToken, body: { name: 'Bebidas', color: '#000000' } })
    expect(duplicate.body.error.code).toBe('CATEGORY_NAME_TAKEN')

    const reordered = await call('PATCH', `/api/v1/categories/${categoryId}`, { token: ownerToken, body: { sortOrder: 3 } })
    const renamed = await call('PATCH', `/api/v1/categories/${categoryId}`, { token: ownerToken, body: { name: 'Bebidas' } })
    expect(reordered.body.sortOrder).toBe(3)
    expect(renamed.body.sortOrder).toBe(3)

    const list = await call('GET', '/api/v1/categories', { token: ownerToken })
    expect(list.body.map((c: Json) => c.name)).toContain('Bebidas')
  })

  test('color inválido → 400', async () => {
    const res = await call('POST', '/api/v1/categories', { token: ownerToken, body: { name: 'X', color: 'rojo' } })
    expect(res.status).toBe(400)
  })
})

describe('productos e inventario', () => {
  const coca = {
    id: 'COCA-600',
    barcode: '2000000009999',
    name: 'Refresco de cola 600 ml',
    price: 18.555,
    purchaseCost: 12.3,
    initialStock: 10,
    minStockAlert: 4,
    isQuickAccess: true,
  }

  test('crear con stock inicial: redondea dinero, aplica defaults y registra RESTOCK', async () => {
    const res = await call('POST', '/api/v1/products', { token: ownerToken, body: { ...coca, categoryId } })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      id: 'COCA-600',
      price: 18.56,
      taxRate: 0.16,
      stock: 10,
      status: 'ACTIVE',
      isLowStock: false,
      category: { id: categoryId, name: 'Bebidas' },
    })

    const movements = await call('GET', '/api/v1/inventory/movements?productId=COCA-600', { token: ownerToken })
    expect(movements.body.data).toHaveLength(1)
    expect(movements.body.data[0]).toMatchObject({ type: 'RESTOCK', quantityDelta: 10, stockAfter: 10 })
  })

  test('SKU o código de barras repetido → 409; categoría inexistente → 400', async () => {
    const sameSku = await call('POST', '/api/v1/products', { token: ownerToken, body: { ...coca, barcode: null, categoryId } })
    expect(sameSku.body.error.code).toBe('PRODUCT_ALREADY_EXISTS')

    const sameBarcode = await call('POST', '/api/v1/products', { token: ownerToken, body: { ...coca, id: 'OTRO', categoryId } })
    expect(sameBarcode.body.error.code).toBe('BARCODE_ALREADY_EXISTS')

    const badCategory = await call('POST', '/api/v1/products', {
      token: ownerToken,
      body: { ...coca, id: 'OTRO', barcode: null, categoryId: crypto.randomUUID() },
    })
    expect(badCategory.status).toBe(400)
    expect(badCategory.body.error.code).toBe('CATEGORY_NOT_FOUND')
  })

  test('listar con búsqueda, filtros y paginación', async () => {
    await call('POST', '/api/v1/products', {
      token: ownerToken,
      body: { id: 'AGUA-PRUEBA', name: 'Agua natural 1 L', categoryId, price: 14, purchaseCost: 8, initialStock: 2 },
    })

    const search = await call('GET', '/api/v1/products?search=cola', { token: ownerToken })
    expect(search.body.data.map((p: Json) => p.id)).toEqual(['COCA-600'])

    const low = await call('GET', '/api/v1/products?lowStock=true', { token: ownerToken })
    expect(low.body.data.map((p: Json) => p.id)).toEqual(['AGUA-PRUEBA'])

    const paged = await call('GET', '/api/v1/products?limit=1&page=2&sort=-price', { token: ownerToken })
    expect(paged.body.meta).toEqual({ page: 2, limit: 1, total: 2 })
    expect(paged.body.data[0].id).toBe('AGUA-PRUEBA')

    const badSort = await call('GET', '/api/v1/products?sort=hackeo', { token: ownerToken })
    expect(badSort.status).toBe(400)
  })

  test('lookup por código de barras o SKU', async () => {
    expect((await call('GET', '/api/v1/products/lookup?code=2000000009999', { token: ownerToken })).body.id).toBe('COCA-600')
    expect((await call('GET', '/api/v1/products/lookup?code=AGUA-PRUEBA', { token: ownerToken })).body.id).toBe('AGUA-PRUEBA')
    expect((await call('GET', '/api/v1/products/lookup?code=999', { token: ownerToken })).status).toBe(404)
  })

  test('PATCH parcial; cuerpo vacío → 400; el stock no es editable', async () => {
    const res = await call('PATCH', '/api/v1/products/COCA-600', { token: ownerToken, body: { price: 20, description: '  ' } })
    expect(res.status).toBe(200)
    // Los campos no enviados conservan su valor (no se reemplazan por los defaults del esquema)
    expect(res.body).toMatchObject({ price: 20, description: null, stock: 10, minStockAlert: 4, isQuickAccess: true })

    const empty = await call('PATCH', '/api/v1/products/COCA-600', { token: ownerToken, body: {} })
    expect(empty.status).toBe(400)
    expect(empty.body.error.code).toBe('VALIDATION_ERROR') // minProperties: 1 (el caso de uso también lo valida: EMPTY_UPDATE)

    // `stock` no está en ProductUpdate: Elysia lo descarta y el stock no cambia
    const stockEdit = await call('PATCH', '/api/v1/products/COCA-600', { token: ownerToken, body: { stock: 999 } })
    expect(stockEdit.status).toBe(400)
    expect((await call('GET', '/api/v1/products/COCA-600', { token: ownerToken })).body.stock).toBe(10)
  })

  test('ajustes de stock: RESTOCK actualiza costo; ADJUSTMENT no deja stock negativo', async () => {
    const restock = await call('POST', '/api/v1/products/AGUA-PRUEBA/stock-adjustments', {
      token: ownerToken,
      body: { type: 'RESTOCK', quantity: 10, unitCost: 8.5, note: 'Proveedor' },
    })
    expect(restock.status).toBe(201)
    expect(restock.body).toMatchObject({ type: 'RESTOCK', quantityDelta: 10, stockAfter: 12, note: 'Proveedor' })
    expect((await call('GET', '/api/v1/products/AGUA-PRUEBA', { token: ownerToken })).body).toMatchObject({
      stock: 12,
      purchaseCost: 8.5,
    })

    const tooMuch = await call('POST', '/api/v1/products/AGUA-PRUEBA/stock-adjustments', {
      token: ownerToken,
      body: { type: 'ADJUSTMENT', quantity: -13 },
    })
    expect(tooMuch.status).toBe(409)
    expect(tooMuch.body.error.code).toBe('INSUFFICIENT_STOCK')

    const negativeRestock = await call('POST', '/api/v1/products/AGUA-PRUEBA/stock-adjustments', {
      token: ownerToken,
      body: { type: 'RESTOCK', quantity: -1 },
    })
    expect(negativeRestock.body.error.code).toBe('INVALID_QUANTITY')

    const missing = await call('POST', '/api/v1/products/NO-EXISTE/stock-adjustments', {
      token: ownerToken,
      body: { type: 'RESTOCK', quantity: 1 },
    })
    expect(missing.status).toBe(404)
  })

  test('ajustes concurrentes no pierden actualizaciones (bloqueo de fila)', async () => {
    await Promise.all(
      Array.from({ length: 10 }, () =>
        call('POST', '/api/v1/products/COCA-600/stock-adjustments', {
          token: ownerToken,
          body: { type: 'RESTOCK', quantity: 1 },
        }),
      ),
    )
    expect((await call('GET', '/api/v1/products/COCA-600', { token: ownerToken })).body.stock).toBe(20)
  })

  test('resumen de inventario', async () => {
    const res = await call('GET', '/api/v1/inventory/summary', { token: ownerToken })
    expect(res.status).toBe(200)
    // COCA: 20 × 12.30 = 246 · AGUA: 12 × 8.50 = 102
    expect(res.body).toMatchObject({
      totalProducts: 2,
      totalUnits: 32,
      totalCostValue: 348,
      totalRetailValue: 20 * 20 + 12 * 14,
      lowStockCount: 0,
      outOfStockCount: 0,
    })
    expect(res.body.byCategory).toEqual([{ categoryId, name: 'Bebidas', units: 32, costValue: 348 }])
  })

  test('baja lógica: desaparece del catálogo pero conserva el SKU y bloquea borrar la categoría', async () => {
    expect((await call('DELETE', '/api/v1/products/AGUA-PRUEBA', { token: ownerToken })).status).toBe(204)
    expect((await call('GET', '/api/v1/products/AGUA-PRUEBA', { token: ownerToken })).status).toBe(404)
    expect((await call('DELETE', '/api/v1/products/AGUA-PRUEBA', { token: ownerToken })).status).toBe(404)

    const reuseSku = await call('POST', '/api/v1/products', {
      token: ownerToken,
      body: { id: 'AGUA-PRUEBA', name: 'Agua', categoryId, price: 1, purchaseCost: 1 },
    })
    expect(reuseSku.body.error.code).toBe('PRODUCT_ALREADY_EXISTS')

    await call('DELETE', '/api/v1/products/COCA-600', { token: ownerToken })
    const deleteCategory = await call('DELETE', `/api/v1/categories/${categoryId}`, { token: ownerToken })
    expect(deleteCategory.status).toBe(409)
    expect(deleteCategory.body.error.code).toBe('CATEGORY_HAS_PRODUCTS')
  })
})

describe('pase de entrada (GET /me/entry-pass)', () => {
  test('el cliente recibe un JWT de un solo uso y vida corta', async () => {
    const res = await call('GET', '/api/v1/me/entry-pass', { token: customerToken })
    expect(res.status).toBe(200)
    expect(res.body.refreshInSeconds).toBe(45)

    const claims = await new JoseEntryPassSigner(env.ENTRY_PASS_SECRET).verify(res.body.token)
    expect(claims?.userId).toBe(customerId)
    expect(new Date(res.body.expiresAt).getTime()).toBe(claims?.expiresAt.getTime())
    const ttl = (claims!.expiresAt.getTime() - Date.now()) / 1000
    expect(ttl).toBeGreaterThan(55)
    expect(ttl).toBeLessThanOrEqual(60)

    const second = await call('GET', '/api/v1/me/entry-pass', { token: customerToken })
    const secondClaims = await new JoseEntryPassSigner(env.ENTRY_PASS_SECRET).verify(second.body.token)
    expect(secondClaims?.jti).not.toBe(claims?.jti)
  })

  test('el token no sirve con otro secreto (p. ej. el de sesión)', async () => {
    const res = await call('GET', '/api/v1/me/entry-pass', { token: customerToken })
    expect(await new JoseEntryPassSigner(env.JWT_SECRET).verify(res.body.token)).toBeNull()
  })

  test('solo para clientes', async () => {
    expect((await call('GET', '/api/v1/me/entry-pass', { token: ownerToken })).status).toBe(403)
    expect((await call('GET', '/api/v1/me/entry-pass')).status).toBe(401)
  })
})

describe('ventas de mostrador (POST /sales)', () => {
  let salesCategoryId = ''
  const product = (id: string, body: Record<string, unknown>) =>
    call('POST', '/api/v1/products', {
      token: ownerToken,
      body: { id, name: id, categoryId: salesCategoryId, purchaseCost: 10, ...body },
    })
  const sell = (body: Record<string, unknown>, idempotencyKey?: string) =>
    app
      .handle(
        new Request('http://localhost/api/v1/sales', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${ownerToken}`,
            ...(idempotencyKey && { 'idempotency-key': idempotencyKey }),
          },
          body: JSON.stringify(body),
        }),
      )
      .then(async (response) => ({ status: response.status, body: (await response.json()) as Json }))
  const stockOf = async (id: string) => (await call('GET', `/api/v1/products/${id}`, { token: ownerToken })).body.stock

  beforeAll(async () => {
    salesCategoryId = (
      await call('POST', '/api/v1/categories', { token: ownerToken, body: { name: 'Ventas', color: '#16A34A' } })
    ).body.id
    await product('VTA-REF', { price: 20, taxRate: 0.16, initialStock: 5 })
    await product('VTA-LECHE', { price: 28.5, taxRate: 0, initialStock: 3 })
    await product('VTA-INACTIVO', { price: 10, initialStock: 5, status: 'INACTIVE' })
    await product('VTA-ULTIMO', { price: 15, initialStock: 1 })
  })

  test('efectivo con IVA mixto: totales, cambio, stock y kardex', async () => {
    const res = await sell({
      items: [
        { productId: 'VTA-REF', quantity: 2 },
        { productId: 'VTA-LECHE', quantity: 1 },
        { productId: 'VTA-REF', quantity: 1 },
      ],
      paymentMethod: 'CASH',
      cashReceived: 100,
    })
    expect(res.status).toBe(201)
    // Refresco: 3 × 20 = 60 → base 51.72 + IVA 8.28 · Leche: 28.50 tasa 0
    expect(res.body).toMatchObject({
      saleType: 'MANUAL',
      paymentMethod: 'CASH',
      paymentStatus: 'PAID',
      status: 'COMPLETED',
      subtotal: 80.22,
      taxAmount: 8.28,
      totalAmount: 88.5,
      cashReceived: 100,
      changeGiven: 11.5,
      itemCount: 4,
      customer: null,
      cashier: { name: OWNER.name },
    })
    expect(res.body.folio).toBeGreaterThan(0)
    expect(res.body.items).toEqual([
      expect.objectContaining({ productId: 'VTA-LECHE', quantity: 1, unitPrice: 28.5, taxRate: 0, subtotal: 28.5 }),
      expect.objectContaining({ productId: 'VTA-REF', quantity: 3, unitPrice: 20, taxRate: 0.16, subtotal: 60 }),
    ])

    expect(await stockOf('VTA-REF')).toBe(2)
    expect(await stockOf('VTA-LECHE')).toBe(2)
    const kardex = await call('GET', '/api/v1/inventory/movements?productId=VTA-REF&type=SALE', { token: ownerToken })
    expect(kardex.body.data[0]).toMatchObject({ quantityDelta: -3, stockAfter: 2, saleId: res.body.id })

    const fetched = await call('GET', `/api/v1/sales/${res.body.id}`, { token: ownerToken })
    expect(fetched.body).toEqual(res.body)
  })

  test('tarjeta con cliente identificado; el efectivo recibido se ignora', async () => {
    const res = await sell({
      items: [{ productId: 'VTA-LECHE', quantity: 1 }],
      paymentMethod: 'CARD',
      cashReceived: 500,
      paymentReference: ' AUT-1234 ',
      customerId,
    })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      cashReceived: null,
      changeGiven: null,
      paymentReference: 'AUT-1234',
      customer: { id: customerId, name: 'Ana Cliente' },
    })
  })

  test('reglas de negocio: efectivo, stock, estado y existencia', async () => {
    const noCash = await sell({ items: [{ productId: 'VTA-REF', quantity: 1 }], paymentMethod: 'CASH' })
    expect([noCash.status, noCash.body.error.code]).toEqual([400, 'CASH_RECEIVED_REQUIRED'])

    const shortCash = await sell({ items: [{ productId: 'VTA-REF', quantity: 1 }], paymentMethod: 'CASH', cashReceived: 5 })
    expect([shortCash.status, shortCash.body.error.code]).toEqual([422, 'CASH_INSUFFICIENT'])

    const noStock = await sell({ items: [{ productId: 'VTA-REF', quantity: 9 }], paymentMethod: 'CARD' })
    expect([noStock.status, noStock.body.error.code]).toEqual([409, 'INSUFFICIENT_STOCK'])
    expect(noStock.body.error.details).toEqual([{ productId: 'VTA-REF', requested: 9, available: 2 }])

    const inactive = await sell({ items: [{ productId: 'VTA-INACTIVO', quantity: 1 }], paymentMethod: 'CARD' })
    expect([inactive.status, inactive.body.error.code]).toEqual([409, 'PRODUCT_INACTIVE'])

    const unknown = await sell({ items: [{ productId: 'NO-EXISTE', quantity: 1 }], paymentMethod: 'CARD' })
    expect([unknown.status, unknown.body.error.code]).toEqual([404, 'PRODUCT_NOT_FOUND'])

    const badCustomer = await sell({
      items: [{ productId: 'VTA-REF', quantity: 1 }],
      paymentMethod: 'CARD',
      customerId: crypto.randomUUID(),
    })
    expect([badCustomer.status, badCustomer.body.error.code]).toEqual([400, 'CUSTOMER_NOT_FOUND'])

    const cardOnFile = await sell({ items: [{ productId: 'VTA-REF', quantity: 1 }], paymentMethod: 'CARD_ON_FILE' })
    expect(cardOnFile.status).toBe(400)

    // Ninguna venta rechazada tocó el stock
    expect(await stockOf('VTA-REF')).toBe(2)
  })

  test('Idempotency-Key: reintentos devuelven la misma venta y descuentan una sola vez', async () => {
    const key = crypto.randomUUID()
    const body = { items: [{ productId: 'VTA-REF', quantity: 1 }], paymentMethod: 'TRANSFER' }
    const [first, second] = await Promise.all([sell(body, key), sell(body, key)])
    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    expect(second.body.id).toBe(first.body.id)
    expect(await stockOf('VTA-REF')).toBe(1)
  })

  test('dos cajas venden la última pieza al mismo tiempo: solo una lo logra', async () => {
    const body = { items: [{ productId: 'VTA-ULTIMO', quantity: 1 }], paymentMethod: 'CARD' }
    const results = await Promise.all([sell(body), sell(body)])
    expect(results.map((r) => r.status).sort()).toEqual([201, 409])
    expect(await stockOf('VTA-ULTIMO')).toBe(0)
  })

  test('detalle inexistente → 404; un CUSTOMER no puede vender', async () => {
    expect((await call('GET', `/api/v1/sales/${crypto.randomUUID()}`, { token: ownerToken })).status).toBe(404)
    const res = await call('POST', '/api/v1/sales', {
      token: customerToken,
      body: { items: [{ productId: 'VTA-REF', quantity: 1 }], paymentMethod: 'CARD' },
    })
    expect(res.status).toBe(403)
  })
})

describe('reportes (/reports/*)', () => {
  // Ventas fechadas en marzo de 2025 (hora de México, UTC−6) para no mezclarse con las demás pruebas
  const range = 'from=2025-03-10T00:00:00-06:00&to=2025-03-13T00:00:00-06:00'
  let cancelledSaleId = ''

  beforeAll(async () => {
    const reportsCategory = (
      await call('POST', '/api/v1/categories', { token: ownerToken, body: { name: 'Reportes', color: '#7C3AED' } })
    ).body.id
    const product = (id: string, name: string, price: number, purchaseCost: number, taxRate: number) =>
      call('POST', '/api/v1/products', {
        token: ownerToken,
        body: { id, name, categoryId: reportsCategory, price, purchaseCost, taxRate, initialStock: 100 },
      })
    await product('REP-A', 'Reporte A', 116, 50, 0.16) // base 100, ganancia 50 por pieza
    await product('REP-B', 'Reporte B', 30, 20, 0) // base 30, ganancia 10 por pieza

    const ownerId = (await call('GET', '/api/v1/auth/me', { token: ownerToken })).body.id
    const sell = (at: string, items: { productId: string; quantity: number }[], extra: object = {}) =>
      container.useCases.sales.createManualSale({ items, paymentMethod: 'CARD', ...extra } as never, ownerId, { at: new Date(at) })

    await sell('2025-03-10T12:00:00-06:00', [{ productId: 'REP-A', quantity: 1 }]) // 116 · ganancia 50
    // 23:30 en México = 05:30 UTC del día 11: debe contar en el día 10 local
    await sell('2025-03-10T23:30:00-06:00', [{ productId: 'REP-B', quantity: 3 }]) // 90 · ganancia 30
    await sell(
      '2025-03-12T09:00:00-06:00',
      [
        { productId: 'REP-A', quantity: 2 },
        { productId: 'REP-B', quantity: 1 },
      ],
      { paymentMethod: 'CASH', cashReceived: 300 },
    ) // 262 · IVA 32 · ganancia 110 (la venta 1 aporta IVA 16)
    cancelledSaleId = (await sell('2025-03-12T10:00:00-06:00', [{ productId: 'REP-A', quantity: 5 }])).id
    await AppDataSource.query(`UPDATE sales SET status = 'CANCELLED' WHERE id = $1`, [cancelledSaleId])
  })

  test('resumen: ingresos, IVA, ganancia neta y ticket promedio (sin canceladas)', async () => {
    const res = await call('GET', `/api/v1/reports/summary?${range}`, { token: ownerToken })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      from: '2025-03-10T06:00:00.000Z',
      to: '2025-03-13T06:00:00.000Z',
      revenue: 468,
      taxCollected: 48, // 16 (venta 1) + 32 (venta 3)
      netProfit: 190,
      transactions: 3,
      averageTicket: 156,
      byType: { MANUAL: { revenue: 468, transactions: 3 }, AUTOMATED: { revenue: 0, transactions: 0 } },
      pendingPayments: 0,
    })
  })

  test('tendencia diaria en hora local, con los días sin ventas en cero', async () => {
    const res = await call('GET', `/api/v1/reports/sales-trend?${range}&granularity=day`, { token: ownerToken })
    expect(res.body).toEqual([
      { bucket: '2025-03-10T06:00:00.000Z', revenue: 206, netProfit: 80, transactions: 2 },
      { bucket: '2025-03-11T06:00:00.000Z', revenue: 0, netProfit: 0, transactions: 0 },
      { bucket: '2025-03-12T06:00:00.000Z', revenue: 262, netProfit: 110, transactions: 1 },
    ])
  })

  test('tendencia por hora y por semana', async () => {
    const hourly = await call('GET', `/api/v1/reports/sales-trend?${range}&granularity=hour`, { token: ownerToken })
    expect(hourly.body).toHaveLength(72)
    expect(hourly.body.filter((point: Json) => point.transactions > 0).map((point: Json) => point.bucket)).toEqual([
      '2025-03-10T18:00:00.000Z',
      '2025-03-11T05:00:00.000Z',
      '2025-03-12T15:00:00.000Z',
    ])
    const weekly = await call('GET', `/api/v1/reports/sales-trend?${range}&granularity=week`, { token: ownerToken })
    // El lunes 10 de marzo de 2025 abre la semana
    expect(weekly.body).toEqual([{ bucket: '2025-03-10T06:00:00.000Z', revenue: 468, netProfit: 190, transactions: 3 }])
  })

  test('productos de mayor rotación según la métrica', async () => {
    const byQuantity = await call('GET', `/api/v1/reports/top-products?${range}`, { token: ownerToken })
    expect(byQuantity.body).toEqual([
      { productId: 'REP-B', name: 'Reporte B', quantity: 4, revenue: 120, netProfit: 40 },
      { productId: 'REP-A', name: 'Reporte A', quantity: 3, revenue: 348, netProfit: 150 },
    ])
    const byRevenue = await call('GET', `/api/v1/reports/top-products?${range}&by=revenue&limit=1`, { token: ownerToken })
    expect(byRevenue.body.map((p: Json) => p.productId)).toEqual(['REP-A'])
  })

  test('rangos inválidos y permisos', async () => {
    const reversed = await call('GET', '/api/v1/reports/summary?from=2025-03-13T00:00:00Z&to=2025-03-10T00:00:00Z', { token: ownerToken })
    expect([reversed.status, reversed.body.error.code]).toEqual([400, 'INVALID_RANGE'])

    const tooManyHours = await call(
      'GET',
      '/api/v1/reports/sales-trend?from=2025-01-01T00:00:00Z&to=2025-03-01T00:00:00Z&granularity=hour',
      { token: ownerToken },
    )
    expect([tooManyHours.status, tooManyHours.body.error.code]).toEqual([400, 'RANGE_TOO_LARGE'])

    expect((await call('GET', '/api/v1/reports/summary?from=ayer&to=hoy', { token: ownerToken })).status).toBe(400)
    expect((await call('GET', `/api/v1/reports/summary?${range}`, { token: customerToken })).status).toBe(403)
  })
})

describe('historiales, ticket y cancelación', () => {
  const sell = async (body: Record<string, unknown>) =>
    (await call('POST', '/api/v1/sales', { token: ownerToken, body: { paymentMethod: 'CARD', ...body } })).body
  const stockOf = async (id: string) => (await call('GET', `/api/v1/products/${id}`, { token: ownerToken })).body.stock

  beforeAll(async () => {
    const categoryId = (
      await call('POST', '/api/v1/categories', { token: ownerToken, body: { name: 'Cancelaciones', color: '#DC2626' } })
    ).body.id
    for (const [id, price, taxRate] of [['CAN-A', 116, 0.16], ['CAN-B', 30, 0]] as const) {
      await call('POST', '/api/v1/products', {
        token: ownerToken,
        body: { id, name: id, categoryId, price, purchaseCost: 10, taxRate, initialStock: 10 },
      })
    }
  })

  test('el cliente ve solo sus compras, agrupadas por día', async () => {
    await sell({ items: [{ productId: 'CAN-B', quantity: 1 }], customerId })
    const res = await call('GET', '/api/v1/me/purchases', { token: customerToken })
    expect(res.status).toBe(200)
    const sales = res.body.groups.flatMap((group: Json) => group.sales)
    expect(sales.length).toBeGreaterThanOrEqual(2)
    expect(res.body.meta.total).toBe(sales.length)
    expect(sales.every((sale: Json) => sale.customer?.id === customerId)).toBe(true)
    for (const group of res.body.groups) expect(group.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    const detail = await call('GET', `/api/v1/me/purchases/${sales[0].id}`, { token: customerToken })
    expect(detail.body).toMatchObject({ id: sales[0].id, items: expect.any(Array) })
  })

  test('una compra ajena responde 404 (no revela que existe); el propietario no usa /me', async () => {
    const anonymous = await sell({ items: [{ productId: 'CAN-B', quantity: 1 }] })
    const res = await call('GET', `/api/v1/me/purchases/${anonymous.id}`, { token: customerToken })
    expect([res.status, res.body.error.code]).toEqual([404, 'PURCHASE_NOT_FOUND'])
    expect((await call('GET', '/api/v1/me/purchases', { token: ownerToken })).status).toBe(403)
  })

  test('historial del propietario: orden, filtros y paginación', async () => {
    const all = await call('GET', '/api/v1/sales?limit=100', { token: ownerToken })
    const times = all.body.data.map((sale: Json) => Date.parse(sale.dateTime))
    expect(times).toEqual([...times].sort((a, b) => b - a))
    expect(all.body.data[0]).toEqual(
      expect.objectContaining({ folio: expect.any(Number), itemCount: expect.any(Number), totalAmount: expect.any(Number) }),
    )
    expect(all.body.data[0].items).toBeUndefined() // el resumen no trae partidas

    const folio = all.body.data[3].folio
    const byFolio = await call('GET', `/api/v1/sales?folio=${folio}`, { token: ownerToken })
    expect(byFolio.body.data.map((sale: Json) => sale.folio)).toEqual([folio])

    const cancelled = await call('GET', '/api/v1/sales?status=CANCELLED', { token: ownerToken })
    expect(cancelled.body.data.every((sale: Json) => sale.status === 'CANCELLED')).toBe(true)

    const paged = await call('GET', '/api/v1/sales?limit=2&page=2&type=MANUAL', { token: ownerToken })
    expect(paged.body.meta).toMatchObject({ page: 2, limit: 2 })
    expect(paged.body.data).toHaveLength(2)

    const badRange = await call('GET', '/api/v1/sales?from=2026-01-02T00:00:00Z&to=2026-01-01T00:00:00Z', { token: ownerToken })
    expect(badRange.body.error.code).toBe('INVALID_RANGE')
  })

  test('ticket para reimprimir: negocio y desglose de IVA por tasa', async () => {
    const sale = await sell({
      items: [
        { productId: 'CAN-A', quantity: 1 },
        { productId: 'CAN-B', quantity: 1 },
      ],
    })
    const res = await call('GET', `/api/v1/sales/${sale.id}/receipt`, { token: ownerToken })
    expect(res.status).toBe(200)
    expect(res.body.business.name).toBe('Smart Abarrotes')
    expect(res.body.sale.folio).toBe(sale.folio)
    expect(res.body.taxBreakdown).toEqual([
      { rate: 0, base: 30, tax: 0 },
      { rate: 0.16, base: 100, tax: 16 },
    ])
    expect(Date.parse(res.body.printedAt)).toBeGreaterThan(0)
  })

  test('cancelar: repone stock, deja kardex y marca el reembolso', async () => {
    const before = await stockOf('CAN-A')
    const sale = await sell({ items: [{ productId: 'CAN-A', quantity: 2 }] })
    expect(await stockOf('CAN-A')).toBe(before - 2)

    const res = await call('POST', `/api/v1/sales/${sale.id}/cancel`, { token: ownerToken, body: { reason: '  Cliente devolvió  ' } })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      status: 'CANCELLED',
      paymentStatus: 'REFUNDED',
      cancelReason: 'Cliente devolvió',
    })
    expect(Date.parse(res.body.cancelledAt)).toBeGreaterThan(0)
    expect(await stockOf('CAN-A')).toBe(before)

    const kardex = await call('GET', '/api/v1/inventory/movements?productId=CAN-A&type=CANCELLATION', { token: ownerToken })
    expect(kardex.body.data[0]).toMatchObject({ quantityDelta: 2, stockAfter: before, saleId: sale.id })
    expect(kardex.body.data[0].note).toContain(`#${sale.folio}`)

    const again = await call('POST', `/api/v1/sales/${sale.id}/cancel`, { token: ownerToken, body: { reason: 'otra vez' } })
    expect([again.status, again.body.error.code]).toEqual([409, 'SALE_ALREADY_CANCELLED'])
    expect((await call('POST', `/api/v1/sales/${sale.id}/cancel`, { token: ownerToken, body: { reason: 'x' } })).status).toBe(400)
    expect((await call('POST', `/api/v1/sales/${crypto.randomUUID()}/cancel`, { token: ownerToken, body: { reason: 'nada' } })).status).toBe(404)
    expect((await call('POST', `/api/v1/sales/${sale.id}/cancel`, { token: customerToken, body: { reason: 'mía' } })).status).toBe(403)
  })

  test('dos cancelaciones simultáneas: solo una procede y el stock se repone una vez', async () => {
    const before = await stockOf('CAN-B')
    const sale = await sell({ items: [{ productId: 'CAN-B', quantity: 3 }] })
    const results = await Promise.all(
      [1, 2].map(() => call('POST', `/api/v1/sales/${sale.id}/cancel`, { token: ownerToken, body: { reason: 'Duplicada' } })),
    )
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
    expect(await stockOf('CAN-B')).toBe(before)
  })

  test('en el historial del cliente la compra cancelada no suma al total del día', async () => {
    const sale = await sell({ items: [{ productId: 'CAN-A', quantity: 1 }], customerId })
    await call('POST', `/api/v1/sales/${sale.id}/cancel`, { token: ownerToken, body: { reason: 'Error de cobro' } })
    const res = await call('GET', '/api/v1/me/purchases', { token: customerToken })
    const group = res.body.groups.find((g: Json) => g.sales.some((s: Json) => s.id === sale.id))
    const completed = group.sales.filter((s: Json) => s.status === 'COMPLETED').reduce((sum: number, s: Json) => sum + s.totalAmount, 0)
    expect(group.sales.find((s: Json) => s.id === sale.id).status).toBe('CANCELLED')
    expect(group.totalAmount).toBeCloseTo(completed, 2)
  })
})

describe('flujo automático (Smart Store)', () => {
  const signer = new JoseEntryPassSigner(env.ENTRY_PASS_SECRET)
  const webhookSigner = new HmacWebhookSignatureVerifier(env.WEBHOOK_SECRET)
  const deviceKey = parseList(env.STORE_DEVICE_KEYS)[1]!
  let shopperToken = ''
  let shopperId = ''

  const stockOf = async (id: string) => (await call('GET', `/api/v1/products/${id}`, { token: ownerToken })).body.stock
  const visitStatus = async (id: string) =>
    ((await AppDataSource.query(`SELECT status FROM store_visits WHERE id = $1`, [id])) as { status: string }[])[0]?.status
  const pass = async () => (await call('GET', '/api/v1/me/entry-pass', { token: shopperToken })).body.token as string

  const enter = (token: string, key: string | null = deviceKey) =>
    app
      .handle(
        new Request('http://localhost/api/v1/store/entry', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(key !== null && { 'x-device-key': key }) },
          body: JSON.stringify({ token, gateId: 'ENTRADA-1' }),
        }),
      )
      .then(async (response) => ({ status: response.status, body: (await response.json()) as Json }))

  /** Abre una visita nueva del cliente de este bloque y devuelve su id */
  const openVisit = async () => {
    const res = await enter(await pass())
    expect(res.status).toBe(201)
    return res.body.visitId as string
  }

  const webhook = (payload: unknown, signature?: string | null) => {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload)
    const header = signature === undefined ? webhookSigner.sign(raw) : signature
    return app
      .handle(
        new Request('http://localhost/api/v1/webhooks/checkout', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(header !== null && { 'x-signature': header }) },
          body: raw,
        }),
      )
      .then(async (response) => ({ status: response.status, body: (await response.json()) as Json }))
  }

  const checkout = (visitId: string, items: unknown[], eventId: string = crypto.randomUUID()) =>
    webhook({ eventId, visitId, exitedAt: new Date().toISOString(), items })

  beforeAll(async () => {
    const categoryId = (
      await call('POST', '/api/v1/categories', { token: ownerToken, body: { name: 'Smart Store', color: '#0EA5E9' } })
    ).body.id
    const product = (id: string, body: Record<string, unknown>) =>
      call('POST', '/api/v1/products', { token: ownerToken, body: { id, name: id, categoryId, purchaseCost: 10, ...body } })
    await product('AUT-A', { price: 116, taxRate: 0.16, initialStock: 2 })
    await product('AUT-B', { price: 30, taxRate: 0, barcode: '2009999000011', initialStock: 50 })
    await product('AUT-INACTIVO', { price: 10, taxRate: 0.16, initialStock: 1, status: 'INACTIVE' })

    const registered = await call('POST', '/api/v1/auth/register', {
      body: { name: 'Beto Smart', email: 'beto@smart.mx', password: 'secreta-123' },
    })
    shopperToken = registered.body.accessToken
    shopperId = registered.body.user.id
  })

  afterAll(() => {
    gateway.rejectRefunds = false
  })

  test('al registrarse se vincula el método de pago simulado (sin exponerlo)', async () => {
    const [row] = await AppDataSource.query(`SELECT payment_customer_ref AS ref FROM users WHERE id = $1`, [shopperId])
    expect(row.ref).toStartWith('mock_cus_')
    expect(JSON.stringify((await call('GET', '/api/v1/auth/me', { token: shopperToken })).body)).not.toContain('mock_cus_')
  })

  test('entrada: QR válido abre la visita; reutilizarlo → 409', async () => {
    const token = await pass()
    const res = await enter(token)
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ user: { id: shopperId, name: 'Beto Smart' } })
    expect(Date.parse(res.body.enteredAt)).toBeGreaterThan(0)
    expect(await visitStatus(res.body.visitId)).toBe('ACTIVE')

    const again = await enter(token)
    expect([again.status, again.body.error.code]).toEqual([409, 'ENTRY_TOKEN_REUSED'])
    // El intento rechazado no abandona la visita abierta
    expect(await visitStatus(res.body.visitId)).toBe('ACTIVE')
  })

  test('entrada: llave de dispositivo y token inválidos → 401; cuenta desactivada → 403', async () => {
    expect((await enter(await pass(), 'llave-incorrecta-123456')).body.error.code).toBe('INVALID_DEVICE_KEY')
    expect((await enter(await pass(), null)).status).toBe(401)

    const otherSecret = await new JoseEntryPassSigner(env.JWT_SECRET).sign({
      userId: shopperId,
      jti: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 60_000),
    })
    const expired = await signer.sign({ userId: shopperId, jti: crypto.randomUUID(), expiresAt: new Date(Date.now() - 1000) })
    for (const token of [otherSecret, expired, 'basura']) {
      const res = await enter(token)
      expect([res.status, res.body.error.code]).toEqual([401, 'INVALID_ENTRY_TOKEN'])
    }

    await AppDataSource.query(`UPDATE users SET is_active = false WHERE id = $1`, [shopperId])
    const disabled = await enter(await signer.sign({ userId: shopperId, jti: crypto.randomUUID(), expiresAt: new Date(Date.now() + 60_000) }))
    await AppDataSource.query(`UPDATE users SET is_active = true WHERE id = $1`, [shopperId])
    expect([disabled.status, disabled.body.error.code]).toEqual([403, 'ACCOUNT_DISABLED'])
  })

  test('volver a entrar marca ABANDONED la visita activa anterior', async () => {
    const first = await openVisit()
    const second = await openVisit()
    expect(await visitStatus(first)).toBe('ABANDONED')
    expect(await visitStatus(second)).toBe('ACTIVE')

    const res = await checkout(first, [{ productId: 'AUT-B', quantity: 1 }])
    expect([res.status, res.body.error.code]).toEqual([409, 'VISIT_CLOSED'])
  })

  test('webhook: firma, JSON y esquema inválidos', async () => {
    const visitId = await openVisit()
    const payload = { eventId: crypto.randomUUID(), visitId, exitedAt: new Date().toISOString(), items: [] }

    const wrong = await webhook(payload, 'sha256=' + '0'.repeat(64))
    expect([wrong.status, wrong.body.error.code]).toEqual([401, 'INVALID_SIGNATURE'])
    expect((await webhook(payload, null)).status).toBe(401)
    // Firma de otro cuerpo: alterar un byte la invalida
    expect((await webhook(JSON.stringify(payload) + ' ', webhookSigner.sign(JSON.stringify(payload)))).status).toBe(401)

    expect((await webhook('{malformado')).body.error.code).toBe('INVALID_BODY')
    const invalid = await webhook({ ...payload, visitId: 'no-es-uuid', items: [{ productId: 'AUT-B', quantity: 0 }] })
    expect([invalid.status, invalid.body.error.code]).toEqual([400, 'VALIDATION_ERROR'])
    expect(invalid.body.error.details.length).toBeGreaterThan(0)
    expect(await visitStatus(visitId)).toBe('ACTIVE')
  })

  test('venta AUTOMATED: cobra, descuenta stock aunque quede negativo y cierra la visita', async () => {
    const visitId = await openVisit()
    const exitedAt = new Date().toISOString()
    const res = await webhook({
      eventId: 'evt-venta-1',
      visitId,
      exitedAt,
      items: [
        { productId: 'AUT-A', quantity: 3 }, // solo hay 2: queda en −1
        { barcode: '2009999000011', quantity: 1 },
        { productId: 'AUT-B', quantity: 1 },
        { productId: 'AUT-INACTIVO', quantity: 1 }, // inactivo, pero ya salió de la tienda
      ],
    })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ visitId, totalAmount: 418, paymentStatus: 'PAID' })
    expect(res.body.folio).toBeGreaterThan(0)

    const sale = (await call('GET', `/api/v1/sales/${res.body.saleId}`, { token: ownerToken })).body
    expect(sale).toMatchObject({
      saleType: 'AUTOMATED',
      paymentMethod: 'CARD_ON_FILE',
      paymentStatus: 'PAID',
      cashier: null,
      customer: { id: shopperId, name: 'Beto Smart' },
      itemCount: 6,
    })
    expect(new Date(sale.dateTime).toISOString()).toBe(exitedAt)
    expect(sale.paymentReference).toStartWith('mock_ch_')
    expect(sale.items.find((item: Json) => item.productId === 'AUT-B').quantity).toBe(2)

    expect(await stockOf('AUT-A')).toBe(-1)
    expect(await visitStatus(visitId)).toBe('COMPLETED')
    const kardex = await call('GET', '/api/v1/inventory/movements?productId=AUT-A&type=SALE', { token: ownerToken })
    expect(kardex.body.data[0]).toMatchObject({ quantityDelta: -3, stockAfter: -1, saleId: sale.id })

    const purchases = await call('GET', '/api/v1/me/purchases', { token: shopperToken })
    expect(purchases.body.groups.flatMap((g: Json) => g.sales).some((s: Json) => s.id === sale.id)).toBe(true)
  })

  test('idempotencia: el mismo eventId devuelve la misma venta; otro evento sobre la visita cerrada → 409', async () => {
    const visitId = await openVisit()
    const before = await stockOf('AUT-B')
    const payload = { eventId: 'evt-idem-1', visitId, exitedAt: new Date().toISOString(), items: [{ productId: 'AUT-B', quantity: 2 }] }
    const first = await webhook(payload)
    const retry = await webhook(payload)
    expect(first.status).toBe(200)
    expect(retry).toEqual(first)
    expect(await stockOf('AUT-B')).toBe(before - 2)

    const other = await checkout(visitId, [{ productId: 'AUT-B', quantity: 1 }])
    expect([other.status, other.body.error.code]).toEqual([409, 'VISIT_CLOSED'])

    // El mismo eventId no puede cerrar otra visita
    const reused = await checkout(await openVisit(), [{ productId: 'AUT-B', quantity: 1 }], 'evt-idem-1')
    expect([reused.status, reused.body.error.code]).toEqual([409, 'EVENT_ID_CONFLICT'])
  })

  test('dos entregas simultáneas del mismo evento: una sola venta y un solo descuento', async () => {
    const visitId = await openVisit()
    const before = await stockOf('AUT-B')
    const payload = { eventId: 'evt-doble', visitId, exitedAt: new Date().toISOString(), items: [{ productId: 'AUT-B', quantity: 1 }] }
    const results = await Promise.all([webhook(payload), webhook(payload)])
    expect(results.map((r) => r.status)).toEqual([200, 200])
    expect(results[0]!.body.saleId).toBe(results[1]!.body.saleId)
    expect(await stockOf('AUT-B')).toBe(before - 1)
  })

  test('items vacío: cierra la visita sin venta (también idempotente)', async () => {
    const visitId = await openVisit()
    const payload = { eventId: 'evt-vacio', visitId, exitedAt: new Date().toISOString(), items: [] }
    const res = await webhook(payload)
    expect(res).toEqual({ status: 200, body: { visitId, saleId: null, folio: null, totalAmount: 0, paymentStatus: null } })
    expect(await visitStatus(visitId)).toBe('COMPLETED')
    expect(await webhook(payload)).toEqual(res)
  })

  test('visita o producto desconocidos → 404; partida sin código o salida fuera de rango → 400', async () => {
    const unknownVisit = await checkout(crypto.randomUUID(), [])
    expect([unknownVisit.status, unknownVisit.body.error.code]).toEqual([404, 'VISIT_NOT_FOUND'])

    const visitId = await openVisit()
    const before = await stockOf('AUT-B')
    const unknownProduct = await checkout(visitId, [
      { productId: 'AUT-B', quantity: 1 },
      { productId: 'NO-EXISTE', quantity: 1 },
    ])
    expect([unknownProduct.status, unknownProduct.body.error.code]).toEqual([404, 'PRODUCT_NOT_FOUND'])
    expect((await checkout(visitId, [{ barcode: '0000000000000', quantity: 1 }])).body.error.code).toBe('PRODUCT_NOT_FOUND')
    expect((await checkout(visitId, [{ quantity: 1 }])).body.error.code).toBe('ITEM_CODE_REQUIRED')
    const early = await webhook({ eventId: crypto.randomUUID(), visitId, exitedAt: '2020-01-01T00:00:00Z', items: [] })
    expect([early.status, early.body.error.code]).toEqual([400, 'INVALID_EXITED_AT'])

    // Nada quedó a medias: la visita sigue abierta y el stock intacto
    expect(await visitStatus(visitId)).toBe('ACTIVE')
    expect(await stockOf('AUT-B')).toBe(before)
    expect((await checkout(visitId, [{ productId: 'AUT-B', quantity: 1 }])).status).toBe(200)
  })

  test('cobro fallido: la venta queda FAILED y aparece como adeudo en el resumen', async () => {
    await AppDataSource.query(`UPDATE users SET payment_customer_ref = NULL WHERE id = $1`, [shopperId])
    const res = await checkout(await openVisit(), [{ productId: 'AUT-B', quantity: 2 }])
    await AppDataSource.query(`UPDATE users SET payment_customer_ref = 'mock_cus_restaurado' WHERE id = $1`, [shopperId])

    expect(res.body).toMatchObject({ totalAmount: 60, paymentStatus: 'FAILED' })
    const sale = (await call('GET', `/api/v1/sales/${res.body.saleId}`, { token: ownerToken })).body
    expect(sale.paymentReference).toBeNull()

    const from = new Date(Date.now() - 3_600_000).toISOString()
    const to = new Date(Date.now() + 3_600_000).toISOString()
    const summary = await call('GET', `/api/v1/reports/summary?from=${from}&to=${to}`, { token: ownerToken })
    expect(summary.body.pendingPayments).toBeCloseTo(60, 2)
  })

  test('cancelar una venta automática reembolsa en la pasarela; si la pasarela falla, no se cancela', async () => {
    const paid = (await checkout(await openVisit(), [{ productId: 'AUT-B', quantity: 3 }])).body
    const sale = (await call('GET', `/api/v1/sales/${paid.saleId}`, { token: ownerToken })).body
    const stockBefore = await stockOf('AUT-B')

    gateway.rejectRefunds = true
    const rejected = await call('POST', `/api/v1/sales/${sale.id}/cancel`, { token: ownerToken, body: { reason: 'Devolución' } })
    gateway.rejectRefunds = false
    expect([rejected.status, rejected.body.error.code]).toEqual([422, 'REFUND_FAILED'])
    expect((await call('GET', `/api/v1/sales/${sale.id}`, { token: ownerToken })).body).toMatchObject({
      status: 'COMPLETED',
      paymentStatus: 'PAID',
    })
    expect(await stockOf('AUT-B')).toBe(stockBefore)

    const refundsBefore = gateway.refunds.length
    const cancelled = await call('POST', `/api/v1/sales/${sale.id}/cancel`, { token: ownerToken, body: { reason: 'Devolución' } })
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REFUNDED' })
    expect(gateway.refunds.slice(refundsBefore)).toEqual([
      { transactionId: sale.paymentReference, amount: 90, reference: sale.id },
    ])
    expect(await stockOf('AUT-B')).toBe(stockBefore + 3)
  })

  test('cancelar una venta con cobro fallido no llama a la pasarela', async () => {
    await AppDataSource.query(`UPDATE users SET payment_customer_ref = NULL WHERE id = $1`, [shopperId])
    const failed = (await checkout(await openVisit(), [{ productId: 'AUT-B', quantity: 1 }])).body
    await AppDataSource.query(`UPDATE users SET payment_customer_ref = 'mock_cus_restaurado' WHERE id = $1`, [shopperId])

    const refundsBefore = gateway.refunds.length
    const res = await call('POST', `/api/v1/sales/${failed.saleId}/cancel`, { token: ownerToken, body: { reason: 'Sin cobro' } })
    expect(res.body).toMatchObject({ status: 'CANCELLED', paymentStatus: 'FAILED' })
    expect(gateway.refunds.length).toBe(refundsBefore)
  })

  test('pasarela simulada: rechaza sin método de pago y según la tasa de fallos', async () => {
    const sometimes = new MockPaymentGateway({ failureRate: 0.5, random: () => 0.4 })
    const ref = await sometimes.registerCustomer({ id: shopperId, name: 'x', email: 'x@x.mx' })
    expect(await sometimes.charge({ customerRef: ref, amount: 10, reference: 'r' })).toEqual({ approved: false, reason: 'CARD_DECLINED' })
    expect(await sometimes.charge({ customerRef: null, amount: 10, reference: 'r' })).toEqual({ approved: false, reason: 'NO_PAYMENT_METHOD' })
    const never = new MockPaymentGateway({ failureRate: 0.5, random: () => 0.6 })
    expect((await never.charge({ customerRef: ref, amount: 10, reference: 'r' })).approved).toBe(true)
  })

  test('simulador de demo (POST /dev/simulate-visit)', async () => {
    const missing = await call('POST', '/api/v1/dev/simulate-visit', { token: ownerToken })
    expect([missing.status, missing.body.error.code]).toEqual([404, 'SIMULATION_CUSTOMER_NOT_FOUND'])

    await call('POST', '/api/v1/auth/register', {
      body: { name: 'Cliente Simulado', email: env.SEED_CUSTOMER_EMAIL, password: 'secreta-123' },
    })
    const res = await call('POST', '/api/v1/dev/simulate-visit', { token: ownerToken })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ customer: { name: 'Cliente Simulado' }, paymentStatus: 'PAID' })
    expect(res.body.itemCount).toBeGreaterThan(0)
    expect(res.body.totalAmount).toBeGreaterThan(0)
    expect(await visitStatus(res.body.visitId)).toBe('COMPLETED')

    expect((await call('POST', '/api/v1/dev/simulate-visit', { token: shopperToken })).status).toBe(403)
  })
})

describe('puerta del propietario (/store-visits)', () => {
  let guestToken = ''
  let guestId = ''

  const pass = async () => (await call('GET', '/api/v1/me/entry-pass', { token: guestToken })).body.token as string
  const admit = (token: string, as = ownerToken, gateId?: string) =>
    call('POST', '/api/v1/store-visits', { token: as, body: { token, ...(gateId && { gateId }) } })
  const stockOf = async (id: string) => (await call('GET', `/api/v1/products/${id}`, { token: ownerToken })).body.stock
  const visitStatus = async (id: string) =>
    ((await AppDataSource.query(`SELECT status FROM store_visits WHERE id = $1`, [id])) as { status: string }[])[0]?.status

  beforeAll(async () => {
    const categoryId = (
      await call('POST', '/api/v1/categories', { token: ownerToken, body: { name: 'Puerta', color: '#22C55E' } })
    ).body.id
    await call('POST', '/api/v1/products', {
      token: ownerToken,
      body: { id: 'GATE-A', name: 'Producto puerta', categoryId, price: 50, purchaseCost: 30, taxRate: 0, barcode: '2009999000028', initialStock: 10 },
    })
    const registered = await call('POST', '/api/v1/auth/register', {
      body: { name: 'Carla Puerta', email: 'carla@puerta.mx', password: 'secreta-123' },
    })
    guestToken = registered.body.accessToken
    guestId = registered.body.user.id
  })

  test('el QR del cliente abre la visita y aparece en la lista de activas', async () => {
    const res = await admit(await pass(), ownerToken, 'PUERTA-PRUEBA')
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ user: { id: guestId, name: 'Carla Puerta' } })

    const list = await call('GET', '/api/v1/store-visits', { token: ownerToken })
    expect(list.status).toBe(200)
    expect(list.body.find((visit: Json) => visit.id === res.body.visitId)).toMatchObject({
      customer: { id: guestId, name: 'Carla Puerta' },
      gateId: 'PUERTA-PRUEBA',
      status: 'ACTIVE',
      exitedAt: null,
    })
  })

  test('puerta por defecto, QR inválido → 422 (no 401), reusado → 409, cliente → 403', async () => {
    const token = await pass()
    const first = await admit(token)
    expect(first.status).toBe(201)
    const [row] = await AppDataSource.query(`SELECT gate_id FROM store_visits WHERE id = $1`, [first.body.visitId])
    expect(row.gate_id).toBe('PUERTA-TELEFONO')

    const reused = await admit(token)
    expect([reused.status, reused.body.error.code]).toEqual([409, 'ENTRY_TOKEN_REUSED'])

    const invalid = await admit('basura')
    expect([invalid.status, invalid.body.error.code]).toEqual([422, 'INVALID_ENTRY_TOKEN'])

    expect((await admit(await pass(), guestToken)).status).toBe(403)
    expect((await call('GET', '/api/v1/store-visits', { token: guestToken })).status).toBe(403)
    expect((await call('GET', '/api/v1/store-visits?status=OTRO', { token: ownerToken })).status).toBe(400)
  })

  test('salida con productos → venta AUTOMATED, cobro y descuento de stock; segunda salida → 409', async () => {
    const visitId = (await admit(await pass())).body.visitId as string
    const stockBefore = await stockOf('GATE-A')

    const res = await call('POST', `/api/v1/store-visits/${visitId}/checkout`, {
      token: ownerToken,
      body: { items: [{ productId: 'GATE-A', quantity: 2 }, { barcode: '2009999000028', quantity: 1 }] },
    })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ visitId, totalAmount: 150, paymentStatus: 'PAID' })
    expect(await stockOf('GATE-A')).toBe(stockBefore - 3)
    expect(await visitStatus(visitId)).toBe('COMPLETED')

    const sale = await call('GET', `/api/v1/sales/${res.body.saleId}`, { token: ownerToken })
    expect(sale.body).toMatchObject({ saleType: 'AUTOMATED', paymentMethod: 'CARD_ON_FILE' })

    const again = await call('POST', `/api/v1/store-visits/${visitId}/checkout`, { token: ownerToken, body: { items: [] } })
    expect([again.status, again.body.error.code]).toEqual([409, 'VISIT_CLOSED'])

    const closed = await call('GET', '/api/v1/store-visits?status=COMPLETED', { token: ownerToken })
    expect(closed.body.find((visit: Json) => visit.id === visitId)?.exitedAt).toBeString()
  })

  test('salida sin compra cierra la visita; visita o producto desconocido → 404', async () => {
    const visitId = (await admit(await pass())).body.visitId as string
    const unknownProduct = await call('POST', `/api/v1/store-visits/${visitId}/checkout`, {
      token: ownerToken,
      body: { items: [{ productId: 'NO-EXISTE', quantity: 1 }] },
    })
    expect([unknownProduct.status, unknownProduct.body.error.code]).toEqual([404, 'PRODUCT_NOT_FOUND'])
    expect(await visitStatus(visitId)).toBe('ACTIVE')

    const empty = await call('POST', `/api/v1/store-visits/${visitId}/checkout`, { token: ownerToken, body: { items: [] } })
    expect(empty.status).toBe(200)
    expect(empty.body).toMatchObject({ visitId, saleId: null, folio: null, totalAmount: 0, paymentStatus: null })
    expect(await visitStatus(visitId)).toBe('COMPLETED')

    const missing = await call('POST', `/api/v1/store-visits/${crypto.randomUUID()}/checkout`, { token: ownerToken, body: { items: [] } })
    expect([missing.status, missing.body.error.code]).toEqual([404, 'VISIT_NOT_FOUND'])
  })
})

describe('configuración (/settings)', () => {
  const printer = { connection: 'USB', address: '0416:5011', paperWidthMm: 58 }

  test('GET devuelve la configuración que creó el seed; solo OWNER', async () => {
    const res = await call('GET', '/api/v1/settings', { token: ownerToken })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      businessName: 'Smart Abarrotes',
      legalName: null,
      rfc: null,
      currency: 'MXN',
      defaultTaxRate: 0.16,
      pricesIncludeTax: true,
      ticketFooter: null,
      peripherals: {},
    })
    expect(Date.parse(res.body.updatedAt)).not.toBeNaN()

    expect((await call('GET', '/api/v1/settings')).status).toBe(401)
    expect((await call('GET', '/api/v1/settings', { token: customerToken })).status).toBe(403)
    expect((await call('PATCH', '/api/v1/settings', { token: customerToken, body: { phone: '5555555555' } })).status).toBe(403)
  })

  test('PATCH parcial: normaliza textos y conserva lo omitido', async () => {
    const res = await call('PATCH', '/api/v1/settings', {
      token: ownerToken,
      body: {
        businessName: '  Abarrotes Doña Mary ',
        rfc: 'mary800101ab1',
        legalName: '   ',
        ticketFooter: '¡Gracias por su compra!',
        defaultTaxRate: 0.08,
        peripherals: { printer, barcodeScanner: { mode: 'KEYBOARD_WEDGE' } },
      },
    })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      businessName: 'Abarrotes Doña Mary',
      rfc: 'MARY800101AB1',
      legalName: null,
      address: 'Dirección por configurar',
      ticketFooter: '¡Gracias por su compra!',
      defaultTaxRate: 0.08,
      peripherals: { printer, barcodeScanner: { mode: 'KEYBOARD_WEDGE' } },
    })

    const again = await call('GET', '/api/v1/settings', { token: ownerToken })
    expect(again.body).toEqual(res.body)
  })

  test('peripherals: reemplaza solo los dispositivos enviados', async () => {
    const res = await call('PATCH', '/api/v1/settings', {
      token: ownerToken,
      body: { peripherals: { cardTerminal: { provider: ' Clip ', terminalId: '' } } },
    })
    expect(res.status).toBe(200)
    expect(res.body.peripherals).toEqual({
      printer,
      barcodeScanner: { mode: 'KEYBOARD_WEDGE' },
      cardTerminal: { provider: 'Clip', terminalId: null },
    })
  })

  test('validación: RFC inválido, textos vacíos, dispositivo incompleto y body vacío → 400', async () => {
    const invalid = [
      { rfc: 'ABC123' },
      { businessName: '' },
      { address: '' },
      { defaultTaxRate: 1.5 },
      { logoUrl: 'no-es-url' },
      { peripherals: { printer: { connection: 'USB' } } },
      { peripherals: { printer: { ...printer, paperWidthMm: 70 } } },
      {},
    ]
    for (const body of invalid) {
      const res = await call('PATCH', '/api/v1/settings', { token: ownerToken, body })
      expect([JSON.stringify(body), res.status]).toEqual([JSON.stringify(body), 400])
    }
    // Nada de lo anterior se guardó
    const current = await call('GET', '/api/v1/settings', { token: ownerToken })
    expect(current.body).toMatchObject({ businessName: 'Abarrotes Doña Mary', defaultTaxRate: 0.08 })
  })

  test('el ticket usa el perfil y las altas sin taxRate usan defaultTaxRate', async () => {
    const created = await call('POST', '/api/v1/products', {
      token: ownerToken,
      body: { id: 'CFG-IVA', name: 'Producto zona fronteriza', categoryId, price: 10.8, purchaseCost: 5, initialStock: 2 },
    })
    expect([created.status, created.body.taxRate]).toEqual([201, 0.08])

    const sale = await call('POST', '/api/v1/sales', {
      token: ownerToken,
      body: { items: [{ productId: 'CFG-IVA', quantity: 1 }], paymentMethod: 'CARD' },
    })
    expect(sale.status).toBe(201)
    const receipt = await call('GET', `/api/v1/sales/${sale.body.id}/receipt`, { token: ownerToken })
    expect(receipt.body.business).toMatchObject({
      name: 'Abarrotes Doña Mary',
      rfc: 'MARY800101AB1',
      footer: '¡Gracias por su compra!',
    })
    expect(receipt.body.taxBreakdown).toEqual([expect.objectContaining({ rate: 0.08 })])
  })
})

describe('ShelfSight (/shelf-events)', () => {
  // JPEG mínimo: el servidor solo revisa la firma del archivo y el tamaño
  const jpeg = `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]).toString('base64')}`
  const frames = { cameraId: 'iphone-repisa-1', beforeImage: jpeg, afterImage: jpeg, changeRatio: 0.05 }
  const sees = (analysis: Partial<ShelfAnalysis>) => {
    shelfVision.next = { action: ShelfAction.REMOVED, productId: 'SHELF-COCA', quantity: 1, confidence: 0.95, reason: 'Se llevaron una', ...analysis }
  }
  const stock = async () => (await call('GET', '/api/v1/products/SHELF-COCA', { token: ownerToken })).body.stock as number
  const post = () => call('POST', '/api/v1/shelf-events', { token: ownerToken, body: frames })

  beforeAll(async () => {
    const created = await call('POST', '/api/v1/products', {
      token: ownerToken,
      body: { id: 'SHELF-COCA', name: 'Coca-Cola 600 ml (repisa)', categoryId, price: 20, purchaseCost: 12, initialStock: 10 },
    })
    expect(created.status).toBe(201)
  })

  test('GET /shelf/vision informa el modelo y las reglas', async () => {
    const res = await call('GET', '/api/v1/shelf/vision', { token: ownerToken })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ visionEnabled: true, model: 'fake-vision' })
    expect((await call('GET', '/api/v1/shelf/vision', { token: customerToken })).status).toBe(403)
  })

  test('una salida con confianza alta se aplica sola al inventario', async () => {
    sees({ quantity: 2 })
    const res = await post()
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      status: 'APPLIED',
      action: 'REMOVED',
      quantity: 2,
      product: { id: 'SHELF-COCA', name: 'Coca-Cola 600 ml (repisa)' },
      reviewReason: null,
      changeRatio: 0.05,
    })
    expect(await stock()).toBe(8)
    const movements = await call('GET', '/api/v1/inventory/movements?productId=SHELF-COCA', { token: ownerToken })
    expect(movements.body.data[0]).toMatchObject({ id: res.body.movementId, type: 'ADJUSTMENT', quantityDelta: -2, stockAfter: 8 })
    expect(movements.body.data[0].note).toContain('ShelfSight')
  })

  test('una entrada (resurtido) suma con RESTOCK', async () => {
    sees({ action: ShelfAction.ADDED, quantity: 3 })
    const res = await post()
    expect(res.body.status).toBe('APPLIED')
    expect(await stock()).toBe(11)
  })

  test('con confianza baja queda en revisión; el dueño confirma y se aplica una sola vez', async () => {
    sees({ confidence: 0.4 })
    const res = await post()
    expect(res.body).toMatchObject({ status: 'PENDING_REVIEW', reviewReason: 'LOW_CONFIDENCE', movementId: null })
    expect(await stock()).toBe(11)

    const confirmPath = `/api/v1/shelf-events/${res.body.id}/confirm`
    const body = { action: 'REMOVED', productId: 'SHELF-COCA', quantity: 4 }
    const confirmed = await call('POST', confirmPath, { token: ownerToken, body })
    expect(confirmed.status).toBe(200)
    expect(confirmed.body).toMatchObject({ status: 'APPLIED', quantity: 4, reviewReason: null })
    expect(confirmed.body.movementId).toBeString()
    expect(await stock()).toBe(7)

    const again = await call('POST', confirmPath, { token: ownerToken, body })
    expect([again.status, again.body.error.code]).toEqual([409, 'SHELF_EVENT_RESOLVED'])
    expect(await stock()).toBe(7)
  })

  test('si la confirmación falla por stock, el evento vuelve a revisión', async () => {
    sees({ confidence: 0.2 })
    const res = await post()
    const confirmPath = `/api/v1/shelf-events/${res.body.id}/confirm`
    const tooMany = await call('POST', confirmPath, { token: ownerToken, body: { action: 'REMOVED', productId: 'SHELF-COCA', quantity: 50 } })
    expect([tooMany.status, tooMany.body.error.code]).toEqual([409, 'INSUFFICIENT_STOCK'])
    const detail = await call('GET', `/api/v1/shelf-events/${res.body.id}`, { token: ownerToken })
    expect(detail.body).toMatchObject({ status: 'PENDING_REVIEW', reviewReason: 'LOW_CONFIDENCE', resolvedAt: null })
  })

  test('producto desconocido, demasiadas piezas, stock insuficiente o error del modelo → revisión sin tocar el stock', async () => {
    sees({ productId: 'NO-EXISTE' })
    expect((await post()).body).toMatchObject({ status: 'PENDING_REVIEW', reviewReason: 'UNKNOWN_PRODUCT', product: null })
    sees({ quantity: 7 })
    expect((await post()).body).toMatchObject({ status: 'PENDING_REVIEW', reviewReason: 'QUANTITY_TOO_HIGH' })
    sees({ quantity: 6, action: ShelfAction.REMOVED })
    await post() // stock 7 → 1
    sees({ quantity: 2 })
    expect((await post()).body).toMatchObject({ status: 'PENDING_REVIEW', reviewReason: 'INSUFFICIENT_STOCK' })
    shelfVision.next = new Error('HTTP 429')
    const failed = await post()
    expect(failed.body).toMatchObject({ status: 'PENDING_REVIEW', reviewReason: 'VISION_ERROR', action: 'NONE' })
    expect(failed.body.note).toContain('HTTP 429')
    expect(await stock()).toBe(1)
  })

  test('el modelo puede contestar con el nombre del producto en lugar del SKU', async () => {
    sees({ action: ShelfAction.ADDED, productId: 'coca-cola 600 ML (repisa)', quantity: 1 })
    expect((await post()).body).toMatchObject({ status: 'APPLIED', product: { id: 'SHELF-COCA' } })
  })

  test('sin cambio → NO_CHANGE; el dueño puede descartarlo', async () => {
    sees({ action: ShelfAction.NONE, quantity: 0 })
    const res = await post()
    expect(res.body.status).toBe('NO_CHANGE')
    const rejected = await call('POST', `/api/v1/shelf-events/${res.body.id}/reject`, { token: ownerToken })
    expect([rejected.status, rejected.body.status]).toEqual([200, 'REJECTED'])
    const again = await call('POST', `/api/v1/shelf-events/${res.body.id}/reject`, { token: ownerToken })
    expect(again.status).toBe(409)
  })

  test('detalle con fotos, bitácora filtrada y validaciones', async () => {
    const list = await call('GET', '/api/v1/shelf-events?status=PENDING_REVIEW&limit=100', { token: ownerToken })
    expect(list.status).toBe(200)
    expect(list.body.data.length).toBeGreaterThan(0)
    expect(list.body.data.every((event: Json) => event.status === 'PENDING_REVIEW')).toBe(true)
    expect(list.body.data[0].beforeImage).toBeUndefined()

    const detail = await call('GET', `/api/v1/shelf-events/${list.body.data[0].id}`, { token: ownerToken })
    expect(detail.body.beforeImage).toBe(jpeg)
    expect(detail.body.afterImage).toBe(jpeg)

    const missing = await call('GET', '/api/v1/shelf-events/00000000-0000-4000-8000-000000000000', { token: ownerToken })
    expect([missing.status, missing.body.error.code]).toEqual([404, 'SHELF_EVENT_NOT_FOUND'])

    const notImage = `data:image/jpeg;base64,${Buffer.alloc(200, 7).toString('base64')}`
    const bad = await call('POST', '/api/v1/shelf-events', { token: ownerToken, body: { ...frames, afterImage: notImage } })
    expect([bad.status, bad.body.error.code]).toEqual([400, 'INVALID_IMAGE'])
  })
})

describe('seed', () => {
  test('es idempotente', async () => {
    const customer = { name: 'Cliente Demo', email: 'cliente@test.mx', password: 'cliente-123' }
    const options = { owner: OWNER, customer, withDemoCatalog: true, withDemoSales: true }
    const first = await runSeed(AppDataSource, options)
    expect(first).toEqual(['Catálogo demo: 6 categorías, 14 productos nuevos', 'Cliente demo creado: cliente@test.mx'])
    // Ya hay ventas (de las pruebas anteriores): el historial demo no se genera
    const second = await runSeed(AppDataSource, options)
    expect(second).toEqual(['Catálogo demo: 6 categorías, 0 productos nuevos'])
  })
})

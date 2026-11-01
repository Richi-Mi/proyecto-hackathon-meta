import { beforeAll, describe, expect, test } from 'bun:test'
import { createContainer } from '../src/container'
import { env } from '../src/infrastructure/config/env'
import { AppDataSource } from '../src/infrastructure/database/data-source'
import { runSeed } from '../src/infrastructure/database/seed'
import { JoseEntryPassSigner } from '../src/infrastructure/security/jose-entry-pass-signer'
import { createApp } from '../src/interfaces/http/app'

const OWNER = { name: 'Dueña Pruebas', email: 'owner@test.mx', password: 'owner-password-123' }

const container = createContainer(AppDataSource)
const app = createApp({
  useCases: container.useCases,
  checkDatabase: container.checkDatabase,
  config: { jwtSecret: env.JWT_SECRET, jwtExpiresInSeconds: 3600, corsOrigins: ['http://localhost:5173'] },
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

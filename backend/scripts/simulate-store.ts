/**
 * Simula una visita completa a la Smart Store contra la API en ejecución, por HTTP y como lo harían los dispositivos:
 *   1. el cliente demo inicia sesión y pide su pase QR (GET /me/entry-pass)
 *   2. el escáner lo valida con su llave (POST /store/entry, X-Device-Key)
 *   3. las cámaras reportan la salida con productos al azar (POST /webhooks/checkout, firmado con HMAC)
 *
 *   bun run simulate:store [--api http://localhost:3000/api/v1] [--items 3] [--empty]
 *
 * Lee de backend/.env: SEED_CUSTOMER_EMAIL/PASSWORD, SEED_OWNER_EMAIL/PASSWORD (para consultar el catálogo),
 * STORE_DEVICE_KEYS y WEBHOOK_SECRET.
 */
import { createHmac } from 'node:crypto'
import { parseArgs } from 'node:util'

const { values: args } = parseArgs({
  options: {
    api: { type: 'string', default: process.env.SIMULATOR_API_URL ?? `http://localhost:${process.env.PORT ?? 3000}/api/v1` },
    items: { type: 'string' },
    empty: { type: 'boolean', default: false },
  },
})

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`Falta ${name} en backend/.env`)
    process.exit(1)
  }
  return value
}

const api = args.api!.replace(/\/$/, '')
const deviceKey = required('STORE_DEVICE_KEYS').split(',')[0]!.trim()
const webhookSecret = required('WEBHOOK_SECRET')

async function request<T>(method: string, path: string, init: { body?: string; headers?: Record<string, string> } = {}) {
  const response = await fetch(`${api}${path}`, {
    method,
    body: init.body,
    headers: { ...(init.body && { 'content-type': 'application/json' }), ...init.headers },
  })
  const data = (await response.json().catch(() => null)) as T & { error?: { code: string; message: string } }
  if (!response.ok) {
    throw new Error(`${method} ${path} → ${response.status} ${data?.error?.code ?? ''}: ${data?.error?.message ?? ''}`)
  }
  return data
}

async function login(path: string, email: string, password: string) {
  const { accessToken } = await request<{ accessToken: string }>('POST', path, { body: JSON.stringify({ email, password }) })
  return { authorization: `Bearer ${accessToken}` }
}

const customerEmail = process.env.SEED_CUSTOMER_EMAIL ?? 'cliente@smart-abarrotes.mx'
const customer = await login('/auth/login', customerEmail, required('SEED_CUSTOMER_PASSWORD'))
const owner = await login(
  '/auth/admin/login',
  process.env.SEED_OWNER_EMAIL ?? 'owner@smart-abarrotes.mx',
  required('SEED_OWNER_PASSWORD'),
)

// 1. Pase QR del cliente
const pass = await request<{ token: string }>('GET', '/me/entry-pass', { headers: customer })
console.log(`📱 ${customerEmail} muestra su QR`)

// 2. Escáner de entrada
const entry = await request<{ visitId: string; user: { name: string } }>('POST', '/store/entry', {
  headers: { 'x-device-key': deviceKey },
  body: JSON.stringify({ token: pass.token, gateId: 'ENTRADA-1' }),
})
console.log(`🚪 Entra ${entry.user.name} · visita ${entry.visitId}`)

// 3. Productos al azar del catálogo activo (con stock si los hay)
type Product = { id: string; barcode: string | null; name: string; price: number; stock: number }
const catalog = await request<{ data: Product[] }>('GET', '/products?status=ACTIVE&limit=100', { headers: owner })
const withStock = catalog.data.filter((product) => product.stock > 0)
const pool = withStock.length > 0 ? withStock : catalog.data
const count = args.empty ? 0 : Math.min(pool.length, Number(args.items ?? 1 + Math.floor(Math.random() * 4)))
const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, count)
// La mitad de las partidas se reportan por código de barras, como lo haría una cámara
const items = picked.map((product, index) => ({
  ...(product.barcode && index % 2 === 1 ? { barcode: product.barcode } : { productId: product.id }),
  quantity: 1 + Math.floor(Math.random() * Math.max(1, Math.min(2, product.stock))),
}))
for (const [index, product] of picked.entries()) console.log(`🛒 Toma ${items[index]!.quantity} × ${product.name}`)

// 4. Webhook de salida firmado
const body = JSON.stringify({ eventId: `sim-${crypto.randomUUID()}`, visitId: entry.visitId, exitedAt: new Date().toISOString(), items })
const signature = `sha256=${createHmac('sha256', webhookSecret).update(body).digest('hex')}`
const result = await request<{ saleId: string | null; folio: number | null; totalAmount: number; paymentStatus: string | null }>(
  'POST',
  '/webhooks/checkout',
  { headers: { 'x-signature': signature }, body },
)

if (result.saleId) {
  console.log(`🎥 Sale de la tienda → ticket #${result.folio} por $${result.totalAmount.toFixed(2)} · cobro ${result.paymentStatus}`)
} else {
  console.log('🎥 Sale sin productos: visita cerrada sin venta')
}

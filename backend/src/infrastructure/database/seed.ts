import type { DataSource } from 'typeorm'
import { createContainer, type Container } from '../../container'
import { PaymentMethod, ProductStatus, Role } from '../../domain/enums'
import { DEFAULT_STORE_SETTINGS } from '../../domain/models/store-settings'
import { normalizeEmail } from '../../domain/models/user'
import { priceSale } from '../../domain/sales/pricing'
import { StoreSettingsEntity } from './entities'

interface SeedAccount {
  name: string
  email: string
  password: string
}

export interface SeedOptions {
  owner: SeedAccount
  /** Cliente para probar la PWA (pase QR, compras) */
  customer?: SeedAccount
  /** Catálogo de demostración (categorías + productos con stock inicial). */
  withDemoCatalog: boolean
  /** Historial de ventas de mostrador de los últimos 14 días (solo si aún no hay ventas). */
  withDemoSales?: boolean
}

const DEMO_CATEGORIES = [
  { name: 'Bebidas', color: '#2563EB', icon: 'cup-soda', sortOrder: 1 },
  { name: 'Botanas', color: '#F59E0B', icon: 'popcorn', sortOrder: 2 },
  { name: 'Lácteos y huevo', color: '#0891B2', icon: 'milk', sortOrder: 3 },
  { name: 'Abarrotes', color: '#16A34A', icon: 'wheat', sortOrder: 4 },
  { name: 'Panadería y tortillería', color: '#D97706', icon: 'croissant', sortOrder: 5 },
  { name: 'Limpieza', color: '#7C3AED', icon: 'spray-can', sortOrder: 6 },
]

// Precios de ejemplo (IVA incluido). Alimentos básicos: tasa 0 %; bebidas, botanas y limpieza: 16 %.
// Códigos con prefijo GS1 "200": rango reservado para uso interno, no colisiona con productos reales.
type DemoProduct = [id: string, barcode: string, name: string, category: string, price: number, cost: number, taxRate: number, stock: number, minStock: number, quickAccess: boolean]
const DEMO_PRODUCTS: DemoProduct[] = [
  ['REF-COLA-600', '2000000000017', 'Refresco de cola 600 ml', 'Bebidas', 20, 13.5, 0.16, 48, 12, true],
  ['AGUA-1L', '2000000000024', 'Agua natural 1 L', 'Bebidas', 14, 8, 0.16, 36, 12, true],
  ['JUGO-NAR-1L', '2000000000031', 'Jugo de naranja 1 L', 'Bebidas', 32, 22, 0.16, 10, 4, false],
  ['PAPAS-SAL-45', '2000000000048', 'Papas fritas con sal 45 g', 'Botanas', 19, 12.8, 0.16, 30, 10, true],
  ['CACAH-JAP-100', '2000000000055', 'Cacahuates japoneses 100 g', 'Botanas', 16, 10.5, 0.16, 4, 6, false],
  ['LECHE-ENT-1L', '2000000000062', 'Leche entera 1 L', 'Lácteos y huevo', 28.5, 23, 0, 24, 8, true],
  ['HUEVO-12', '2000000000079', 'Huevo blanco 12 piezas', 'Lácteos y huevo', 42, 34, 0, 15, 5, true],
  ['FRIJOL-NEG-900', '2000000000086', 'Frijol negro 900 g', 'Abarrotes', 39, 30, 0, 20, 6, false],
  ['ARROZ-1KG', '2000000000093', 'Arroz blanco 1 kg', 'Abarrotes', 32, 24.5, 0, 3, 6, false],
  ['ACEITE-1L', '2000000000109', 'Aceite vegetal 1 L', 'Abarrotes', 45, 36, 0, 12, 4, false],
  ['PAN-CAJA-680', '2000000000116', 'Pan blanco de caja 680 g', 'Panadería y tortillería', 52, 41, 0, 10, 4, true],
  ['TORTILLA-1KG', '2000000000123', 'Tortilla de maíz 1 kg', 'Panadería y tortillería', 22, 16, 0, 0, 5, true],
  ['DETERG-1KG', '2000000000130', 'Detergente en polvo 1 kg', 'Limpieza', 48, 35, 0.16, 8, 3, false],
  ['LAVATR-750', '2000000000147', 'Lavatrastes líquido 750 ml', 'Limpieza', 34, 24, 0.16, 6, 3, false],
]

/** Idempotente: solo crea lo que falta, nunca sobrescribe datos existentes. */
export async function runSeed(dataSource: DataSource, options: SeedOptions) {
  const { repositories, hasher, useCases } = createContainer(dataSource)
  const log: string[] = []

  const ownerEmail = normalizeEmail(options.owner.email)
  const owner = await repositories.users.findByEmailWithPassword(ownerEmail)
  if (owner && owner.role !== Role.OWNER) {
    throw new Error(`${ownerEmail} ya existe pero no es OWNER; usa otro SEED_OWNER_EMAIL`)
  }
  const ownerId =
    owner?.id ??
    (
      await repositories.users.create({
        name: options.owner.name,
        email: ownerEmail,
        passwordHash: await hasher.hash(options.owner.password),
        role: Role.OWNER,
      })
    ).id
  if (!owner) log.push(`Propietario creado: ${ownerEmail}`)

  const settings = dataSource.getRepository(StoreSettingsEntity)
  if (!(await settings.existsBy({ id: 1 }))) {
    const { updatedAt: _omit, ...defaults } = DEFAULT_STORE_SETTINGS
    await settings.insert({ id: 1, ...defaults })
    log.push('Configuración de la tienda creada')
  }

  if (options.withDemoCatalog) {
    const categoryIds = new Map<string, string>()
    for (const category of DEMO_CATEGORIES) {
      const existing = await repositories.categories.findByName(category.name)
      categoryIds.set(category.name, (existing ?? (await useCases.categories.create(category))).id)
    }

    let createdProducts = 0
    for (const [id, barcode, name, category, price, cost, taxRate, stock, minStock, quickAccess] of DEMO_PRODUCTS) {
      if (await repositories.products.existsById(id)) continue
      await useCases.products.create(
        {
          id,
          barcode,
          name,
          categoryId: categoryIds.get(category)!,
          price,
          purchaseCost: cost,
          taxRate,
          initialStock: stock,
          minStockAlert: minStock,
          status: ProductStatus.ACTIVE,
          isQuickAccess: quickAccess,
        },
        ownerId,
      )
      createdProducts++
    }
    log.push(`Catálogo demo: ${DEMO_CATEGORIES.length} categorías, ${createdProducts} productos nuevos`)
  }

  let customerId: string | null = null
  if (options.customer) {
    const email = normalizeEmail(options.customer.email)
    const existing = await repositories.users.findByEmailWithPassword(email)
    if (existing && existing.role !== Role.CUSTOMER) {
      throw new Error(`${email} ya existe pero no es CUSTOMER; usa otro SEED_CUSTOMER_EMAIL`)
    }
    customerId = existing?.id ?? (await useCases.auth.registerCustomer({ ...options.customer, email })).id
    if (!existing) log.push(`Cliente demo creado: ${email}`)
    // Clientes demo creados antes del flujo automático: se les vincula el método de pago simulado
    if (existing && !existing.paymentCustomerRef) {
      const { passwordHash: _, ...customer } = existing
      if ((await useCases.auth.linkPaymentMethod(customer)).paymentCustomerRef) {
        log.push(`Cliente demo vinculado a la pasarela de pago: ${email}`)
      }
    }
  }

  if (options.withDemoSales && (await repositories.sales.count()) === 0) {
    const created = await seedSalesHistory({ repositories, useCases }, ownerId, customerId)
    log.push(`Historial demo: ${created} ventas de mostrador en los últimos 14 días`)
  }

  return log
}

const HISTORY_SALES = 40
const HISTORY_DAYS = 14
/** Las ventas históricas no bajan el stock de ningún producto por debajo de este colchón */
const STOCK_BUFFER = 6

/** PRNG determinista (mulberry32): el mismo seed produce siempre el mismo historial. */
function seededRandom(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

/** Ventas de mostrador repartidas en los últimos días, registradas con el caso de uso real (stock y kardex consistentes). */
async function seedSalesHistory(
  { repositories, useCases }: Pick<Container, 'repositories' | 'useCases'>,
  cashierId: string,
  customerId: string | null,
) {
  const random = seededRandom(20261028)
  const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)]!

  const { data: products } = await repositories.products.list(
    { status: ProductStatus.ACTIVE, sort: 'name' },
    { page: 1, limit: 100 },
  )
  const stock = new Map(products.map((product) => [product.id, product.stock]))

  const now = Date.now()
  const startOfToday = new Date().setHours(0, 0, 0, 0)
  const dates = Array.from({ length: HISTORY_SALES }, () => {
    const day = startOfToday - Math.floor(random() * HISTORY_DAYS) * 86_400_000
    const at = day + (8 + random() * 13) * 3_600_000 // horario de tienda: 8:00–21:00
    return new Date(Math.min(at, now - random() * 3_600_000))
  }).sort((a, b) => a.getTime() - b.getTime())

  let created = 0
  for (const at of dates) {
    const available = products.filter((product) => (stock.get(product.id) ?? 0) > STOCK_BUFFER + 2)
    if (available.length === 0) break

    const lines = new Map<string, number>()
    const size = 1 + Math.floor(random() * 3)
    for (let i = 0; i < size; i++) lines.set(pick(available).id, 1 + Math.floor(random() * 2))
    const items = [...lines].map(([productId, quantity]) => ({ productId, quantity }))

    const roll = random()
    const paymentMethod = roll < 0.5 ? PaymentMethod.CASH : roll < 0.85 ? PaymentMethod.CARD : PaymentMethod.TRANSFER
    const { totalAmount } = priceSale(
      items.map(({ productId, quantity }) => {
        const product = products.find((p) => p.id === productId)!
        return { quantity, unitPrice: product.price, taxRate: product.taxRate }
      }),
    )

    await useCases.sales.createManualSale(
      {
        items,
        paymentMethod,
        // En efectivo, el cliente paga con el siguiente múltiplo de $50
        cashReceived: paymentMethod === PaymentMethod.CASH ? Math.ceil(totalAmount / 50) * 50 : undefined,
        customerId: customerId && random() < 0.25 ? customerId : null,
      },
      cashierId,
      { at },
    )
    for (const { productId, quantity } of items) stock.set(productId, (stock.get(productId) ?? 0) - quantity)
    created++
  }
  return created
}

if (import.meta.main) {
  const { AppDataSource } = await import('./data-source')
  const password = process.env.SEED_OWNER_PASSWORD
  if (!password || password.length < 8) {
    console.error('Define SEED_OWNER_PASSWORD (mínimo 8 caracteres) en backend/.env')
    process.exit(1)
  }

  await AppDataSource.initialize()
  try {
    const log = await runSeed(AppDataSource, {
      owner: {
        name: process.env.SEED_OWNER_NAME ?? 'Propietario',
        email: process.env.SEED_OWNER_EMAIL ?? 'owner@smart-abarrotes.mx',
        password,
      },
      customer: process.env.SEED_CUSTOMER_PASSWORD
        ? {
            name: process.env.SEED_CUSTOMER_NAME ?? 'Cliente Demo',
            email: process.env.SEED_CUSTOMER_EMAIL ?? 'cliente@smart-abarrotes.mx',
            password: process.env.SEED_CUSTOMER_PASSWORD,
          }
        : undefined,
      withDemoCatalog: process.env.SEED_DEMO_CATALOG !== 'false',
      withDemoSales: process.env.SEED_DEMO_SALES !== 'false',
    })
    console.log(log.length ? log.map((line) => `✔ ${line}`).join('\n') : 'Nada que sembrar: la base ya estaba lista')
  } finally {
    await AppDataSource.destroy()
  }
}

import { cors } from '@elysiajs/cors'
import { openapi } from '@elysiajs/openapi'
import { Elysia, type AnyElysia } from 'elysia'
import type { AuthUseCases } from '../../application/auth/auth.use-cases'
import type { CategoryUseCases } from '../../application/categories/category.use-cases'
import type { CustomerUseCases } from '../../application/customers/customer.use-cases'
import type { InventoryUseCases } from '../../application/inventory/inventory.use-cases'
import type { ProductUseCases } from '../../application/products/product.use-cases'
import type { ReportUseCases } from '../../application/reports/report.use-cases'
import type { SaleUseCases } from '../../application/sales/sale.use-cases'
import type { SettingsUseCases } from '../../application/settings/settings.use-cases'
import type { ShelfUseCases } from '../../application/shelf/shelf.use-cases'
import type { StoreUseCases } from '../../application/store/store.use-cases'
import { createAuthPlugin } from './plugins/auth.plugin'
import { errorHandler } from './plugins/error-handler'
import { staticFrontend } from './plugins/static-frontend'
import { authRoutes } from './routes/auth.routes'
import { categoryRoutes } from './routes/category.routes'
import { customerRoutes } from './routes/customer.routes'
import { devRoutes } from './routes/dev.routes'
import { healthRoutes } from './routes/health.routes'
import { inventoryRoutes } from './routes/inventory.routes'
import { productRoutes } from './routes/product.routes'
import { reportRoutes } from './routes/report.routes'
import { saleRoutes } from './routes/sale.routes'
import { settingsRoutes } from './routes/settings.routes'
import { shelfRoutes } from './routes/shelf.routes'
import { storeRoutes } from './routes/store.routes'

export interface AppDependencies {
  useCases: {
    auth: AuthUseCases
    customers: CustomerUseCases
    categories: CategoryUseCases
    products: ProductUseCases
    inventory: InventoryUseCases
    sales: SaleUseCases
    reports: ReportUseCases
    settings: SettingsUseCases
    store: StoreUseCases
    shelf: ShelfUseCases
  }
  checkDatabase: () => Promise<boolean>
  config: {
    jwtSecret: string
    jwtExpiresInSeconds: number
    corsOrigins: string[]
    /** Monta `/dev/*` (simulador de visitas): fuera de producción o con `ENABLE_STORE_SIMULATOR=true`. */
    devTools?: boolean
    /** Carpeta del build del frontend; si se indica, el servidor también sirve la SPA. */
    staticDir?: string
    /** Plugin de OpenTelemetry; se omite si la telemetría está desactivada. */
    telemetry?: AnyElysia
  }
}

export function createApp({ useCases, checkDatabase, config }: AppDependencies) {
  const auth = createAuthPlugin({ secret: config.jwtSecret, expiresInSeconds: config.jwtExpiresInSeconds })

  const api = new Elysia({ prefix: '/api/v1' })
    .use(healthRoutes(checkDatabase))
    .use(authRoutes(auth, useCases.auth, config.jwtExpiresInSeconds))
    .use(customerRoutes(auth, useCases.customers))
    .use(categoryRoutes(auth, useCases.categories))
    .use(productRoutes(auth, useCases.products))
    .use(inventoryRoutes(auth, useCases.inventory))
    .use(saleRoutes(auth, useCases.sales))
    .use(reportRoutes(auth, useCases.reports))
    .use(settingsRoutes(auth, useCases.settings))
    .use(storeRoutes(useCases.store))
    .use(shelfRoutes(auth, useCases.shelf))
    .use(config.devTools ? devRoutes(auth, useCases.store) : new Elysia({ name: 'dev-tools-disabled' }))

  return new Elysia()
    .use(config.telemetry ?? new Elysia({ name: 'telemetry-disabled' }))
    .use(errorHandler)
    .use(cors({ origin: config.corsOrigins }))
    .use(
      openapi({
        path: '/swagger',
        provider: 'swagger-ui',
        documentation: {
          info: {
            title: 'Smart Abarrotes API',
            version: '1.0.9',
            description:
              'Endpoints implementados. El contrato completo (fuente de verdad SDD) está en docs/specs/openapi.yaml.',
          },
          tags: [
            { name: 'Health' },
            { name: 'Auth' },
            { name: 'Customer' },
            { name: 'Categories' },
            { name: 'Products' },
            { name: 'Inventory' },
            { name: 'Sales' },
            { name: 'Reports' },
            { name: 'Settings' },
            { name: 'Store Devices', description: 'Escáner de entrada y sistema de cámaras' },
            { name: 'Shelf', description: 'ShelfSight: cámara de repisa, eventos antes/después y cola de revisión' },
            {
              name: 'Dev',
              description: 'Herramientas de demostración; solo existen si NODE_ENV ≠ production o ENABLE_STORE_SIMULATOR=true',
            },
          ],
          components: {
            securitySchemes: {
              bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
              deviceKey: { type: 'apiKey', in: 'header', name: 'X-Device-Key' },
              webhookSignature: { type: 'apiKey', in: 'header', name: 'X-Signature' },
            },
          },
        },
      }),
    )
    .use(api)
    .use(config.staticDir ? staticFrontend(config.staticDir) : new Elysia({ name: 'static-frontend-disabled' }))
}

export type App = ReturnType<typeof createApp>

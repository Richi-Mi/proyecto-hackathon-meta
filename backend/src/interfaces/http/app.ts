import { cors } from '@elysiajs/cors'
import { openapi } from '@elysiajs/openapi'
import { Elysia, type AnyElysia } from 'elysia'
import type { AuthUseCases } from '../../application/auth/auth.use-cases'
import type { CategoryUseCases } from '../../application/categories/category.use-cases'
import type { CustomerUseCases } from '../../application/customers/customer.use-cases'
import type { InventoryUseCases } from '../../application/inventory/inventory.use-cases'
import type { ProductUseCases } from '../../application/products/product.use-cases'
import type { SaleUseCases } from '../../application/sales/sale.use-cases'
import { createAuthPlugin } from './plugins/auth.plugin'
import { errorHandler } from './plugins/error-handler'
import { authRoutes } from './routes/auth.routes'
import { categoryRoutes } from './routes/category.routes'
import { customerRoutes } from './routes/customer.routes'
import { healthRoutes } from './routes/health.routes'
import { inventoryRoutes } from './routes/inventory.routes'
import { productRoutes } from './routes/product.routes'
import { saleRoutes } from './routes/sale.routes'

export interface AppDependencies {
  useCases: {
    auth: AuthUseCases
    customers: CustomerUseCases
    categories: CategoryUseCases
    products: ProductUseCases
    inventory: InventoryUseCases
    sales: SaleUseCases
  }
  checkDatabase: () => Promise<boolean>
  config: {
    jwtSecret: string
    jwtExpiresInSeconds: number
    corsOrigins: string[]
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
            version: '1.0.2',
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
          ],
          components: {
            securitySchemes: {
              bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
            },
          },
        },
      }),
    )
    .use(api)
}

export type App = ReturnType<typeof createApp>

import type { DataSource } from 'typeorm'
import { AuthUseCases } from './application/auth/auth.use-cases'
import { CategoryUseCases } from './application/categories/category.use-cases'
import { CustomerUseCases } from './application/customers/customer.use-cases'
import { InventoryUseCases } from './application/inventory/inventory.use-cases'
import { ProductUseCases } from './application/products/product.use-cases'
import { ReportUseCases } from './application/reports/report.use-cases'
import type { PaymentGateway } from './application/ports/payment-gateway'
import { SaleUseCases } from './application/sales/sale.use-cases'
import { SettingsUseCases } from './application/settings/settings.use-cases'
import { StoreUseCases } from './application/store/store.use-cases'
import { env, parseList } from './infrastructure/config/env'
import { TypeOrmCategoryRepository } from './infrastructure/database/repositories/typeorm-category.repository'
import { TypeOrmInventoryRepository } from './infrastructure/database/repositories/typeorm-inventory.repository'
import { TypeOrmProductRepository } from './infrastructure/database/repositories/typeorm-product.repository'
import { TypeOrmReportRepository } from './infrastructure/database/repositories/typeorm-report.repository'
import { TypeOrmSaleRepository } from './infrastructure/database/repositories/typeorm-sale.repository'
import { TypeOrmStoreSettingsRepository } from './infrastructure/database/repositories/typeorm-store-settings.repository'
import { TypeOrmStoreVisitRepository } from './infrastructure/database/repositories/typeorm-store-visit.repository'
import { TypeOrmUserRepository } from './infrastructure/database/repositories/typeorm-user.repository'
import { BunPasswordHasher } from './infrastructure/security/bun-password-hasher'
import { MockPaymentGateway } from './infrastructure/payments/mock-payment-gateway'
import { JoseEntryPassSigner } from './infrastructure/security/jose-entry-pass-signer'
import { HmacWebhookSignatureVerifier, StaticDeviceKeyVerifier } from './infrastructure/security/store-device-auth'

export interface ContainerOverrides {
  /** Por defecto, la pasarela simulada con `MOCK_PAYMENT_FAILURE_RATE` */
  paymentGateway?: PaymentGateway
}

/** Raíz de composición: conecta los adaptadores de infraestructura con los casos de uso. */
export function createContainer(dataSource: DataSource, overrides: ContainerOverrides = {}) {
  const hasher = new BunPasswordHasher()
  const entryPassSigner = new JoseEntryPassSigner(env.ENTRY_PASS_SECRET)
  const paymentGateway = overrides.paymentGateway ?? new MockPaymentGateway({ failureRate: env.MOCK_PAYMENT_FAILURE_RATE })
  const deviceKeys = new StaticDeviceKeyVerifier(parseList(env.STORE_DEVICE_KEYS))
  const webhookSignatures = new HmacWebhookSignatureVerifier(env.WEBHOOK_SECRET)
  const users = new TypeOrmUserRepository(dataSource)
  const categories = new TypeOrmCategoryRepository(dataSource)
  const products = new TypeOrmProductRepository(dataSource)
  const inventory = new TypeOrmInventoryRepository(dataSource)
  const sales = new TypeOrmSaleRepository(dataSource)
  const visits = new TypeOrmStoreVisitRepository(dataSource)
  const reports = new TypeOrmReportRepository(dataSource, env.STORE_TIMEZONE)
  const settings = new TypeOrmStoreSettingsRepository(dataSource)

  return {
    repositories: { users, categories, products, sales },
    hasher,
    entryPassSigner,
    paymentGateway,
    webhookSignatures,
    useCases: {
      auth: new AuthUseCases(users, hasher, paymentGateway),
      customers: new CustomerUseCases(users, sales, entryPassSigner, {
        entryPassTtlSeconds: env.ENTRY_PASS_TTL_SECONDS,
        timeZone: env.STORE_TIMEZONE,
      }),
      categories: new CategoryUseCases(categories),
      products: new ProductUseCases(products, categories, settings),
      inventory: new InventoryUseCases(inventory),
      sales: new SaleUseCases(sales, users, settings, paymentGateway),
      store: new StoreUseCases(
        users,
        visits,
        sales,
        products,
        entryPassSigner,
        paymentGateway,
        deviceKeys,
        webhookSignatures,
        { simulationCustomerEmail: env.SEED_CUSTOMER_EMAIL, entryPassTtlSeconds: env.ENTRY_PASS_TTL_SECONDS },
      ),
      reports: new ReportUseCases(reports),
      settings: new SettingsUseCases(settings),
    },
    checkDatabase: () => dataSource.query('SELECT 1').then(
      () => true,
      () => false,
    ),
  }
}

export type Container = ReturnType<typeof createContainer>

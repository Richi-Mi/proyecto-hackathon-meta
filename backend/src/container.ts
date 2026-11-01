import type { DataSource } from 'typeorm'
import { AuthUseCases } from './application/auth/auth.use-cases'
import { CategoryUseCases } from './application/categories/category.use-cases'
import { CustomerUseCases } from './application/customers/customer.use-cases'
import { InventoryUseCases } from './application/inventory/inventory.use-cases'
import { ProductUseCases } from './application/products/product.use-cases'
import { SaleUseCases } from './application/sales/sale.use-cases'
import { env } from './infrastructure/config/env'
import { TypeOrmCategoryRepository } from './infrastructure/database/repositories/typeorm-category.repository'
import { TypeOrmInventoryRepository } from './infrastructure/database/repositories/typeorm-inventory.repository'
import { TypeOrmProductRepository } from './infrastructure/database/repositories/typeorm-product.repository'
import { TypeOrmSaleRepository } from './infrastructure/database/repositories/typeorm-sale.repository'
import { TypeOrmUserRepository } from './infrastructure/database/repositories/typeorm-user.repository'
import { BunPasswordHasher } from './infrastructure/security/bun-password-hasher'
import { JoseEntryPassSigner } from './infrastructure/security/jose-entry-pass-signer'

/** Raíz de composición: conecta los adaptadores de infraestructura con los casos de uso. */
export function createContainer(dataSource: DataSource) {
  const hasher = new BunPasswordHasher()
  const entryPassSigner = new JoseEntryPassSigner(env.ENTRY_PASS_SECRET)
  const users = new TypeOrmUserRepository(dataSource)
  const categories = new TypeOrmCategoryRepository(dataSource)
  const products = new TypeOrmProductRepository(dataSource)
  const inventory = new TypeOrmInventoryRepository(dataSource)
  const sales = new TypeOrmSaleRepository(dataSource)

  return {
    repositories: { users, categories, products, sales },
    hasher,
    entryPassSigner,
    useCases: {
      auth: new AuthUseCases(users, hasher),
      customers: new CustomerUseCases(users, entryPassSigner, env.ENTRY_PASS_TTL_SECONDS),
      categories: new CategoryUseCases(categories),
      products: new ProductUseCases(products, categories),
      inventory: new InventoryUseCases(inventory),
      sales: new SaleUseCases(sales, users),
    },
    checkDatabase: () => dataSource.query('SELECT 1').then(
      () => true,
      () => false,
    ),
  }
}

export type Container = ReturnType<typeof createContainer>

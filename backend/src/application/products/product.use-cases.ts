import { ProductStatus } from '../../domain/enums'
import { ConflictError, InvalidInputError, NotFoundError } from '../../domain/errors'
import { roundMoney, roundRate } from '../../domain/money'
import { DEFAULT_MIN_STOCK_ALERT, type Product } from '../../domain/models/product'
import { assertHasChanges } from '../common/assert-has-changes'
import type { Page, PageRequest } from '../common/pagination'
import { emptyToNull } from '../common/text'
import type { CategoryRepository } from '../ports/category-repository'
import type { NewProduct, ProductChanges, ProductFilters, ProductRepository } from '../ports/product-repository'
import type { StoreSettingsRepository } from '../ports/store-settings-repository'

export type CreateProductInput = Pick<NewProduct, 'id' | 'name' | 'categoryId' | 'price' | 'purchaseCost'> &
  Partial<Omit<NewProduct, 'id' | 'name' | 'categoryId' | 'price' | 'purchaseCost'>> & {
    initialStock?: number
  }

export class ProductUseCases {
  constructor(
    private readonly products: ProductRepository,
    private readonly categories: CategoryRepository,
    private readonly settings: StoreSettingsRepository,
  ) {}

  list(filters: ProductFilters, page: PageRequest): Promise<Page<Product>> {
    return this.products.list({ ...filters, search: filters.search?.trim() || undefined }, page)
  }

  async getById(id: string): Promise<Product> {
    return (await this.products.findById(id)) ?? throwProductNotFound(id)
  }

  async lookup(code: string): Promise<Product> {
    const product = await this.products.findByCode(code.trim())
    if (!product) throw new NotFoundError('PRODUCT_NOT_FOUND', `Ningún producto tiene el código ${code}`)
    return product
  }

  async create(input: CreateProductInput, actorId: string): Promise<Product> {
    await this.assertCategoryExists(input.categoryId)
    if (await this.products.existsById(input.id)) {
      throw new ConflictError('PRODUCT_ALREADY_EXISTS', `Ya existe un producto con el SKU ${input.id}`)
    }

    const initialStock = input.initialStock ?? 0
    const taxRate = input.taxRate ?? (await this.settings.get()).defaultTaxRate
    return this.products.create(
      {
        id: input.id,
        barcode: emptyToNull(input.barcode),
        name: input.name.trim(),
        description: emptyToNull(input.description),
        categoryId: input.categoryId,
        price: roundMoney(input.price),
        purchaseCost: roundMoney(input.purchaseCost),
        taxRate: roundRate(taxRate),
        minStockAlert: input.minStockAlert ?? DEFAULT_MIN_STOCK_ALERT,
        status: input.status ?? ProductStatus.ACTIVE,
        imageUrl: emptyToNull(input.imageUrl),
        isQuickAccess: input.isQuickAccess ?? false,
      },
      initialStock > 0 ? { quantity: initialStock, userId: actorId } : null,
    )
  }

  async update(id: string, changes: ProductChanges): Promise<Product> {
    assertHasChanges(changes)
    if (changes.categoryId !== undefined) await this.assertCategoryExists(changes.categoryId)

    const updated = await this.products.update(id, {
      ...changes,
      ...(changes.name !== undefined && { name: changes.name.trim() }),
      ...(changes.barcode !== undefined && { barcode: emptyToNull(changes.barcode) }),
      ...(changes.description !== undefined && { description: emptyToNull(changes.description) }),
      ...(changes.imageUrl !== undefined && { imageUrl: emptyToNull(changes.imageUrl) }),
      ...(changes.price !== undefined && { price: roundMoney(changes.price) }),
      ...(changes.purchaseCost !== undefined && { purchaseCost: roundMoney(changes.purchaseCost) }),
      ...(changes.taxRate !== undefined && { taxRate: roundRate(changes.taxRate) }),
    })
    return updated ?? throwProductNotFound(id)
  }

  async delete(id: string): Promise<void> {
    if (!(await this.products.softDelete(id))) throwProductNotFound(id)
  }

  private async assertCategoryExists(categoryId: string) {
    if (!(await this.categories.findById(categoryId))) {
      throw new InvalidInputError('CATEGORY_NOT_FOUND', `No existe la categoría ${categoryId}`)
    }
  }
}

const throwProductNotFound = (id: string): never => {
  throw new NotFoundError('PRODUCT_NOT_FOUND', `No existe el producto ${id}`)
}


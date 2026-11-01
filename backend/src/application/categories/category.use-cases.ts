import { ConflictError, NotFoundError } from '../../domain/errors'
import type { Category } from '../../domain/models/category'
import { assertHasChanges } from '../common/assert-has-changes'
import type { CategoryData, CategoryRepository } from '../ports/category-repository'

export type CreateCategoryInput = Pick<CategoryData, 'name' | 'color'> & Partial<Pick<CategoryData, 'icon' | 'sortOrder'>>

export class CategoryUseCases {
  constructor(private readonly categories: CategoryRepository) {}

  list(): Promise<Category[]> {
    return this.categories.list()
  }

  create(input: CreateCategoryInput): Promise<Category> {
    return this.categories.create({
      name: input.name.trim(),
      color: input.color.toUpperCase(),
      icon: input.icon ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
  }

  async update(id: string, changes: Partial<CategoryData>): Promise<Category> {
    assertHasChanges(changes)
    const updated = await this.categories.update(id, {
      ...changes,
      ...(changes.name !== undefined && { name: changes.name.trim() }),
      ...(changes.color !== undefined && { color: changes.color.toUpperCase() }),
    })
    if (!updated) throw categoryNotFound(id)
    return updated
  }

  async delete(id: string): Promise<void> {
    if (!(await this.categories.findById(id))) throw categoryNotFound(id)
    const products = await this.categories.countProducts(id)
    if (products > 0) {
      throw new ConflictError('CATEGORY_HAS_PRODUCTS', `La categoría tiene ${products} producto(s); reasígnalos antes de eliminarla`)
    }
    await this.categories.delete(id)
  }
}

const categoryNotFound = (id: string) => new NotFoundError('CATEGORY_NOT_FOUND', `No existe la categoría ${id}`)

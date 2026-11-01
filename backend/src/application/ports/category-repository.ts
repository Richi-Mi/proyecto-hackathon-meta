import type { Category } from '../../domain/models/category'

export type CategoryData = Omit<Category, 'id'>

export interface CategoryRepository {
  list(): Promise<Category[]>
  findById(id: string): Promise<Category | null>
  findByName(name: string): Promise<Category | null>
  /** @throws ConflictError `CATEGORY_NAME_TAKEN` */
  create(data: CategoryData): Promise<Category>
  /** @throws ConflictError `CATEGORY_NAME_TAKEN` */
  update(id: string, changes: Partial<CategoryData>): Promise<Category | null>
  /** Incluye productos dados de baja: siguen referenciando la categoría. */
  countProducts(id: string): Promise<number>
  delete(id: string): Promise<boolean>
}

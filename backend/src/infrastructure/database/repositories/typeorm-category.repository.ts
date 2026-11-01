import type { DataSource, Repository } from 'typeorm'
import type { CategoryData, CategoryRepository } from '../../../application/ports/category-repository'
import { ConflictError } from '../../../domain/errors'
import type { Category } from '../../../domain/models/category'
import { CategoryEntity, ProductEntity } from '../entities'
import { isForeignKeyViolation, uniqueViolationColumn } from '../pg-errors'

export class TypeOrmCategoryRepository implements CategoryRepository {
  private readonly repo: Repository<CategoryEntity>

  constructor(private readonly dataSource: DataSource) {
    this.repo = dataSource.getRepository(CategoryEntity)
  }

  list(): Promise<Category[]> {
    return this.repo.find({ order: { sortOrder: 'ASC', name: 'ASC' } })
  }

  findById(id: string): Promise<Category | null> {
    return this.repo.findOneBy({ id })
  }

  findByName(name: string): Promise<Category | null> {
    return this.repo.findOneBy({ name })
  }

  async create(data: CategoryData): Promise<Category> {
    try {
      return await this.repo.save(this.repo.create(data))
    } catch (error) {
      throw mapNameConflict(error, data.name)
    }
  }

  async update(id: string, changes: Partial<CategoryData>): Promise<Category | null> {
    const category = await this.repo.findOneBy({ id })
    if (!category) return null
    try {
      return await this.repo.save(this.repo.merge(category, changes))
    } catch (error) {
      throw mapNameConflict(error, changes.name)
    }
  }

  countProducts(id: string): Promise<number> {
    return this.dataSource.getRepository(ProductEntity).count({ where: { categoryId: id }, withDeleted: true })
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.repo.delete({ id })
      return (result.affected ?? 0) > 0
    } catch (error) {
      // Carrera: se asignó un producto entre el conteo y el DELETE
      if (isForeignKeyViolation(error)) {
        throw new ConflictError('CATEGORY_HAS_PRODUCTS', 'La categoría tiene productos asignados')
      }
      throw error
    }
  }
}

const mapNameConflict = (error: unknown, name: string | undefined) =>
  uniqueViolationColumn(error) === 'name'
    ? new ConflictError('CATEGORY_NAME_TAKEN', `Ya existe una categoría llamada "${name}"`)
    : error

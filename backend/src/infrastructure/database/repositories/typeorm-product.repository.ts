import { Brackets, IsNull, type DataSource, type Repository } from 'typeorm'
import type { Page, PageRequest } from '../../../application/common/pagination'
import type {
  InitialStock,
  NewProduct,
  ProductChanges,
  ProductFilters,
  ProductRepository,
  ProductSort,
} from '../../../application/ports/product-repository'
import { MovementType } from '../../../domain/enums'
import { ConflictError, InvalidInputError } from '../../../domain/errors'
import type { Product } from '../../../domain/models/product'
import { InventoryMovementEntity, ProductEntity } from '../entities'
import { escapeLike, isForeignKeyViolation, uniqueViolationColumn } from '../pg-errors'

const SORT_COLUMNS: Record<ProductSort, [property: keyof ProductEntity, direction: 'ASC' | 'DESC']> = {
  name: ['name', 'ASC'],
  '-name': ['name', 'DESC'],
  stock: ['stock', 'ASC'],
  '-stock': ['stock', 'DESC'],
  price: ['price', 'ASC'],
  '-price': ['price', 'DESC'],
  updatedAt: ['updatedAt', 'ASC'],
  '-updatedAt': ['updatedAt', 'DESC'],
}

export class TypeOrmProductRepository implements ProductRepository {
  private readonly repo: Repository<ProductEntity>

  constructor(private readonly dataSource: DataSource) {
    this.repo = dataSource.getRepository(ProductEntity)
  }

  async list(filters: ProductFilters, { page, limit }: PageRequest): Promise<Page<Product>> {
    const qb = this.repo.createQueryBuilder('product').innerJoinAndSelect('product.category', 'category')

    if (filters.search) {
      const term = filters.search
      qb.andWhere(
        new Brackets((where) =>
          where
            .where('product.name ILIKE :like', { like: `%${escapeLike(term)}%` })
            .orWhere('product.id ILIKE :like')
            .orWhere('product.barcode = :code', { code: term }),
        ),
      )
    }
    if (filters.categoryId) qb.andWhere('product.categoryId = :categoryId', { categoryId: filters.categoryId })
    if (filters.status) qb.andWhere('product.status = :status', { status: filters.status })
    if (filters.lowStock !== undefined) {
      qb.andWhere(filters.lowStock ? 'product.stock <= product.minStockAlert' : 'product.stock > product.minStockAlert')
    }
    if (filters.quickAccess !== undefined) {
      qb.andWhere('product.isQuickAccess = :quickAccess', { quickAccess: filters.quickAccess })
    }

    const [property, direction] = SORT_COLUMNS[filters.sort]
    const [data, total] = await qb
      .orderBy(`product.${property}`, direction)
      .addOrderBy('product.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount()

    return { data, meta: { page, limit, total } }
  }

  findById(id: string): Promise<Product | null> {
    return this.repo.findOne({ where: { id }, relations: { category: true } })
  }

  findByCode(code: string): Promise<Product | null> {
    return this.repo.findOne({ where: [{ barcode: code }, { id: code }], relations: { category: true } })
  }

  existsById(id: string): Promise<boolean> {
    return this.repo.exists({ where: { id }, withDeleted: true })
  }

  async create(data: NewProduct, initialStock: InitialStock | null): Promise<Product> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const stock = initialStock?.quantity ?? 0
        await manager.insert(ProductEntity, { ...data, stock })
        if (initialStock) {
          await manager.insert(InventoryMovementEntity, {
            productId: data.id,
            type: MovementType.RESTOCK,
            quantityDelta: stock,
            stockAfter: stock,
            userId: initialStock.userId,
            note: 'Inventario inicial',
          })
        }
        return manager.findOneOrFail(ProductEntity, { where: { id: data.id }, relations: { category: true } })
      })
    } catch (error) {
      throw mapWriteError(error, data)
    }
  }

  async update(id: string, changes: ProductChanges): Promise<Product | null> {
    try {
      const result = await this.repo.update({ id, deletedAt: IsNull() }, changes)
      if (!result.affected) return null
    } catch (error) {
      throw mapWriteError(error, changes)
    }
    return this.findById(id)
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.repo.softDelete({ id, deletedAt: IsNull() })
    return (result.affected ?? 0) > 0
  }
}

function mapWriteError(error: unknown, data: ProductChanges & { id?: string }) {
  const column = uniqueViolationColumn(error)
  if (column === 'id') return new ConflictError('PRODUCT_ALREADY_EXISTS', `Ya existe un producto con el SKU ${data.id}`)
  if (column === 'barcode') {
    return new ConflictError('BARCODE_ALREADY_EXISTS', `El código de barras ${data.barcode} ya está asignado a otro producto`)
  }
  if (isForeignKeyViolation(error)) return new InvalidInputError('CATEGORY_NOT_FOUND', 'La categoría no existe')
  return error
}

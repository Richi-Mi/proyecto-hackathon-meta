import type { DataSource } from 'typeorm'
import type { Page, PageRequest } from '../../../application/common/pagination'
import type { InventoryRepository, MovementFilters, StockChange } from '../../../application/ports/inventory-repository'
import type { InventoryMovement, InventorySummary } from '../../../domain/models/inventory'
import { InventoryMovementEntity, ProductEntity } from '../entities'

interface SummaryRow {
  totalProducts: string
  totalUnits: string
  totalCostValue: string
  totalRetailValue: string
  lowStockCount: string
  outOfStockCount: string
}

interface CategoryRow {
  categoryId: string
  name: string
  units: string
  costValue: string
}

export class TypeOrmInventoryRepository implements InventoryRepository {
  constructor(private readonly dataSource: DataSource) {}

  applyStockChange(change: StockChange, guard?: (currentStock: number) => void): Promise<InventoryMovement | null> {
    return this.dataSource.transaction(async (manager) => {
      const product = await manager.findOne(ProductEntity, {
        where: { id: change.productId },
        lock: { mode: 'pessimistic_write' },
      })
      if (!product) return null

      guard?.(product.stock)
      const stockAfter = product.stock + change.quantityDelta
      await manager.update(
        ProductEntity,
        { id: product.id },
        { stock: stockAfter, ...(change.newPurchaseCost !== undefined && { purchaseCost: change.newPurchaseCost }) },
      )
      return manager.save(
        manager.create(InventoryMovementEntity, {
          productId: product.id,
          type: change.type,
          quantityDelta: change.quantityDelta,
          stockAfter,
          userId: change.userId,
          note: change.note,
        }),
      )
    })
  }

  async summary(): Promise<InventorySummary> {
    // El stock negativo (ventas AUTOMATED sin existencias registradas) cuenta como 0 en las valuaciones.
    const [totals] = await this.dataSource.query<SummaryRow[]>(`
      SELECT count(*)                                              AS "totalProducts",
             coalesce(sum(greatest(stock, 0)), 0)                  AS "totalUnits",
             coalesce(sum(greatest(stock, 0) * purchase_cost), 0)  AS "totalCostValue",
             coalesce(sum(greatest(stock, 0) * price), 0)          AS "totalRetailValue",
             count(*) FILTER (WHERE stock <= min_stock_alert)      AS "lowStockCount",
             count(*) FILTER (WHERE stock <= 0)                    AS "outOfStockCount"
      FROM products
      WHERE deleted_at IS NULL`)
    const byCategory = await this.dataSource.query<CategoryRow[]>(`
      SELECT c.id AS "categoryId",
             c.name,
             coalesce(sum(greatest(p.stock, 0)), 0)                   AS units,
             coalesce(sum(greatest(p.stock, 0) * p.purchase_cost), 0) AS "costValue"
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.deleted_at IS NULL
      GROUP BY c.id
      ORDER BY c.sort_order, c.name`)

    return {
      totalProducts: Number(totals?.totalProducts ?? 0),
      totalUnits: Number(totals?.totalUnits ?? 0),
      totalCostValue: Number(totals?.totalCostValue ?? 0),
      totalRetailValue: Number(totals?.totalRetailValue ?? 0),
      lowStockCount: Number(totals?.lowStockCount ?? 0),
      outOfStockCount: Number(totals?.outOfStockCount ?? 0),
      byCategory: byCategory.map((row) => ({
        categoryId: row.categoryId,
        name: row.name,
        units: Number(row.units),
        costValue: Number(row.costValue),
      })),
    }
  }

  async listMovements(filters: MovementFilters, { page, limit }: PageRequest): Promise<Page<InventoryMovement>> {
    const qb = this.dataSource.getRepository(InventoryMovementEntity).createQueryBuilder('movement')
    if (filters.productId) qb.andWhere('movement.productId = :productId', { productId: filters.productId })
    if (filters.type) qb.andWhere('movement.type = :type', { type: filters.type })
    if (filters.from) qb.andWhere('movement.createdAt >= :from', { from: filters.from })
    if (filters.to) qb.andWhere('movement.createdAt <= :to', { to: filters.to })

    const [data, total] = await qb
      .orderBy('movement.createdAt', 'DESC')
      .addOrderBy('movement.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount()
    return { data, meta: { page, limit, total } }
  }
}

import { In, type DataSource, type EntityManager } from 'typeorm'
import type { LockedProduct, SaleDraft, SaleRepository } from '../../../application/ports/sale-repository'
import { MovementType } from '../../../domain/enums'
import { ConflictError } from '../../../domain/errors'
import type { Sale } from '../../../domain/models/sale'
import { InventoryMovementEntity, ProductEntity, SaleEntity, SaleItemEntity } from '../entities'
import { uniqueViolationColumn } from '../pg-errors'

const SALE_RELATIONS = { items: true, customer: true, cashier: true } as const

export class TypeOrmSaleRepository implements SaleRepository {
  constructor(private readonly dataSource: DataSource) {}

  async recordSale(productIds: string[], build: (products: Map<string, LockedProduct>) => SaleDraft): Promise<Sale> {
    try {
      const saleId = await this.dataSource.transaction(async (manager) => {
        const locked = await manager.find(ProductEntity, {
          where: { id: In(productIds) },
          order: { id: 'ASC' },
          lock: { mode: 'pessimistic_write' },
        })
        const draft = build(new Map(locked.map((product) => [product.id, product])))
        const stockById = new Map(locked.map((product) => [product.id, product.stock]))

        const { items, customerId, ...header } = draft
        const sale = await manager.save(
          manager.create(SaleEntity, {
            ...header,
            userId: customerId,
            items: items.map((item) => manager.create(SaleItemEntity, item)),
          }),
        )
        await applyStockAndKardex(manager, sale.id, draft, stockById)
        return sale.id
      })
      return (await this.findById(saleId))!
    } catch (error) {
      if (uniqueViolationColumn(error) === 'external_event_id') {
        throw new ConflictError('DUPLICATE_SALE_EVENT', 'La venta ya fue registrada')
      }
      throw error
    }
  }

  async findById(id: string): Promise<Sale | null> {
    const entity = await this.dataSource.getRepository(SaleEntity).findOne({ where: { id }, relations: SALE_RELATIONS })
    return entity ? toSale(entity) : null
  }

  async findByExternalEventId(externalEventId: string): Promise<Sale | null> {
    const entity = await this.dataSource
      .getRepository(SaleEntity)
      .findOne({ where: { externalEventId }, relations: SALE_RELATIONS })
    return entity ? toSale(entity) : null
  }

  count(): Promise<number> {
    return this.dataSource.getRepository(SaleEntity).count()
  }
}

async function applyStockAndKardex(
  manager: EntityManager,
  saleId: string,
  draft: SaleDraft,
  stockById: Map<string, number>,
) {
  for (const item of draft.items) {
    const stockAfter = (stockById.get(item.productId) ?? 0) - item.quantity
    await manager.update(ProductEntity, { id: item.productId }, { stock: stockAfter })
    await manager.insert(InventoryMovementEntity, {
      productId: item.productId,
      type: MovementType.SALE,
      quantityDelta: -item.quantity,
      stockAfter,
      saleId,
      userId: draft.cashierId ?? draft.customerId,
      ...(draft.dateTime && { createdAt: draft.dateTime }),
    })
  }
}

function toSale(entity: SaleEntity): Sale {
  return {
    id: entity.id,
    folio: entity.folio,
    dateTime: entity.dateTime,
    saleType: entity.saleType,
    paymentMethod: entity.paymentMethod,
    paymentStatus: entity.paymentStatus,
    status: entity.status,
    subtotal: entity.subtotal,
    taxAmount: entity.taxAmount,
    totalAmount: entity.totalAmount,
    cashReceived: entity.cashReceived,
    changeGiven: entity.changeGiven,
    paymentReference: entity.paymentReference,
    customer: entity.customer ? { id: entity.customer.id, name: entity.customer.name } : null,
    cashier: entity.cashier ? { id: entity.cashier.id, name: entity.cashier.name } : null,
    cancelledAt: entity.cancelledAt,
    cancelReason: entity.cancelReason,
    items: [...entity.items]
      .sort((a, b) => a.productName.localeCompare(b.productName))
      .map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitCost: item.unitCost,
        taxRate: item.taxRate,
        subtotal: item.subtotal,
      })),
  }
}

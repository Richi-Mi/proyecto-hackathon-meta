import { In, type DataSource, type EntityManager } from 'typeorm'
import type { Page, PageRequest } from '../../../application/common/pagination'
import type {
  CancellationDraft,
  LockedProduct,
  PaymentResult,
  SaleDraft,
  SaleFilters,
  SaleRepository,
} from '../../../application/ports/sale-repository'
import { MovementType, PaymentStatus, SaleStatus } from '../../../domain/enums'
import { ConflictError } from '../../../domain/errors'
import type { Sale } from '../../../domain/models/sale'
import { InventoryMovementEntity, ProductEntity, SaleEntity, SaleItemEntity } from '../entities'
import { uniqueViolationColumn } from '../pg-errors'
import { closeVisit } from './typeorm-store-visit.repository'

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

        const { items, customerId, visit, ...header } = draft
        if (visit) await closeVisit(manager, visit)
        const sale = await manager.save(
          manager.create(SaleEntity, {
            ...header,
            userId: customerId,
            visitId: visit?.visitId ?? null,
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

  async cancel(
    saleId: string,
    apply: (sale: Sale) => CancellationDraft | Promise<CancellationDraft>,
  ): Promise<Sale | null> {
    const cancelledId = await this.dataSource.transaction(async (manager) => {
      // FOR UPDATE no admite LEFT JOIN: primero se bloquea la fila y luego se cargan las relaciones
      const locked = await manager.findOne(SaleEntity, { where: { id: saleId }, lock: { mode: 'pessimistic_write' } })
      if (!locked) return null
      const entity = await manager.findOneOrFail(SaleEntity, { where: { id: saleId }, relations: SALE_RELATIONS })
      const draft = await apply(toSale(entity))

      const quantities = new Map<string, number>()
      for (const item of entity.items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity)
      // Se repone stock aunque el producto esté dado de baja: el kardex debe cuadrar
      const products = await manager.find(ProductEntity, {
        where: { id: In([...quantities.keys()]) },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
        withDeleted: true,
      })
      for (const product of products) {
        const quantity = quantities.get(product.id) ?? 0
        const stockAfter = product.stock + quantity
        await manager.update(ProductEntity, { id: product.id }, { stock: stockAfter })
        await manager.insert(InventoryMovementEntity, {
          productId: product.id,
          type: MovementType.CANCELLATION,
          quantityDelta: quantity,
          stockAfter,
          saleId,
          userId: draft.cancelledById,
          note: `Cancelación del ticket #${entity.folio}: ${draft.reason}`,
        })
      }

      await manager.update(
        SaleEntity,
        { id: saleId },
        {
          status: SaleStatus.CANCELLED,
          paymentStatus: draft.paymentStatus,
          cancelledAt: new Date(),
          cancelledById: draft.cancelledById,
          cancelReason: draft.reason,
        },
      )
      return saleId
    })
    return cancelledId ? this.findById(cancelledId) : null
  }

  async setPaymentResult(saleId: string, { paymentStatus, paymentReference }: PaymentResult): Promise<Sale> {
    await this.dataSource
      .getRepository(SaleEntity)
      .update({ id: saleId, paymentStatus: PaymentStatus.PENDING }, { paymentStatus, paymentReference })
    return (await this.findById(saleId))!
  }

  async list(filters: SaleFilters, { page, limit }: PageRequest): Promise<Page<Sale>> {
    const qb = this.dataSource
      .getRepository(SaleEntity)
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.items', 'item')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoinAndSelect('sale.cashier', 'cashier')

    if (filters.from) qb.andWhere('sale.dateTime >= :from', { from: filters.from })
    if (filters.to) qb.andWhere('sale.dateTime < :to', { to: filters.to })
    if (filters.type) qb.andWhere('sale.saleType = :type', { type: filters.type })
    if (filters.status) qb.andWhere('sale.status = :status', { status: filters.status })
    if (filters.paymentMethod) qb.andWhere('sale.paymentMethod = :method', { method: filters.paymentMethod })
    if (filters.folio !== undefined) qb.andWhere('sale.folio = :folio', { folio: filters.folio })
    if (filters.customerId) qb.andWhere('sale.userId = :customerId', { customerId: filters.customerId })

    const [entities, total] = await qb
      .orderBy('sale.dateTime', 'DESC')
      .addOrderBy('sale.folio', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount()
    return { data: entities.map(toSale), meta: { page, limit, total } }
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

import { Role, SaleStatus } from '../../domain/enums'
import { ForbiddenError, InvalidInputError, NotFoundError, UnauthorizedError } from '../../domain/errors'
import { roundMoney } from '../../domain/money'
import type { Sale } from '../../domain/models/sale'
import type { PageRequest } from '../common/pagination'
import type { EntryPassSigner } from '../ports/entry-pass-signer'
import type { SaleRepository } from '../ports/sale-repository'
import type { UserRepository } from '../ports/user-repository'

export interface EntryPass {
  token: string
  expiresAt: Date
  /** El cliente debe pedir un pase nuevo antes de que expire el actual */
  refreshInSeconds: number
}

export interface PurchaseGroup {
  /** YYYY-MM-DD en la zona horaria de la tienda */
  date: string
  /** Σ de las compras no canceladas del día */
  totalAmount: number
  sales: Sale[]
}

export interface PurchaseHistory {
  groups: PurchaseGroup[]
  meta: PageRequest & { total: number }
}

export interface CustomerConfig {
  entryPassTtlSeconds: number
  /** Zona IANA de la tienda para agrupar compras por día */
  timeZone: string
}

export class CustomerUseCases {
  private readonly localDate: Intl.DateTimeFormat

  constructor(
    private readonly users: UserRepository,
    private readonly sales: SaleRepository,
    private readonly signer: EntryPassSigner,
    private readonly config: CustomerConfig,
  ) {
    // en-CA formatea como YYYY-MM-DD
    this.localDate = new Intl.DateTimeFormat('en-CA', { timeZone: config.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
  }

  /** Compras del cliente, más recientes primero, agrupadas por día (la paginación es por compra). */
  async listPurchases(customerId: string, range: { from?: Date; to?: Date }, page: PageRequest): Promise<PurchaseHistory> {
    if (range.from && range.to && range.from >= range.to) {
      throw new InvalidInputError('INVALID_RANGE', '`from` debe ser anterior a `to`')
    }
    const { data, meta } = await this.sales.list({ ...range, customerId }, page)

    const groups: PurchaseGroup[] = []
    for (const sale of data) {
      const date = this.localDate.format(sale.dateTime)
      let group = groups.at(-1)
      if (group?.date !== date) {
        group = { date, totalAmount: 0, sales: [] }
        groups.push(group)
      }
      group.sales.push(sale)
      if (sale.status === SaleStatus.COMPLETED) group.totalAmount = roundMoney(group.totalAmount + sale.totalAmount)
    }
    return { groups, meta }
  }

  /** 404 también si la compra existe pero es de otra persona: no se revela su existencia. */
  async getPurchase(customerId: string, saleId: string): Promise<Sale> {
    const sale = await this.sales.findById(saleId)
    if (!sale || sale.customer?.id !== customerId) {
      throw new NotFoundError('PURCHASE_NOT_FOUND', 'No encontramos esa compra en tu historial')
    }
    return sale
  }

  /** JWT de vida corta y un solo uso que la app muestra como QR en el escáner de entrada. */
  async issueEntryPass(userId: string): Promise<EntryPass> {
    const user = await this.users.findById(userId)
    if (!user?.isActive) throw new UnauthorizedError('INVALID_TOKEN', 'La sesión ya no es válida')
    if (user.role !== Role.CUSTOMER) {
      throw new ForbiddenError('CUSTOMERS_ONLY', 'Solo los clientes tienen pase de entrada')
    }

    // Precisión de segundos: es lo que guarda el claim `exp`
    const expiresAt = new Date((Math.floor(Date.now() / 1000) + this.config.entryPassTtlSeconds) * 1000)
    const token = await this.signer.sign({ userId: user.id, jti: crypto.randomUUID(), expiresAt })
    return { token, expiresAt, refreshInSeconds: Math.floor(this.config.entryPassTtlSeconds * 0.75) }
  }
}

import type {
  ChargeRequest,
  ChargeResult,
  PaymentCustomer,
  PaymentGateway,
  RefundRequest,
} from '../../application/ports/payment-gateway'

export interface MockPaymentGatewayOptions {
  /** Probabilidad (0–1) de rechazar un cobro aunque el cliente tenga método de pago */
  failureRate?: number
  /** Inyectable para pruebas deterministas */
  random?: () => number
}

const CUSTOMER_PREFIX = 'mock_cus_'
const CHARGE_PREFIX = 'mock_ch_'

/**
 * Pasarela simulada: el registro "vincula" una tarjeta ficticia y los cobros se aprueban, salvo que el cliente
 * no tenga referencia o salga sorteado según `failureRate`. No hay red ni datos de tarjeta.
 */
export class MockPaymentGateway implements PaymentGateway {
  private readonly failureRate: number
  private readonly random: () => number

  constructor({ failureRate = 0, random = Math.random }: MockPaymentGatewayOptions = {}) {
    this.failureRate = failureRate
    this.random = random
  }

  async registerCustomer(_customer: PaymentCustomer): Promise<string> {
    return `${CUSTOMER_PREFIX}${crypto.randomUUID()}`
  }

  async charge({ customerRef, amount }: ChargeRequest): Promise<ChargeResult> {
    if (!customerRef?.startsWith(CUSTOMER_PREFIX)) return { approved: false, reason: 'NO_PAYMENT_METHOD' }
    if (amount <= 0) return { approved: false, reason: 'INVALID_AMOUNT' }
    if (this.random() < this.failureRate) return { approved: false, reason: 'CARD_DECLINED' }
    return { approved: true, transactionId: `${CHARGE_PREFIX}${crypto.randomUUID()}` }
  }

  async refund({ transactionId }: RefundRequest): Promise<{ refundId: string }> {
    if (!transactionId.startsWith(CHARGE_PREFIX)) throw new Error(`Cobro desconocido para la pasarela simulada: ${transactionId}`)
    return { refundId: `mock_re_${crypto.randomUUID()}` }
  }
}

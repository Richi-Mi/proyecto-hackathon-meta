export interface PaymentCustomer {
  id: string
  name: string
  email: string
}

export interface ChargeRequest {
  /** `users.paymentCustomerRef`; null si el cliente no tiene método de pago guardado */
  customerRef: string | null
  amount: number
  /** Referencia interna (id de la venta): la pasarela la usa como llave de idempotencia */
  reference: string
}

export type ChargeResult = { approved: true; transactionId: string } | { approved: false; reason: string }

export interface RefundRequest {
  /** `transactionId` del cobro original */
  transactionId: string
  amount: number
  reference: string
}

/** Pasarela de pago (hoy simulada; reemplazable por Stripe o MercadoPago). */
export interface PaymentGateway {
  /** Da de alta al cliente en la pasarela y devuelve su referencia */
  registerCustomer(customer: PaymentCustomer): Promise<string>
  /** Un rechazo no es una excepción: se devuelve `approved: false` */
  charge(request: ChargeRequest): Promise<ChargeResult>
  /** @throws Error si la pasarela rechaza el reembolso */
  refund(request: RefundRequest): Promise<{ refundId: string }>
}

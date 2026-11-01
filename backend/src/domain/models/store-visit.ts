import type { VisitStatus } from '../enums'

/** Visita a la tienda física: se abre al escanear el QR y se cierra con el webhook de salida. */
export interface StoreVisit {
  id: string
  userId: string
  gateId: string
  status: VisitStatus
  enteredAt: Date
  exitedAt: Date | null
  /** `eventId` del webhook que cerró la visita (idempotencia, también sin venta) */
  exitEventId: string | null
}

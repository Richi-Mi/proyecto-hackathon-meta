import { create } from 'zustand'
import type { Product } from '@/lib/api/types'
import { priceSale } from '@/lib/pricing'

export interface CartLine {
  product: Product
  quantity: number
}

interface PosCartState {
  lines: CartLine[]
  /** Llave de idempotencia del intento de cobro actual; cambia si cambia el ticket */
  attemptKey: string
  add: (product: Product, quantity?: number) => void
  setQuantity: (productId: string, quantity: number) => void
  remove: (productId: string) => void
  clear: () => void
}

const withNewAttempt = (lines: CartLine[]) => ({ lines, attemptKey: crypto.randomUUID() })

export const usePosCart = create<PosCartState>()((set) => ({
  lines: [],
  attemptKey: crypto.randomUUID(),
  add: (product, quantity = 1) =>
    set((state) => {
      const existing = state.lines.find((line) => line.product.id === product.id)
      // El último escaneado queda arriba, como en un ticket
      const others = state.lines.filter((line) => line.product.id !== product.id)
      return withNewAttempt([{ product, quantity: (existing?.quantity ?? 0) + quantity }, ...others])
    }),
  setQuantity: (productId, quantity) =>
    set((state) =>
      withNewAttempt(
        quantity <= 0
          ? state.lines.filter((line) => line.product.id !== productId)
          : state.lines.map((line) => (line.product.id === productId ? { ...line, quantity } : line)),
      ),
    ),
  remove: (productId) => set((state) => withNewAttempt(state.lines.filter((line) => line.product.id !== productId))),
  clear: () => set(withNewAttempt([])),
}))

export const cartTotals = (lines: CartLine[]) =>
  priceSale(lines.map(({ product, quantity }) => ({ quantity, unitPrice: product.price, taxRate: product.taxRate })))

export const cartUnits = (lines: CartLine[]) => lines.reduce((sum, line) => sum + line.quantity, 0)

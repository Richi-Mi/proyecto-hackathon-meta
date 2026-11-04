import { LoaderCircle, Minus, Plus, Search, Shuffle, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { getErrorMessage } from '@/lib/api/client'
import type { CheckoutResult, Product, StoreVisit } from '@/lib/api/types'
import { useApiQuery } from '@/lib/api/use-api-query'
import { formatDateTime, formatMoney } from '@/lib/format'
import { priceSale } from '@/lib/pricing'
import { PAYMENT_STATUS_LABEL } from '@/lib/sale-labels'
import { checkoutAtGate, fetchCategories, fetchProducts } from '../api'
import { CatalogGrid, QUICK_ACCESS } from '../pos/CatalogGrid'

interface GateCheckoutDialogProps {
  visit: StoreVisit | null
  onClose: () => void
  /** La visita se cerró (con o sin venta) */
  onDone: (result: CheckoutResult) => void
}

/** El propietario registra lo que se llevó el cliente: equivale al webhook de las cámaras de salida. */
export function GateCheckoutDialog({ visit, onClose, onDone }: GateCheckoutDialogProps) {
  return (
    <Dialog open={visit !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        {visit && <CheckoutForm key={visit.id} visit={visit} onClose={onClose} onDone={onDone} />}
      </DialogContent>
    </Dialog>
  )
}

const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** De 1 a 4 productos con stock, 1 o 2 piezas de cada uno (como "Simular visita") */
function randomBasket(products: Product[]): Map<string, number> {
  const pool = products.filter((product) => product.stock > 0)
  const basket = new Map<string, number>()
  const count = Math.min(pool.length, 1 + Math.floor(Math.random() * 4))
  for (let i = 0; i < count; i++) {
    const [product] = pool.splice(Math.floor(Math.random() * pool.length), 1)
    basket.set(product!.id, 1 + Math.floor(Math.random() * Math.min(2, product!.stock)))
  }
  return basket
}

function CheckoutForm({ visit, onClose, onDone }: { visit: StoreVisit; onClose: () => void; onDone: (result: CheckoutResult) => void }) {
  const [basket, setBasket] = useState<Map<string, number>>(new Map())
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState(QUICK_ACCESS)
  const [sending, setSending] = useState(false)

  const categories = useApiQuery(fetchCategories, [])
  const catalog = useApiQuery((signal) => fetchProducts({ status: 'ACTIVE', limit: 100, sort: 'name' }, signal), [])
  const products = catalog.data?.data

  const visible = useMemo(() => {
    if (!products) return undefined
    const term = normalize(query.trim())
    if (term) return products.filter((p) => normalize(p.name).includes(term) || p.id.toLowerCase().includes(term) || p.barcode === query.trim())
    return categoryId === QUICK_ACCESS ? products.filter((p) => p.isQuickAccess) : products.filter((p) => p.category.id === categoryId)
  }, [products, query, categoryId])

  const lines = useMemo(
    () =>
      [...basket].flatMap(([id, quantity]) => {
        const product = products?.find((p) => p.id === id)
        return product ? [{ product, quantity }] : []
      }),
    [basket, products],
  )
  const total = priceSale(lines.map(({ product, quantity }) => ({ quantity, unitPrice: product.price, taxRate: product.taxRate }))).totalAmount
  const units = lines.reduce((sum, line) => sum + line.quantity, 0)

  const setQuantity = (productId: string, quantity: number) =>
    setBasket((current) => {
      const next = new Map(current)
      if (quantity <= 0) next.delete(productId)
      else next.set(productId, quantity)
      return next
    })

  async function submit(items: { productId: string; quantity: number }[]) {
    setSending(true)
    try {
      const result = await checkoutAtGate(visit.id, items)
      if (result.saleId === null) {
        toast.success(`${visit.customer.name} salió sin comprar`, { description: 'Visita cerrada' })
      } else {
        const paid = result.paymentStatus === 'PAID'
        toast[paid ? 'success' : 'warning'](`Ticket #${result.folio} · ${formatMoney(result.totalAmount)}`, {
          description: `${visit.customer.name} · ${result.paymentStatus ? PAYMENT_STATUS_LABEL[result.paymentStatus] : ''}${paid ? '' : ' (queda como adeudo)'}`,
        })
      }
      onDone(result)
    } catch (error) {
      toast.error('No se pudo registrar la salida', { description: getErrorMessage(error) })
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Salida de {visit.customer.name}</DialogTitle>
        <DialogDescription>
          Entró {formatDateTime(visit.enteredAt)} por {visit.gateId}. Elige lo que se lleva: se cobra con su método guardado y se
          descuenta del inventario.
        </DialogDescription>
      </DialogHeader>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar producto, SKU o código de barras"
          className="pl-9"
          aria-label="Buscar producto"
        />
      </div>

      <div className="grid h-72">
        <CatalogGrid
          categories={categories.data ?? []}
          products={visible}
          selected={query.trim() ? '' : categoryId}
          onSelect={(id) => {
            setQuery('')
            setCategoryId(id)
          }}
          onAdd={(product) => setQuantity(product.id, (basket.get(product.id) ?? 0) + 1)}
          inCart={basket}
        />
      </div>
      {Boolean(catalog.error) && <p className="text-sm text-destructive">{getErrorMessage(catalog.error)}</p>}

      <section aria-label="Lo que se lleva" className="grid gap-2 rounded-xl border p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Se lleva {units > 0 ? `${units} pieza${units === 1 ? '' : 's'}` : 'nada todavía'}</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!products?.length || sending}
            onClick={() => setBasket(randomBasket(products ?? []))}
          >
            <Shuffle /> Al azar
          </Button>
        </div>
        {lines.length === 0 && <p className="text-sm text-muted-foreground">Toca los productos del catálogo para agregarlos.</p>}
        <ul className="grid gap-1.5">
          {lines.map(({ product, quantity }) => (
            <li key={product.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{product.name}</span>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Quitar una" onClick={() => setQuantity(product.id, quantity - 1)}>
                <Minus />
              </Button>
              <span className="w-6 text-center tabular-nums">{quantity}</span>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Agregar una" onClick={() => setQuantity(product.id, quantity + 1)}>
                <Plus />
              </Button>
              <span className="w-20 text-right tabular-nums">{formatMoney(product.price * quantity)}</span>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Quitar" onClick={() => setQuantity(product.id, 0)}>
                <X />
              </Button>
            </li>
          ))}
        </ul>
        {lines.length > 0 && (
          <p className="flex justify-between border-t pt-2 font-heading text-base font-semibold tabular-nums">
            <span>Total</span>
            <span>{formatMoney(total)}</span>
          </p>
        )}
      </section>

      <DialogFooter className="gap-2 sm:justify-between">
        <Button type="button" variant="ghost" onClick={onClose} disabled={sending}>
          Cancelar
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" disabled={sending} onClick={() => void submit([])}>
            Salió sin comprar
          </Button>
          <Button
            type="button"
            disabled={sending || lines.length === 0}
            onClick={() => void submit(lines.map(({ product, quantity }) => ({ productId: product.id, quantity })))}
          >
            {sending && <LoaderCircle className="animate-spin" />}
            Cobrar {lines.length > 0 && formatMoney(total)}
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}

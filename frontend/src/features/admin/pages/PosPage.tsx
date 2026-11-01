import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ApiError, getErrorMessage } from '@/lib/api/client'
import type { Product, SaleDetail } from '@/lib/api/types'
import { useApiQuery } from '@/lib/api/use-api-query'
import { fetchCategories, fetchProducts, createManualSale } from '../api'
import { CashDialog } from '../pos/CashDialog'
import { CatalogGrid, QUICK_ACCESS } from '../pos/CatalogGrid'
import { cartTotals, usePosCart } from '../pos/pos-cart-store'
import { ReceiptDialog } from '../pos/ReceiptDialog'
import { ScannerInput } from '../pos/ScannerInput'
import { TicketPanel, type PaymentMethod } from '../pos/TicketPanel'

interface StockIssue {
  productId: string
  requested: number
  available: number
}

const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function PosPage() {
  const scannerRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState(QUICK_ACCESS)
  const [charging, setCharging] = useState<PaymentMethod | null>(null)
  const [cashOpen, setCashOpen] = useState(false)
  const [receipt, setReceipt] = useState<SaleDetail | null>(null)

  const categories = useApiQuery(fetchCategories, [])
  const catalog = useApiQuery((signal) => fetchProducts({ status: 'ACTIVE', limit: 100, sort: 'name' }, signal), [])
  const { lines, add, clear, attemptKey } = usePosCart()

  const products = catalog.data?.data
  const visible = useMemo(() => {
    if (!products) return undefined
    const term = normalize(query.trim())
    if (term) {
      return products.filter((p) => normalize(p.name).includes(term) || p.id.toLowerCase().includes(term) || p.barcode === query.trim())
    }
    return categoryId === QUICK_ACCESS ? products.filter((p) => p.isQuickAccess) : products.filter((p) => p.category.id === categoryId)
  }, [products, query, categoryId])

  const inCart = useMemo(() => new Map(lines.map((line) => [line.product.id, line.quantity])), [lines])
  const refocusScanner = () => requestAnimationFrame(() => scannerRef.current?.focus())

  function addToTicket(product: Product) {
    if ((inCart.get(product.id) ?? 0) >= product.stock) {
      toast.warning(`No hay más piezas de ${product.name} en inventario`)
    } else {
      add(product)
    }
    refocusScanner()
  }

  async function charge(method: PaymentMethod, cashReceived?: number) {
    setCharging(method)
    try {
      const sale = await createManualSale(
        { items: lines.map(({ product, quantity }) => ({ productId: product.id, quantity })), paymentMethod: method, cashReceived },
        attemptKey,
      )
      setCashOpen(false)
      setReceipt(sale)
      clear()
      catalog.reload()
    } catch (error) {
      if (error instanceof ApiError && error.code === 'INSUFFICIENT_STOCK' && Array.isArray(error.details)) {
        const issues = (error.details as StockIssue[]).map((issue) => {
          const name = lines.find((line) => line.product.id === issue.productId)?.product.name ?? issue.productId
          return `${name}: hay ${issue.available}`
        })
        toast.error('Stock insuficiente', { description: issues.join(' · ') })
        catalog.reload()
      } else {
        toast.error(getErrorMessage(error))
      }
    } finally {
      setCharging(null)
    }
  }

  return (
    <div className="grid gap-4 lg:h-[calc(100dvh-7rem)] lg:grid-cols-[1fr_minmax(22rem,26rem)]">
      <section className="grid min-h-0 grid-rows-[auto_1fr] gap-4" aria-label="Catálogo">
        <ScannerInput inputRef={scannerRef} value={query} onChange={setQuery} catalog={products ?? []} onProduct={addToTicket} />
        <CatalogGrid
          categories={categories.data ?? []}
          products={visible}
          selected={query.trim() ? '' : categoryId}
          onSelect={(id) => {
            setQuery('')
            setCategoryId(id)
            refocusScanner()
          }}
          onAdd={addToTicket}
          inCart={inCart}
        />
      </section>

      <TicketPanel charging={charging} onPay={(method) => (method === 'CASH' ? setCashOpen(true) : void charge(method))} />

      <CashDialog
        total={cartTotals(lines).totalAmount}
        open={cashOpen}
        onOpenChange={setCashOpen}
        onConfirm={(cashReceived) => void charge('CASH', cashReceived)}
      />
      <ReceiptDialog
        sale={receipt}
        onClose={() => {
          setReceipt(null)
          refocusScanner()
        }}
      />
    </div>
  )
}

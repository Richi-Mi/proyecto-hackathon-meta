import { AlertTriangle, Boxes, ChevronLeft, ChevronRight, Package, Plus, Search, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { getErrorMessage } from '@/lib/api/client'
import { useApiQuery } from '@/lib/api/use-api-query'
import { formatMoney } from '@/lib/format'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { fetchCategories, fetchInventorySummary, fetchProducts } from '../api'
import { KpiCard } from '../components/KpiCard'
import type { Product } from '@/lib/api/types'
import { DeleteProductDialog } from '../inventory/DeleteProductDialog'
import { MovementsSheet } from '../inventory/MovementsSheet'
import { ProductFormSheet } from '../inventory/ProductFormSheet'
import { ProductTable, type ProductAction, type SortValue } from '../inventory/ProductTable'
import { FALLBACK_TAX_RATE, useSettingsStore } from '../settings/settings-store'
import { StockAdjustmentDialog, type StockMode } from '../inventory/StockAdjustmentDialog'

const PAGE_SIZE = 20
const ALL_CATEGORIES = 'all'

export function InventoryPage() {
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState(ALL_CATEGORIES)
  // /admin/inventory?stock=bajo llega desde el dashboard
  const [lowStockOnly, setLowStockOnly] = useState(searchParams.get('stock') === 'bajo')
  const [sort, setSort] = useState<SortValue>('name')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebouncedValue(search.trim(), 300)

  // Diálogos de acciones sobre productos
  const [form, setForm] = useState<{ product: Product | null } | null>(null)
  const [stockTarget, setStockTarget] = useState<{ product: Product; mode: StockMode } | null>(null)
  const [movementsOf, setMovementsOf] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)

  const defaultTaxRate = useSettingsStore((state) => state.settings?.defaultTaxRate) ?? FALLBACK_TAX_RATE
  const summary = useApiQuery(fetchInventorySummary, [])
  const categories = useApiQuery(fetchCategories, [])
  const products = useApiQuery(
    (signal) =>
      fetchProducts(
        {
          page,
          limit: PAGE_SIZE,
          sort,
          search: debouncedSearch || undefined,
          categoryId: categoryId === ALL_CATEGORIES ? undefined : categoryId,
          lowStock: lowStockOnly || undefined,
        },
        signal,
      ),
    [page, sort, debouncedSearch, categoryId, lowStockOnly],
  )

  /** Tras cualquier cambio: tabla y KPIs al día */
  const refresh = () => {
    products.reload()
    summary.reload()
  }
  const handleAction = (action: ProductAction, product: Product) => {
    if (action === 'edit') setForm({ product })
    if (action === 'restock') setStockTarget({ product, mode: 'RESTOCK' })
    if (action === 'adjust') setStockTarget({ product, mode: 'ADJUSTMENT' })
    if (action === 'movements') setMovementsOf(product)
    if (action === 'delete') setDeleting(product)
  }

  const total = products.data?.meta.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  // Cualquier filtro nuevo regresa a la primera página
  const resetPage = <T,>(apply: (value: T) => void) => (value: T) => {
    apply(value)
    setPage(1)
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Productos"
          icon={Package}
          loading={!summary.data}
          value={summary.data?.totalProducts}
          hint={summary.data && `${summary.data.totalUnits} piezas en existencia`}
        />
        <KpiCard
          label="Valor a costo"
          icon={Boxes}
          loading={!summary.data}
          value={summary.data && formatMoney(summary.data.totalCostValue)}
        />
        <KpiCard
          label="Valor a precio de venta"
          icon={Wallet}
          loading={!summary.data}
          value={summary.data && formatMoney(summary.data.totalRetailValue)}
        />
        <KpiCard
          label="Alertas de stock"
          icon={AlertTriangle}
          tone="warning"
          loading={!summary.data}
          value={summary.data && `${summary.data.lowStockCount} bajos`}
          hint={summary.data && `${summary.data.outOfStockCount} agotado(s)`}
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => resetPage(setSearch)(event.target.value)}
            placeholder="Buscar por nombre, SKU o código de barras"
            className="pl-9"
            aria-label="Buscar productos"
          />
        </div>
        <Select value={categoryId} onValueChange={resetPage(setCategoryId)}>
          <SelectTrigger className="w-52" aria-label="Filtrar por categoría">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORIES}>Todas las categorías</SelectItem>
            {categories.data?.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                <span className="size-2.5 rounded-full" style={{ backgroundColor: category.color }} />
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex h-9 items-center gap-2 rounded-md border px-3">
          <Switch id="low-stock" checked={lowStockOnly} onCheckedChange={resetPage(setLowStockOnly)} />
          <Label htmlFor="low-stock" className="font-normal">
            Solo stock bajo
          </Label>
        </div>
        <Button className="ml-auto" onClick={() => setForm({ product: null })}>
          <Plus /> Nuevo producto
        </Button>
      </div>

      {products.error ? (
        <div className="grid justify-items-center gap-3 rounded-xl border p-10 text-center">
          <p className="text-sm text-muted-foreground">{getErrorMessage(products.error)}</p>
          <Button variant="outline" onClick={products.reload}>
            Reintentar
          </Button>
        </div>
      ) : (
        <ProductTable
          products={products.data?.data}
          sort={sort}
          onSortChange={resetPage(setSort)}
          onAction={handleAction}
          loading={products.loading}
        />
      )}

      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          {total} producto{total === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-2">
          <span>
            Página {page} de {pages}
          </span>
          <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Página anterior">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Página siguiente">
            <ChevronRight />
          </Button>
        </div>
      </div>

      <ProductFormSheet
        open={form !== null}
        product={form?.product ?? null}
        onOpenChange={(open) => !open && setForm(null)}
        categories={categories.data ?? []}
        defaultTaxRate={defaultTaxRate}
        onCategoryCreated={categories.reload}
        onSaved={refresh}
      />
      <StockAdjustmentDialog target={stockTarget} onClose={() => setStockTarget(null)} onDone={refresh} />
      <MovementsSheet product={movementsOf} onClose={() => setMovementsOf(null)} />
      <DeleteProductDialog product={deleting} onClose={() => setDeleting(null)} onDeleted={refresh} />
    </div>
  )
}

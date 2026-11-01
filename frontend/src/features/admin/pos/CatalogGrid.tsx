import { Star } from 'lucide-react'
import { motion } from 'motion/react'
import { Skeleton } from '@/components/ui/skeleton'
import type { Category, Product } from '@/lib/api/types'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

export const QUICK_ACCESS = 'quick'

interface CatalogGridProps {
  categories: Category[]
  products: Product[] | undefined
  selected: string
  onSelect: (categoryId: string) => void
  onAdd: (product: Product) => void
  /** Piezas de cada producto que ya están en el ticket */
  inCart: Map<string, number>
}

export function CatalogGrid({ categories, products, selected, onSelect, onAdd, inCart }: CatalogGridProps) {
  const chips = [{ id: QUICK_ACCESS, name: 'Más vendidos', color: undefined }, ...categories]

  return (
    <div className="grid min-h-0 grid-rows-[auto_1fr] gap-3">
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Categorías">
        {chips.map((chip) => {
          const active = chip.id === selected
          return (
            <button
              key={chip.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(chip.id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors',
                active ? 'border-transparent bg-foreground text-background' : 'bg-background hover:bg-muted',
              )}
            >
              {chip.color ? (
                <span className="size-2.5 rounded-full" style={{ backgroundColor: chip.color }} />
              ) : (
                <Star className="size-3.5" />
              )}
              {chip.name}
            </button>
          )
        })}
      </div>

      <div className="grid auto-rows-min grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3 overflow-y-auto pr-1 pb-2">
        {!products && Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        {products?.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-muted-foreground">Sin productos en esta vista.</p>
        )}
        {products?.map((product) => {
          const available = product.stock - (inCart.get(product.id) ?? 0)
          const soldOut = available <= 0
          return (
            <motion.button
              key={product.id}
              type="button"
              whileTap={soldOut ? undefined : { scale: 0.96 }}
              disabled={soldOut}
              onClick={() => onAdd(product)}
              className="relative grid min-h-28 content-between gap-2 overflow-hidden rounded-2xl border bg-card p-3 text-left shadow-xs transition-shadow hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span aria-hidden className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: product.category.color }} />
              <span className="line-clamp-2 text-sm leading-snug font-medium">{product.name}</span>
              <span className="flex items-end justify-between gap-2">
                <span className="font-heading text-base font-semibold tabular-nums">{formatMoney(product.price)}</span>
                <span
                  className={cn(
                    'rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums',
                    soldOut ? 'bg-destructive/10 text-destructive' : product.isLowStock ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {soldOut ? 'Agotado' : `${available} disp.`}
                </span>
              </span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

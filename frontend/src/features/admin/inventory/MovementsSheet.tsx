import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import type { InventoryMovement, Product } from '@/lib/api/types'
import { getErrorMessage } from '@/lib/api/client'
import { useApiQuery } from '@/lib/api/use-api-query'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { fetchMovements } from '../api'

const TYPE_LABEL: Record<InventoryMovement['type'], { label: string; className: string }> = {
  SALE: { label: 'Venta', className: 'bg-sky-100 text-sky-700' },
  RESTOCK: { label: 'Entrada', className: 'bg-primary/10 text-primary' },
  ADJUSTMENT: { label: 'Ajuste', className: 'bg-amber-100 text-amber-700' },
  CANCELLATION: { label: 'Cancelación', className: 'bg-muted text-muted-foreground' },
}

const PAGE = 20
const MAX = 100 // límite del contrato para `limit`

/** Kardex de un producto: cada cambio de stock con su origen, del más reciente al más antiguo. */
export function MovementsSheet({ product, onClose }: { product: Product | null; onClose: () => void }) {
  return (
    <Sheet open={product !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        {product && <MovementList key={product.id} product={product} />}
      </SheetContent>
    </Sheet>
  )
}

function MovementList({ product }: { product: Product }) {
  const [limit, setLimit] = useState(PAGE)
  const movements = useApiQuery((signal) => fetchMovements({ productId: product.id, limit }, signal), [product.id, limit])
  const data = movements.data?.data
  const total = movements.data?.meta.total ?? 0

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle>Movimientos</SheetTitle>
        <SheetDescription>
          {product.name} · stock actual <span className="font-medium text-foreground">{product.stock}</span>
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {movements.error !== undefined && <p className="py-6 text-center text-sm text-destructive">{getErrorMessage(movements.error)}</p>}
        {!data && movements.error === undefined && (
          <div className="grid gap-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        )}
        {data?.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Sin movimientos registrados.</p>}
        <ol className="grid gap-2">
          {data?.map((movement) => (
            <li key={movement.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border px-3 py-2.5">
              <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', TYPE_LABEL[movement.type].className)}>
                {TYPE_LABEL[movement.type].label}
              </span>
              <span className="grid min-w-0">
                <span className="text-xs text-muted-foreground">{formatDateTime(movement.createdAt)}</span>
                {movement.note && <span className="truncate text-sm">{movement.note}</span>}
              </span>
              <span className="grid justify-items-end tabular-nums">
                <span className={cn('font-semibold', movement.quantityDelta > 0 ? 'text-primary' : 'text-destructive')}>
                  {movement.quantityDelta > 0 ? '+' : ''}
                  {movement.quantityDelta}
                </span>
                <span className="text-xs text-muted-foreground">→ {movement.stockAfter}</span>
              </span>
            </li>
          ))}
        </ol>
        {data && total > data.length && limit < MAX && (
          <Button variant="outline" className="mt-3 w-full" disabled={movements.loading} onClick={() => setLimit(Math.min(limit + PAGE, MAX))}>
            Cargar más ({total - data.length} restantes)
          </Button>
        )}
      </div>
    </>
  )
}

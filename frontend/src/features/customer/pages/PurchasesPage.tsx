import { ChevronRight, QrCode, ScanLine, Store } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useEffectEvent, useState } from 'react'
import { Link } from 'react-router'
import { TicketView } from '@/components/ticket/TicketView'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage } from '@/lib/api/client'
import type { SaleDetail } from '@/lib/api/types'
import { useApiQuery } from '@/lib/api/use-api-query'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { fetchPurchases } from '../api'

const PAGE = 10
const MAX = 100 // límite del contrato para `limit`

const time = new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit' })
const longDay = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })

/** "2026-11-01" (día de la tienda) → "Hoy", "Ayer" o "viernes 30 de octubre" */
function dayTitle(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(year!, month! - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((today.getTime() - date.getTime()) / 86_400_000)
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  return longDay.format(date)
}

const summarizeItems = (sale: SaleDetail) =>
  sale.items.map((item) => (item.quantity > 1 ? `${item.productName} ×${item.quantity}` : item.productName)).join(', ')

export function PurchasesPage() {
  const [limit, setLimit] = useState(PAGE)
  const [selected, setSelected] = useState<SaleDetail | null>(null)
  const history = useApiQuery((signal) => fetchPurchases(limit, signal), [limit])
  // Al volver a la app (p. ej. después de salir de la tienda) aparece la compra automática sin recargar
  const refresh = useEffectEvent(() => history.reload())
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])
  const groups = history.data?.groups
  const loaded = groups?.reduce((sum, group) => sum + group.sales.length, 0) ?? 0
  const total = history.data?.meta.total ?? 0

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Mis compras</h1>
        <p className="text-sm text-muted-foreground">Lo que las cámaras cobraron al salir y tus compras en mostrador.</p>
      </div>

      {history.error !== undefined && !groups && (
        <div className="grid justify-items-center gap-3 rounded-2xl border p-6 text-center text-sm">
          <p className="text-muted-foreground">{getErrorMessage(history.error)}</p>
          <Button variant="outline" onClick={history.reload}>
            Reintentar
          </Button>
        </div>
      )}

      {!groups && history.error === undefined && (
        <div className="grid gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      )}

      {groups?.length === 0 && (
        <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center">
          <ScanLine className="size-10 text-muted-foreground" />
          <p className="font-medium">Aún no tienes compras</p>
          <p className="text-sm text-muted-foreground">Entra a la tienda con tu pase, toma lo que necesites y sal: el ticket aparecerá aquí.</p>
          <Button asChild>
            <Link to="/app">
              <QrCode /> Ver mi pase
            </Link>
          </Button>
        </div>
      )}

      {groups?.map((group) => (
        <section key={group.date} className="grid gap-2" aria-label={dayTitle(group.date)}>
          <header className="sticky top-14 z-10 -mx-4 flex items-baseline justify-between bg-background/90 px-4 py-1.5 backdrop-blur">
            <h2 className="text-sm font-semibold capitalize">{dayTitle(group.date)}</h2>
            <span className="text-sm text-muted-foreground tabular-nums">{formatMoney(group.totalAmount)}</span>
          </header>
          {group.sales.map((sale, index) => {
            const cancelled = sale.status === 'CANCELLED'
            const Icon = sale.saleType === 'AUTOMATED' ? ScanLine : Store
            return (
              <motion.button
                key={sale.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index, 5) * 0.04 }}
                onClick={() => setSelected(sale)}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-colors active:bg-muted"
              >
                <span className={cn('grid size-10 place-items-center rounded-xl', cancelled ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary')}>
                  <Icon className="size-5" />
                </span>
                <span className="grid min-w-0 gap-0.5">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {sale.saleType === 'AUTOMATED' ? 'Compra automática' : 'En mostrador'}
                    {cancelled && (
                      <Badge variant="outline" className="border-destructive/30 text-destructive">
                        Cancelada
                      </Badge>
                    )}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{summarizeItems(sale)}</span>
                  <span className="text-xs text-muted-foreground">
                    {time.format(new Date(sale.dateTime))} · Ticket #{sale.folio}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <span className={cn('font-semibold tabular-nums', cancelled && 'text-muted-foreground line-through')}>
                    {formatMoney(sale.totalAmount)}
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </span>
              </motion.button>
            )
          })}
        </section>
      ))}

      {groups && loaded < total && limit < MAX && (
        <Button variant="outline" disabled={history.loading} onClick={() => setLimit(Math.min(limit + PAGE, MAX))}>
          Ver más compras ({total - loaded})
        </Button>
      )}

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="bottom" className="max-h-[90dvh] gap-0 rounded-t-3xl">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>Ticket #{selected.folio}</SheetTitle>
                <SheetDescription>
                  {selected.saleType === 'AUTOMATED'
                    ? 'Cobrado automáticamente al salir de la tienda.'
                    : 'Compra registrada en mostrador.'}
                  {selected.status === 'CANCELLED' && ' Esta compra fue cancelada y reembolsada.'}
                </SheetDescription>
              </SheetHeader>
              <div className="overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
                <TicketView sale={selected} className="mx-auto max-w-sm" />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

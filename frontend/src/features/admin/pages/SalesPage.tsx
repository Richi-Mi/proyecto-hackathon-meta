import { ChevronLeft, ChevronRight, Hash } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getErrorMessage } from '@/lib/api/client'
import type { SaleSummary } from '@/lib/api/types'
import { useApiQuery } from '@/lib/api/use-api-query'
import { formatDateTime, formatMoney } from '@/lib/format'
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, SALE_TYPE_LABEL } from '@/lib/sale-labels'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { cn } from '@/lib/utils'
import { fetchSales, type SaleQuery } from '../api'
import { periodRanges, PERIODS } from '../dashboard/periods'
import { SaleDetailSheet } from '../sales/SaleDetailSheet'

const PAGE_SIZE = 20
const ALL = 'all'

const PERIOD_OPTIONS = [...PERIODS.map((p) => ({ value: p.key, label: p.label })), { value: ALL, label: 'Todo' }]
const TYPE_OPTIONS = [{ value: ALL, label: 'Todos los tipos' }, ...Object.entries(SALE_TYPE_LABEL).map(([value, label]) => ({ value, label }))]
const STATUS_OPTIONS = [
  { value: ALL, label: 'Todos los estados' },
  { value: 'COMPLETED', label: 'Completadas' },
  { value: 'CANCELLED', label: 'Canceladas' },
]
const METHOD_OPTIONS = [
  { value: ALL, label: 'Todos los pagos' },
  ...Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => ({ value, label })),
]

function FilterSelect({ value, onChange, options, label }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; label: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-44" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const statusBadge = (sale: SaleSummary) => {
  if (sale.status === 'CANCELLED') return <Badge variant="outline" className="border-destructive/30 text-destructive">Cancelada</Badge>
  if (sale.paymentStatus === 'PAID') return <Badge variant="secondary">Pagada</Badge>
  return <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">{PAYMENT_STATUS_LABEL[sale.paymentStatus]}</Badge>
}

export function SalesPage() {
  const [period, setPeriod] = useState<string>('week')
  const [type, setType] = useState(ALL)
  const [status, setStatus] = useState(ALL)
  const [method, setMethod] = useState(ALL)
  const [folio, setFolio] = useState('')
  const [page, setPage] = useState(1)
  const [openSaleId, setOpenSaleId] = useState<string | null>(null)
  const debouncedFolio = useDebouncedValue(folio.trim(), 300)

  const query = useMemo<SaleQuery>(() => {
    // Buscar por folio ignora el periodo: el ticket puede ser de cualquier fecha
    const range = debouncedFolio || period === ALL ? undefined : periodRanges(PERIODS.find((p) => p.key === period)!).current
    return {
      page,
      limit: PAGE_SIZE,
      from: range?.from.toISOString(),
      to: range?.to.toISOString(),
      type: type === ALL ? undefined : (type as SaleQuery['type']),
      status: status === ALL ? undefined : (status as SaleQuery['status']),
      paymentMethod: method === ALL ? undefined : (method as SaleQuery['paymentMethod']),
      folio: /^\d+$/.test(debouncedFolio) ? Number(debouncedFolio) : undefined,
    }
  }, [page, period, type, status, method, debouncedFolio])

  const sales = useApiQuery((signal) => fetchSales(query, signal), [query])
  const total = sales.data?.meta.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const resetPage = (apply: (value: string) => void) => (value: string) => {
    apply(value)
    setPage(1)
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-36">
          <Hash className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={folio}
            inputMode="numeric"
            placeholder="Folio"
            aria-label="Buscar por folio"
            className="pl-9"
            onChange={(event) => resetPage(setFolio)(event.target.value.replace(/\D/g, ''))}
          />
        </div>
        <FilterSelect label="Periodo" value={period} onChange={resetPage(setPeriod)} options={PERIOD_OPTIONS} />
        <FilterSelect label="Tipo de venta" value={type} onChange={resetPage(setType)} options={TYPE_OPTIONS} />
        <FilterSelect label="Estado" value={status} onChange={resetPage(setStatus)} options={STATUS_OPTIONS} />
        <FilterSelect label="Método de pago" value={method} onChange={resetPage(setMethod)} options={METHOD_OPTIONS} />
      </div>

      {sales.error !== undefined ? (
        <div className="grid justify-items-center gap-3 rounded-xl border p-10 text-center">
          <p className="text-sm text-muted-foreground">{getErrorMessage(sales.error)}</p>
          <Button variant="outline" onClick={sales.reload}>
            Reintentar
          </Button>
        </div>
      ) : (
        <div className={cn('rounded-xl border transition-opacity', sales.loading && sales.data && 'opacity-60')}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Folio</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead className="text-right">Piezas</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!sales.data &&
                Array.from({ length: 8 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {sales.data?.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-28 text-center text-muted-foreground">
                    No hay ventas con estos filtros.
                  </TableCell>
                </TableRow>
              )}
              {sales.data?.data.map((sale) => (
                <TableRow
                  key={sale.id}
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={() => setOpenSaleId(sale.id)}
                  onKeyDown={(event) => event.key === 'Enter' && setOpenSaleId(sale.id)}
                >
                  <TableCell className="font-mono">#{sale.folio}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDateTime(sale.dateTime)}</TableCell>
                  <TableCell>{SALE_TYPE_LABEL[sale.saleType]}</TableCell>
                  <TableCell className="text-muted-foreground">{sale.customer?.name ?? '—'}</TableCell>
                  <TableCell>{PAYMENT_METHOD_LABEL[sale.paymentMethod]}</TableCell>
                  <TableCell className="text-right tabular-nums">{sale.itemCount}</TableCell>
                  <TableCell className={cn('text-right font-medium tabular-nums', sale.status === 'CANCELLED' && 'text-muted-foreground line-through')}>
                    {formatMoney(sale.totalAmount)}
                  </TableCell>
                  <TableCell>{statusBadge(sale)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          {total} venta{total === 1 ? '' : 's'}
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

      <SaleDetailSheet saleId={openSaleId} onClose={() => setOpenSaleId(null)} onChanged={sales.reload} />
    </div>
  )
}

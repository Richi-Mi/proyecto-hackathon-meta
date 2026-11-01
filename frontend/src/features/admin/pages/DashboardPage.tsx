import { AlertTriangle, ArrowRight, Boxes, DollarSign, Receipt, TrendingUp, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage } from '@/lib/api/client'
import { useApiQuery } from '@/lib/api/use-api-query'
import { formatCompactMoney, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  fetchInventorySummary,
  fetchReportSummary,
  fetchSalesTrend,
  fetchTopProducts,
  type TopProductMetric,
} from '../api'
import { KpiCard } from '../components/KpiCard'
import { SimulateVisitButton } from '../components/SimulateVisitButton'
import { percentChange, periodRanges, PERIODS, type PeriodKey } from '../dashboard/periods'

/** Botón de demo: en desarrollo o con VITE_STORE_SIMULATOR=true (el endpoint /dev no existe en producción) */
const storeSimulatorEnabled = import.meta.env.DEV || import.meta.env.VITE_STORE_SIMULATOR === 'true'

const trendConfig = {
  revenue: { label: 'Ingresos', color: 'var(--chart-1)' },
  netProfit: { label: 'Ganancia', color: 'var(--chart-2)' },
} satisfies ChartConfig

const METRICS: { value: TopProductMetric; label: string; chart: ChartConfig }[] = [
  { value: 'quantity', label: 'Piezas', chart: { quantity: { label: 'Piezas', color: 'var(--chart-3)' } } },
  { value: 'revenue', label: 'Ingresos', chart: { revenue: { label: 'Ingresos', color: 'var(--chart-1)' } } },
  { value: 'profit', label: 'Ganancia', chart: { netProfit: { label: 'Ganancia', color: 'var(--chart-2)' } } },
]
const METRIC_FIELD: Record<TopProductMetric, 'quantity' | 'revenue' | 'netProfit'> = {
  quantity: 'quantity',
  revenue: 'revenue',
  profit: 'netProfit',
}

const hourLabel = new Intl.DateTimeFormat('es-MX', { hour: 'numeric', hour12: false })
const dayLabel = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric' })
const fullLabel = new Intl.DateTimeFormat('es-MX', { dateStyle: 'full' })
const hourFullLabel = new Intl.DateTimeFormat('es-MX', { weekday: 'long', hour: 'numeric', minute: '2-digit' })

export function DashboardPage() {
  const [periodKey, setPeriodKey] = useState<PeriodKey>('week')
  const [metric, setMetric] = useState<TopProductMetric>('quantity')
  const period = PERIODS.find((p) => p.key === periodKey)!
  // Rangos estables durante el día (cambian solo al cambiar de periodo)
  const ranges = useMemo(() => periodRanges(period), [period])

  const summary = useApiQuery((signal) => fetchReportSummary(ranges.current, signal), [periodKey])
  const previous = useApiQuery((signal) => fetchReportSummary(ranges.previous, signal), [periodKey])
  const trend = useApiQuery((signal) => fetchSalesTrend(ranges.current, period.granularity, signal), [periodKey])
  const top = useApiQuery((signal) => fetchTopProducts(ranges.current, metric, 5, signal), [periodKey, metric])
  const inventory = useApiQuery(fetchInventorySummary, [])

  const current = summary.data
  const before = previous.data
  const vs = (now: number | undefined, then: number | undefined) => {
    if (now === undefined || then === undefined) return undefined
    const change = percentChange(now, then)
    if (change === null) return `Sin ventas ${period.previousLabel}`
    return (
      <span className={change >= 0 ? 'text-primary' : 'text-destructive'}>
        {change >= 0 ? '▲' : '▼'} {Math.abs(change * 100).toFixed(1)} % vs. {period.previousLabel}
      </span>
    )
  }
  const formatBucket = (iso: string) => (period.granularity === 'hour' ? `${hourLabel.format(new Date(iso))} h` : dayLabel.format(new Date(iso)))
  const formatBucketFull = (iso: string) =>
    period.granularity === 'hour' ? hourFullLabel.format(new Date(iso)) : fullLabel.format(new Date(iso))
  const metricConfig = METRICS.find((m) => m.value === metric)!
  const metricField = METRIC_FIELD[metric]
  const formatMetric = (value: number) => (metric === 'quantity' ? `${value} pzas` : formatMoney(value))
  const reportError = summary.error ?? trend.error ?? top.error

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Ventas automáticas y de mostrador · hora local de la tienda</p>
        <div className="flex flex-wrap items-center gap-2">
          {storeSimulatorEnabled && (
            <SimulateVisitButton
              onSimulated={() => {
                summary.reload()
                previous.reload()
                trend.reload()
                top.reload()
                inventory.reload()
              }}
            />
          )}
          <div className="inline-flex rounded-lg border bg-muted p-1" role="tablist" aria-label="Periodo">
            {PERIODS.map((option) => (
              <button
                key={option.key}
                type="button"
                role="tab"
                aria-selected={option.key === periodKey}
                onClick={() => setPeriodKey(option.key)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  option.key === periodKey ? 'bg-background shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {reportError !== undefined && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <span className="text-destructive">No se pudieron cargar los reportes: {getErrorMessage(reportError)}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              summary.reload()
              previous.reload()
              trend.reload()
              top.reload()
            }}
          >
            Reintentar
          </Button>
        </div>
      )}

      {current && current.pendingPayments > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="size-4 shrink-0" />
          {formatMoney(current.pendingPayments)} en ventas automáticas con cobro pendiente o fallido.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Ingresos"
          icon={DollarSign}
          loading={!current}
          value={current && formatMoney(current.revenue)}
          hint={
            current && (
              <span className="grid gap-0.5">
                {vs(current.revenue, before?.revenue)}
                <span>
                  Automáticas {formatMoney(current.byType.AUTOMATED.revenue)} · Mostrador {formatMoney(current.byType.MANUAL.revenue)}
                </span>
              </span>
            )
          }
        />
        <KpiCard
          label="Ganancia neta"
          icon={TrendingUp}
          loading={!current}
          value={current && formatMoney(current.netProfit)}
          hint={
            current && (
              <span className="grid gap-0.5">
                {vs(current.netProfit, before?.netProfit)}
                <span>Precio sin IVA − costo · IVA cobrado {formatMoney(current.taxCollected)}</span>
              </span>
            )
          }
        />
        <KpiCard
          label="Transacciones"
          icon={Receipt}
          loading={!current}
          value={current?.transactions}
          hint={current && vs(current.transactions, before?.transactions)}
        />
        <KpiCard
          label="Ticket promedio"
          icon={Wallet}
          loading={!current}
          value={current && formatMoney(current.averageTicket)}
          hint={current && vs(current.averageTicket, before?.averageTicket)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Tendencia de ventas</CardTitle>
            <CardDescription>
              Ingresos y ganancia {period.granularity === 'hour' ? 'por hora de hoy' : `por día · ${period.label}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!trend.data ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <ChartContainer config={trendConfig} className={cn('aspect-auto h-72 w-full', trend.loading && 'opacity-60')}>
                <AreaChart data={trend.data} margin={{ left: 8, right: 8 }}>
                  <defs>
                    {(['revenue', 'netProfit'] as const).map((key) => (
                      <linearGradient key={key} id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={`var(--color-${key})`} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={`var(--color-${key})`} stopOpacity={0.02} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="bucket"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={24}
                    tickFormatter={formatBucket}
                  />
                  <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={formatCompactMoney} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, payload) => {
                          const bucket = payload?.[0]?.payload?.bucket as string | undefined
                          return bucket ? formatBucketFull(bucket) : ''
                        }}
                        formatter={(value, name) => (
                          <span className="flex w-full justify-between gap-4">
                            <span className="text-muted-foreground">{trendConfig[name as keyof typeof trendConfig]?.label}</span>
                            <span className="font-medium tabular-nums">{formatMoney(Number(value))}</span>
                          </span>
                        )}
                      />
                    }
                  />
                  <Area dataKey="revenue" type="monotone" stroke="var(--color-revenue)" fill="url(#fill-revenue)" strokeWidth={2} />
                  <Area dataKey="netProfit" type="monotone" stroke="var(--color-netProfit)" fill="url(#fill-netProfit)" strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div className="grid gap-1">
              <CardTitle>Mayor rotación</CardTitle>
              <CardDescription>Top 5 · {period.label}</CardDescription>
            </div>
            <Select value={metric} onValueChange={(value) => setMetric(value as TopProductMetric)}>
              <SelectTrigger size="sm" className="w-32" aria-label="Ordenar por">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METRICS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {!top.data ? (
              <Skeleton className="h-72 w-full" />
            ) : top.data.length === 0 ? (
              <p className="grid h-72 place-items-center text-sm text-muted-foreground">Sin ventas en este periodo.</p>
            ) : (
              <ChartContainer config={metricConfig.chart} className={cn('aspect-auto h-72 w-full', top.loading && 'opacity-60')}>
                <BarChart data={top.data} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={124} fontSize={12} />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel formatter={(value, _, item) => `${item.payload.name}: ${formatMetric(Number(value))}`} />}
                  />
                  <Bar dataKey={metricField} fill={`var(--color-${metricField})`} radius={6} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3 space-y-0">
          <div className="grid gap-1">
            <CardTitle>Inventario</CardTitle>
            <CardDescription>Al momento</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/inventory">
              Ver inventario <ArrowRight />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Valor a precio de venta"
            icon={Wallet}
            loading={!inventory.data}
            value={inventory.data && formatMoney(inventory.data.totalRetailValue)}
          />
          <KpiCard
            label="Valor a costo"
            icon={Boxes}
            loading={!inventory.data}
            value={inventory.data && formatMoney(inventory.data.totalCostValue)}
          />
          <KpiCard
            label="Stock bajo"
            icon={AlertTriangle}
            tone="warning"
            loading={!inventory.data}
            value={inventory.data?.lowStockCount}
            hint={
              <Link to="/admin/inventory?stock=bajo" className="text-primary hover:underline">
                Ver productos
              </Link>
            }
          />
          <KpiCard
            label="Agotados"
            icon={AlertTriangle}
            tone="danger"
            loading={!inventory.data}
            value={inventory.data?.outOfStockCount}
          />
        </CardContent>
      </Card>
    </div>
  )
}

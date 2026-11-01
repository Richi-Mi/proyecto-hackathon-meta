import { AlertTriangle, ArrowRight, Boxes, DollarSign, Receipt, TrendingUp, Wallet } from 'lucide-react'
import { Link } from 'react-router'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { useApiQuery } from '@/lib/api/use-api-query'
import { formatCompactMoney, formatMoney } from '@/lib/format'
import { fetchInventorySummary } from '../api'
import { KpiCard } from '../components/KpiCard'

// Datos de ejemplo hasta implementar /reports/summary, /reports/sales-trend y /reports/top-products
const SAMPLE_TREND = [
  { day: 'Lun', revenue: 2180, profit: 610 },
  { day: 'Mar', revenue: 1940, profit: 540 },
  { day: 'Mié', revenue: 2460, profit: 702 },
  { day: 'Jue', revenue: 2310, profit: 655 },
  { day: 'Vie', revenue: 3120, profit: 905 },
  { day: 'Sáb', revenue: 3680, profit: 1080 },
  { day: 'Dom', revenue: 2890, profit: 830 },
]
const SAMPLE_TOP_PRODUCTS = [
  { name: 'Refresco 600 ml', units: 64 },
  { name: 'Leche entera 1 L', units: 51 },
  { name: 'Tortilla 1 kg', units: 47 },
  { name: 'Papas con sal 45 g', units: 38 },
  { name: 'Huevo 12 pzas', units: 29 },
]
const SAMPLE_TODAY = { revenue: 2890, transactions: 41, profit: 830 }
const weekRevenue = SAMPLE_TREND.reduce((sum, day) => sum + day.revenue, 0)

const trendConfig = {
  revenue: { label: 'Ingresos', color: 'var(--chart-1)' },
  profit: { label: 'Ganancia', color: 'var(--chart-2)' },
} satisfies ChartConfig
const topConfig = { units: { label: 'Piezas', color: 'var(--chart-3)' } } satisfies ChartConfig

export function DashboardPage() {
  const inventory = useApiQuery(fetchInventorySummary, [])

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Resumen del negocio</p>
        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
          Ventas: datos de ejemplo
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Ingresos de hoy" icon={DollarSign} value={formatMoney(SAMPLE_TODAY.revenue)} hint="+8.4 % vs. ayer" />
        <KpiCard label="Ingresos de la semana" icon={Wallet} value={formatMoney(weekRevenue)} hint="Lunes a domingo" />
        <KpiCard label="Ganancia neta (hoy)" icon={TrendingUp} value={formatMoney(SAMPLE_TODAY.profit)} hint="Precio sin IVA − costo" />
        <KpiCard label="Transacciones (hoy)" icon={Receipt} value={SAMPLE_TODAY.transactions} hint="Automáticas y de mostrador" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Tendencia de ventas</CardTitle>
            <CardDescription>Ingresos y ganancia de los últimos 7 días</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={trendConfig} className="aspect-auto h-72 w-full">
              <AreaChart data={SAMPLE_TREND} margin={{ left: 8, right: 8 }}>
                <defs>
                  {(['revenue', 'profit'] as const).map((key) => (
                    <linearGradient key={key} id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={`var(--color-${key})`} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={`var(--color-${key})`} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={formatCompactMoney} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatMoney(Number(value))} />} />
                <Area dataKey="revenue" type="monotone" stroke="var(--color-revenue)" fill="url(#fill-revenue)" strokeWidth={2} />
                <Area dataKey="profit" type="monotone" stroke="var(--color-profit)" fill="url(#fill-profit)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mayor rotación</CardTitle>
            <CardDescription>Piezas vendidas esta semana</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={topConfig} className="aspect-auto h-72 w-full">
              <BarChart data={SAMPLE_TOP_PRODUCTS} layout="vertical" margin={{ left: 0, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={120} fontSize={12} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Bar dataKey="units" fill="var(--color-units)" radius={6} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3 space-y-0">
          <div className="grid gap-1">
            <CardTitle>Inventario</CardTitle>
            <CardDescription>Datos en vivo</CardDescription>
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

import { ArrowDown, ArrowUp, ArrowUpDown, History, MoreHorizontal, PackagePlus, Pencil, SlidersHorizontal, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Product } from '@/lib/api/types'
import { formatMoney, formatRate } from '@/lib/format'
import { cn } from '@/lib/utils'

export type ProductAction = 'edit' | 'restock' | 'adjust' | 'movements' | 'delete'

export type SortField = 'name' | 'price' | 'stock'
export type SortValue = SortField | `-${SortField}`

const STATUS_LABEL: Record<Product['status'], { label: string; className: string }> = {
  ACTIVE: { label: 'Activo', className: 'bg-primary/10 text-primary' },
  INACTIVE: { label: 'Inactivo', className: 'bg-muted text-muted-foreground' },
  DISCONTINUED: { label: 'Descontinuado', className: 'bg-muted text-muted-foreground line-through' },
}

interface ProductTableProps {
  products: Product[] | undefined
  sort: SortValue
  onSortChange: (sort: SortValue) => void
  onAction: (action: ProductAction, product: Product) => void
  loading: boolean
}

export function ProductTable({ products, sort, onSortChange, onAction, loading }: ProductTableProps) {
  const sortHeader = (field: SortField, label: string, className?: string) => {
    const active = sort.replace('-', '') === field
    const descending = sort.startsWith('-')
    const Icon = !active ? ArrowUpDown : descending ? ArrowDown : ArrowUp
    return (
      <TableHead className={className} aria-sort={active ? (descending ? 'descending' : 'ascending') : 'none'}>
        <button
          type="button"
          onClick={() => onSortChange(active && !descending ? `-${field}` : field)}
          className={cn('inline-flex items-center gap-1 hover:text-foreground', active && 'text-foreground')}
        >
          {label}
          <Icon className="size-3.5" />
        </button>
      </TableHead>
    )
  }

  return (
    <div className={cn('rounded-xl border transition-opacity', loading && products && 'opacity-60')}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-36">SKU</TableHead>
            {sortHeader('name', 'Producto')}
            <TableHead>Categoría</TableHead>
            {sortHeader('price', 'Precio', 'text-right')}
            <TableHead className="text-right">Costo</TableHead>
            <TableHead className="text-right">IVA</TableHead>
            {sortHeader('stock', 'Stock', 'text-right')}
            <TableHead>Estado</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!products &&
            Array.from({ length: 8 }, (_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={9}>
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            ))}
          {products?.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="h-28 text-center text-muted-foreground">
                Ningún producto coincide con los filtros.
              </TableCell>
            </TableRow>
          )}
          {products?.map((product) => (
            <TableRow key={product.id}>
              <TableCell className="font-mono text-xs">{product.id}</TableCell>
              <TableCell>
                <div className="grid justify-items-start">
                  <button
                    type="button"
                    onClick={() => onAction('edit', product)}
                    className="text-left font-medium underline-offset-4 hover:underline"
                  >
                    {product.name}
                  </button>
                  {product.barcode && <span className="font-mono text-xs text-muted-foreground">{product.barcode}</span>}
                </div>
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: product.category.color }} />
                  {product.category.name}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(product.price)}</TableCell>
              <TableCell className="text-right text-muted-foreground tabular-nums">{formatMoney(product.purchaseCost)}</TableCell>
              <TableCell className="text-right text-muted-foreground tabular-nums">{formatRate(product.taxRate)}</TableCell>
              <TableCell className="text-right">
                <span className="inline-flex items-center justify-end gap-2">
                  {product.stock <= 0 ? (
                    <Badge variant="destructive">Agotado</Badge>
                  ) : (
                    product.isLowStock && (
                      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                        Bajo
                      </Badge>
                    )
                  )}
                  <span
                    className={cn(
                      'font-medium tabular-nums',
                      product.stock <= 0 ? 'text-destructive' : product.isLowStock && 'text-amber-600',
                    )}
                  >
                    {product.stock}
                  </span>
                </span>
              </TableCell>
              <TableCell>
                <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', STATUS_LABEL[product.status].className)}>
                  {STATUS_LABEL[product.status].label}
                </span>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Acciones para ${product.name}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onSelect={() => onAction('edit', product)}>
                      <Pencil /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onAction('restock', product)}>
                      <PackagePlus /> Entrada de mercancía
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onAction('adjust', product)}>
                      <SlidersHorizontal /> Ajustar stock
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onAction('movements', product)}>
                      <History /> Ver movimientos
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => onAction('delete', product)}>
                      <Trash2 /> Dar de baja
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

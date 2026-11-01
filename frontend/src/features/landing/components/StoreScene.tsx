import { cn } from '@/lib/utils'

/**
 * Escena de la tienda (SVG inline). El markup es el CUADRO FINAL de la historia:
 * `store-story.ts` coloca cada `data-scene` en su estado inicial y lo anima con el scroll.
 * Sin animación (reducir movimiento / sin JS) se ve el resumen completo.
 */

// Origen de transformaciones relativo a la caja del propio elemento SVG
const box = '[transform-box:fill-box]'

const PRODUCTS = [
  { x: 200, fill: 'fill-chart-1', picked: true },
  { x: 255, fill: 'fill-chart-3', picked: false },
  { x: 310, fill: 'fill-chart-2', picked: true },
  { x: 365, fill: 'fill-chart-5', picked: false, returned: true },
  { x: 420, fill: 'fill-sky-200', picked: true },
  { x: 475, fill: 'fill-chart-4', picked: false },
]
const PICKED_CENTERS = PRODUCTS.filter((p) => p.picked).map((p) => p.x + 20)

const RECEIPT_LINES = [
  ['Refresco 600 ml', '20.00'],
  ['Papas 45 g', '19.00'],
  ['Leche 1 L', '28.50'],
]

export function StoreScene({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 800 520"
      role="img"
      aria-label="Ilustración: el cliente entra con su QR, toma productos vistos por las cámaras, sale y el cobro llega al panel del dueño"
      className={cn('h-auto w-full select-none', className)}
    >
      {/* ── Tienda ───────────────────────────────────────────── */}
      <rect x="120" y="40" width="470" height="340" rx="24" className="fill-card stroke-border" strokeWidth="2" />
      <rect x="180" y="80" width="360" height="100" rx="12" className="fill-muted" />
      <rect x="180" y="164" width="360" height="8" rx="4" className="fill-border" />

      {PRODUCTS.map((product, index) => (
        <g key={product.x}>
          <rect x={product.x} y="102" width="40" height="60" rx="7" className={product.fill} />
          <rect x={product.x + 8} y="118" width="24" height="10" rx="3" className="fill-white/70" />
          {product.picked && (
            <g data-scene="tag-picked" className={cn(box, 'origin-center')}>
              <circle cx={product.x + 38} cy="100" r="10" className="fill-primary" />
              <path
                d={`M${product.x + 33.5} 100.5l3 3 6-6.5`}
                fill="none"
                className="stroke-white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          )}
          {product.returned && (
            <g data-scene="tag-returned" opacity="0" className={cn(box, 'origin-center')} data-index={index}>
              <circle cx={product.x + 38} cy="100" r="10" className="fill-amber-400" />
              <path d={`M${product.x + 33} 100h10`} className="stroke-white" strokeWidth="2.5" strokeLinecap="round" />
            </g>
          )}
        </g>
      ))}

      {/* Cámaras y sus campos de visión */}
      {PICKED_CENTERS.map((x) => (
        <g key={x}>
          <polygon data-scene="cone" points={`${x},62 ${x - 34},172 ${x + 34},172`} className="fill-primary" opacity="0" />
          <rect x={x - 12} y="44" width="24" height="16" rx="4" className="fill-foreground" />
          <circle cx={x} cy="56" r="4" className="fill-red-400" />
        </g>
      ))}

      {/* Entrada: escáner, haz y torniquete */}
      <rect x="20" y="246" width="44" height="78" rx="9" data-scene="phone" className="fill-foreground" />
      <g data-scene="qr" className={cn(box, 'origin-center')}>
        <rect x="27" y="262" width="30" height="30" rx="3" className="fill-white" />
        {[0, 1, 2].flatMap((row) =>
          [0, 1, 2].map((col) =>
            (row + col) % 2 === 0 || (row === 1 && col === 1) ? (
              <rect key={`${row}-${col}`} x={30 + col * 9} y={265 + row * 9} width="7" height="7" className="fill-foreground" />
            ) : null,
          ),
        )}
      </g>
      <rect x="104" y="248" width="16" height="24" rx="4" className="fill-foreground" />
      <rect data-scene="scan-beam" x="64" y="257" width="40" height="5" rx="2.5" opacity="0" className={cn(box, 'origin-right fill-primary')} />
      <rect data-scene="gate-bar" x="120" y="322" width="46" height="7" rx="3.5" className={cn(box, 'origin-left fill-amber-500')} />

      {/* Salida */}
      <rect data-scene="exit-door" x="583" y="286" width="12" height="80" rx="4" className={cn(box, 'fill-primary/80')} />

      {/* Cliente (posición final: ya salió) */}
      <g data-scene="shopper">
        <g transform="translate(650 334)">
          <circle cx="0" cy="-44" r="14" className="fill-amber-300" />
          <rect x="-16" y="-28" width="32" height="46" rx="12" className="fill-primary" />
          <rect x="14" y="-6" width="20" height="16" rx="4" className="fill-amber-500" />
        </g>
      </g>

      {/* ── Backend: webhook → cobro → ticket ─────────────────── */}
      <path
        data-scene="webhook"
        d="M612 318 C 650 250, 596 150, 640 84"
        fill="none"
        className="stroke-primary"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle data-scene="pulse" cx="0" cy="0" r="7" opacity="0" className="fill-primary" />

      <g>
        <rect x="640" y="40" width="130" height="70" rx="14" className="fill-foreground" />
        <circle cx="662" cy="62" r="5" className="fill-primary" />
        <rect x="674" y="58" width="76" height="8" rx="4" className="fill-white/30" />
        <rect x="660" y="80" width="90" height="8" rx="4" className="fill-white/20" />
      </g>

      <g data-scene="receipt" className={cn(box, 'origin-top')}>
        <rect x="652" y="116" width="106" height="128" rx="6" className="fill-white stroke-border" strokeWidth="1.5" />
        {RECEIPT_LINES.map(([name, price], i) => (
          <g key={name} className="text-[9px]">
            <text x="660" y={136 + i * 18} className="fill-muted-foreground">
              {name}
            </text>
            <text x="750" y={136 + i * 18} textAnchor="end" className="fill-foreground">
              {price}
            </text>
          </g>
        ))}
        <line x1="660" y1="196" x2="750" y2="196" className="stroke-border" strokeDasharray="3 3" />
        <text x="660" y="216" className="fill-foreground text-[10px] font-semibold">
          Total
        </text>
        <text data-scene="total" x="750" y="216" textAnchor="end" className="fill-primary text-[11px] font-bold">
          $67.50
        </text>
        <text x="705" y="234" textAnchor="middle" className="fill-muted-foreground text-[7px]">
          Cobrado automáticamente
        </text>
      </g>

      {/* ── Panel del dueño ───────────────────────────────────── */}
      <g>
        <rect x="400" y="400" width="380" height="110" rx="16" className="fill-card stroke-border" strokeWidth="2" />
        <text x="420" y="424" className="fill-foreground text-[11px] font-semibold">
          Panel del dueño
        </text>
        {[
          { x: 424, height: 36, fill: 'fill-chart-1' },
          { x: 452, height: 26, fill: 'fill-chart-2' },
          { x: 480, height: 44, fill: 'fill-sky-300' },
        ].map((bar) => (
          <rect
            key={bar.x}
            data-scene="stock-bar"
            x={bar.x}
            y={496 - bar.height}
            width="18"
            height={bar.height}
            rx="4"
            className={cn(box, 'origin-bottom', bar.fill)}
          />
        ))}
        <text x="420" y="506" className="fill-muted-foreground text-[8px]">
          Inventario
        </text>
        <path
          data-scene="sales-line"
          d="M540 490 L 575 478 L 610 482 L 645 462 L 680 466 L 715 444 L 760 430"
          fill="none"
          className="stroke-primary"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <g data-scene="sale-badge" className={cn(box, 'origin-center')}>
          <rect x="596" y="410" width="168" height="22" rx="11" className="fill-primary/10" />
          <text x="680" y="425" textAnchor="middle" className="fill-primary text-[10px] font-semibold">
            +$67.50 · venta AUTOMATED
          </text>
        </g>
      </g>
    </svg>
  )
}

import { createTimeline, onScroll, stagger, svg, utils, type Timeline } from 'animejs'

const scene = (name: string) => `[data-scene="${name}"]`
const step = (index: number) => `[data-story-step="${index}"]`

// Posiciones X del cliente relativas a su lugar final (afuera, junto a la salida)
const SHOPPER = { entrance: -560, insideGate: -460, shelves: -280, exit: 0 }
const SALE_TOTAL = 67.5

/** Línea de tiempo de 4 pasos sincronizada con el scroll de la sección (la sección mide 400vh y su contenido es sticky). */
export function buildStoreStory(root: HTMLElement) {
  const totalLabel = root.querySelector<SVGTextElement>(scene('total'))
  const progress = root.querySelector<HTMLElement>('[data-story-progress]')
  const counter = { value: 0 }
  const renderTotal = () => {
    if (totalLabel) totalLabel.textContent = `$${counter.value.toFixed(2)}`
  }

  const webhook = svg.createDrawable(scene('webhook'))
  const salesLine = svg.createDrawable(scene('sales-line'))

  // ── Estado inicial (el markup trae el cuadro final) ──────────────
  utils.set(scene('phone'), { opacity: 0, translateY: 24 })
  utils.set(scene('qr'), { opacity: 0 })
  utils.set(scene('shopper'), { translateX: SHOPPER.entrance })
  utils.set(scene('tag-picked'), { scale: 0 })
  utils.set(scene('receipt'), { scaleY: 0 })
  utils.set(scene('stock-bar'), { scaleY: 1.4 })
  utils.set(scene('sale-badge'), { opacity: 0, scale: 0.8 })
  utils.set(webhook, { draw: '0 0' })
  utils.set(salesLine, { draw: '0 0.55' })
  utils.set('[data-story-step]:not([data-story-step="0"])', { opacity: 0, translateY: 16 })
  if (progress) utils.set(progress, { scaleX: 0 })
  counter.value = 0
  renderTotal()

  const timeline: Timeline = createTimeline({
    autoplay: onScroll({
      target: root,
      enter: { target: 'top', container: 'top' },
      leave: { target: 'bottom', container: 'bottom' },
      sync: 0.25,
    }),
    defaults: { ease: 'inOutQuad', duration: 400 },
  })

  const showStep = (from: number, to: number, at: number) =>
    timeline
      .add(step(from), { opacity: [1, 0], translateY: [0, -16], duration: 180 }, at)
      .add(step(to), { opacity: [0, 1], translateY: [16, 0], duration: 220 }, at + 120)

  // 1 · Entrada con QR
  timeline
    .label('entrada', 0)
    .add(scene('phone'), { opacity: [0, 1], translateY: [24, 0] }, 0)
    .add(scene('qr'), { opacity: [0, 1], scale: [0.85, 1.1, 1] }, 200)
    .add(scene('scan-beam'), { opacity: [0, 1, 0], scaleX: [0.2, 1, 1] }, 450)
    .add(scene('gate-bar'), { rotate: [0, -75] }, 650)
    .add(scene('shopper'), { translateX: [SHOPPER.entrance, SHOPPER.insideGate] }, 700)
    .add(scene('gate-bar'), { rotate: [-75, 0], duration: 250 }, 1050)

  // 2 · Compra vista por cámaras
  showStep(0, 1, 1200)
  timeline
    .label('compra', 1200)
    .add(scene('shopper'), { translateX: [SHOPPER.insideGate, SHOPPER.shelves] }, 1200)
    .add(scene('cone'), { opacity: [0, 0.3], delay: stagger(100) }, 1450)
    .add(scene('tag-picked'), { scale: [0, 1], ease: 'outBack', delay: stagger(140) }, 1600)
    .add(scene('tag-returned'), { opacity: [0, 1, 1, 0], scale: [0, 1, 1, 0.6], duration: 700 }, 1650)
    .add(scene('cone'), { opacity: [0.3, 0], delay: stagger(60) }, 2150)

  // 3 · Salida, webhook y cobro automático
  showStep(1, 2, 2400)
  timeline
    .label('salida', 2400)
    .add(scene('shopper'), { translateX: [SHOPPER.shelves, SHOPPER.exit], duration: 500 }, 2400)
    .add(scene('exit-door'), { translateY: [0, -56, 0], duration: 600 }, 2500)
    .add(webhook, { draw: ['0 0', '0 1'], duration: 450 }, 2850)
    .add(
      scene('pulse'),
      { ...svg.createMotionPath(scene('webhook')), opacity: [0, 1, 1, 0], duration: 450, ease: 'linear' },
      2850,
    )
    .add(scene('receipt'), { scaleY: [0, 1], ease: 'outQuad' }, 3250)
    .add(counter, { value: [0, SALE_TOTAL], onUpdate: renderTotal, duration: 450 }, 3300)

  // 4 · Panel del dueño
  showStep(2, 3, 3800)
  timeline
    .label('dueno', 3800)
    .add(scene('stock-bar'), { scaleY: [1.4, 1], delay: stagger(90) }, 3850)
    .add(salesLine, { draw: ['0 0.55', '0 1'], duration: 500 }, 4000)
    .add(scene('sale-badge'), { opacity: [0, 1], scale: [0.8, 1], ease: 'outBack' }, 4300)
    // margen final para que el último cuadro se aprecie antes de soltar el sticky
    .add({ duration: 300 }, 4700)

  if (progress) timeline.add(progress, { scaleX: [0, 1], duration: 5000, ease: 'linear' }, 0)
}

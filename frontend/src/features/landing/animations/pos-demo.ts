import { createTimeline, onScroll, utils } from 'animejs'

const pos = (name: string) => `[data-pos="${name}"]`
const LINES = 3

/** Venta en mostrador en loop: el láser lee 3 productos, el ticket se llena y se cobra con tarjeta. Solo corre en pantalla. */
export function buildPosDemo(root: HTMLElement) {
  const reset = () => {
    utils.set('[data-pos^="line-"]', { opacity: 0, translateX: -14 })
    utils.set(pos('total'), { opacity: 0 })
    utils.set('[data-pos^="pay-"]', { opacity: 0.45, scale: 1 })
    utils.set(pos('done'), { opacity: 0, scale: 0.6 })
    utils.set(pos('laser'), { opacity: 0 })
  }
  reset()

  const timeline = createTimeline({
    loop: true,
    loopDelay: 900,
    autoplay: onScroll({ target: root }),
    defaults: { ease: 'outQuad', duration: 260 },
    onLoop: reset,
  })

  for (let i = 0; i < LINES; i++) {
    const at = i * 700
    timeline
      .add(pos('product'), { translateY: [6, 0], opacity: [0.6, 1], duration: 200 }, at)
      .add(pos('laser'), { opacity: [0, 1, 1, 0], translateY: [-26, 26], duration: 420, ease: 'inOutSine' }, at + 120)
      .add(pos(`line-${i}`), { opacity: [0, 1], translateX: [-14, 0] }, at + 480)
  }

  timeline
    .add(pos('total'), { opacity: [0, 1] }, LINES * 700)
    .add(pos('pay-1'), { opacity: [0.45, 1], scale: [1, 1.08, 1], duration: 420 }, LINES * 700 + 300)
    .add(pos('done'), { opacity: [0, 1], scale: [0.6, 1], ease: 'outBack', duration: 380 }, LINES * 700 + 700)
}

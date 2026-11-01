import { animate, splitText, stagger, svg } from 'animejs'

/** Entrada del hero: titular palabra por palabra, logo trazado y productos flotando. */
export function buildHero(root: HTMLElement) {
  const title = root.querySelector<HTMLElement>('[data-hero="title"]')
  const splitter = title ? splitText(title, { words: true }) : null

  if (splitter) {
    animate(splitter.words, {
      opacity: [0, 1],
      translateY: ['0.5em', '0em'],
      delay: stagger(70),
      duration: 650,
      ease: 'outExpo',
    })
  }
  animate('[data-hero="lead"], [data-hero="cta"]', {
    opacity: [0, 1],
    translateY: [12, 0],
    delay: stagger(120, { start: 350 }),
    duration: 600,
    ease: 'outQuad',
  })
  animate(svg.createDrawable('[data-hero="logo-stroke"]'), {
    draw: ['0 0', '0 1'],
    delay: stagger(180, { start: 200 }),
    duration: 1100,
    ease: 'inOutQuad',
  })
  animate('[data-hero="logo-dot"]', { scale: [0, 1], delay: 1100, duration: 500, ease: 'outBack' })
  animate('[data-hero="chip"]', {
    opacity: [0, 1],
    scale: [0.8, 1],
    delay: stagger(150, { start: 700 }),
    duration: 500,
    ease: 'outBack',
  })
  animate('[data-hero="chip-float"]', {
    translateY: [-6, 6],
    delay: stagger(400),
    duration: 2400,
    alternate: true,
    loop: true,
    ease: 'inOutSine',
  })

  return () => splitter?.revert()
}

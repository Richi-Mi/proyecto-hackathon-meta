/**
 * Generador mínimo de comandos ESC/POS (impresoras térmicas de 58 y 80 mm).
 * El texto se translitera a ASCII: las páginas de códigos con acentos varían entre fabricantes
 * y un carácter fuera de la tabla imprime basura.
 */

const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

/** Caracteres por renglón con la fuente A */
export const COLUMNS_BY_WIDTH = { 58: 32, 80: 48 } as const

export type Align = 'left' | 'center' | 'right'

const ALIGN_CODE: Record<Align, number> = { left: 0, center: 1, right: 2 }

/** "Doña Ñandú ¡Gracias!" → "Dona Nandu !Gracias!" */
export function toPrintableAscii(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¡]/g, '!')
    .replace(/[¿]/g, '?')
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[  ]/g, ' ') // espacios no separables de Intl (fechas, moneda)
    .replace(/[^\x20-\x7e\n]/g, '?')
}

/** Corta el texto en renglones de `width` columnas, respetando palabras cuando se puede. */
export function wrap(text: string, width: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    // Si cabe se respeta tal cual (columnas alineadas con espacios)
    if (paragraph.length <= width) {
      lines.push(paragraph)
      continue
    }
    let line = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      for (let chunk = word; chunk.length > 0; chunk = chunk.slice(width)) {
        const piece = chunk.slice(0, width)
        if (!line) line = piece
        else if (line.length + 1 + piece.length <= width) line += ` ${piece}`
        else {
          lines.push(line)
          line = piece
        }
      }
    }
    lines.push(line)
  }
  return lines
}

/** Renglón con texto a la izquierda y a la derecha: "Total            $20.00" */
export function columns(left: string, right: string, width: number) {
  const start = left.slice(0, Math.max(0, width - right.length - 1))
  return `${start}${' '.repeat(Math.max(1, width - start.length - right.length))}${right}`
}

export class EscPosBuilder {
  private readonly bytes: number[] = []
  readonly columns: number

  constructor(columns: number) {
    this.columns = columns
    this.raw(ESC, 0x40) // inicializa la impresora
  }

  raw(...bytes: number[]) {
    this.bytes.push(...bytes)
    return this
  }

  align(align: Align) {
    return this.raw(ESC, 0x61, ALIGN_CODE[align])
  }

  bold(on: boolean) {
    return this.raw(ESC, 0x45, on ? 1 : 0)
  }

  /** Doble alto y ancho (encabezados) */
  large(on: boolean) {
    return this.raw(GS, 0x21, on ? 0x11 : 0x00)
  }

  /** Imprime el texto; corta en renglones según el ancho (la mitad si `large`). */
  line(text = '', { large = false } = {}) {
    const width = large ? Math.floor(this.columns / 2) : this.columns
    for (const row of wrap(toPrintableAscii(text), width)) {
      for (const char of row) this.bytes.push(char.charCodeAt(0))
      this.bytes.push(LF)
    }
    return this
  }

  divider(char = '-') {
    return this.line(char.repeat(this.columns))
  }

  feed(lines: number) {
    return this.raw(ESC, 0x64, lines)
  }

  /** Avanza el papel y hace corte parcial (las impresoras sin cortador lo ignoran). */
  cut() {
    return this.raw(GS, 0x56, 66, 3)
  }

  build() {
    return Uint8Array.from(this.bytes)
  }
}

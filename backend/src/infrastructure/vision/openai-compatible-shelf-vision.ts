import type {
  CatalogEntry,
  ProductIdentification,
  ShelfAnalysis,
  ShelfVisionAnalyzer,
} from '../../application/ports/shelf-vision'
import { ShelfAction } from '../../domain/enums'
import type { ShelfEventFrames, ShelfImage } from '../../domain/models/shelf-event'

export interface OpenAiCompatibleVisionConfig {
  /** p. ej. https://api.meta.ai/v1 (Muse Spark) · https://api.groq.com/openai/v1 · https://openrouter.ai/api/v1 */
  baseUrl: string
  apiKey: string
  model: string
  timeoutMs: number
  /** Envía `response_format: json_object`; desactívalo si el proveedor lo rechaza con imágenes */
  jsonMode: boolean
}

const SYSTEM_PROMPT = `Eres el sistema de visión de ShelfSight, un inventario automático para tiendas de abarrotes en México.
Recibes DOS fotos de la MISMA repisa tomadas con una cámara fija: la primera es ANTES y la segunda es DESPUÉS de que una persona interactuó con ella.
Tu trabajo: decir qué producto del catálogo cambió y cuántas piezas.

Reglas:
- "REMOVED": en DESPUÉS hay MENOS piezas de un producto (alguien lo tomó).
- "ADDED": en DESPUÉS hay MÁS piezas (alguien resurtió).
- "MOVED": las mismas piezas solo cambiaron de lugar.
- "NONE": no cambió ningún producto (solo pasó una mano, cambió la luz, etc.).
- Ignora manos, personas, sombras y reflejos; compara solo los productos.
- "productId" DEBE ser exactamente uno de los "id" del catálogo, o null si el producto no está en el catálogo o no lo distingues.
- Si cambiaron varios productos distintos, reporta el que más cambió y baja "confidence" a 0.5 o menos.
- "confidence" va de 0 a 1: qué tan seguro estás del producto Y de la cantidad. Sé honesto; si dudas, usa menos de 0.7.
- "reason": una frase corta en español que explique lo que viste.

Responde SOLO con un objeto JSON, sin texto extra:
{"action":"REMOVED|ADDED|MOVED|NONE","productId":"<id del catálogo o null>","quantity":<entero >= 0>,"confidence":<0-1>,"reason":"<frase>"}`

const IDENTIFY_PROMPT = `Eres el lector de productos de la caja de una tienda de abarrotes en México (ShelfSight).
Recibes UNA foto de un producto que alguien acerca a la cámara, en lugar de pasarlo por el lector de código de barras.
Di cuál producto del catálogo es, fijándote en la marca, el sabor, la presentación y el tamaño (600 ml no es 1 L).
- "productId" DEBE ser exactamente uno de los "id" del catálogo, o null si no está en el catálogo o no se distingue.
- "confidence" de 0 a 1; si dudas entre dos presentaciones, usa menos de 0.6.
- "reason": una frase corta en español.
Responde SOLO con un objeto JSON: {"productId":"<id o null>","confidence":<0-1>,"reason":"<frase>"}`

const ACTIONS = new Set<string>(Object.values(ShelfAction))

export class OpenAiCompatibleShelfVision implements ShelfVisionAnalyzer {
  readonly enabled = true
  readonly model: string

  constructor(private readonly config: OpenAiCompatibleVisionConfig) {
    this.model = config.model
  }

  async analyze(frames: ShelfEventFrames, catalog: CatalogEntry[]): Promise<ShelfAnalysis> {
    const content = await this.complete(SYSTEM_PROMPT, [
      { type: 'text', text: `Catálogo de la tienda (JSON):\n${JSON.stringify(catalog)}` },
      { type: 'text', text: 'Foto ANTES:' },
      { type: 'image_url', image_url: { url: toDataUrl(frames.before) } },
      { type: 'text', text: 'Foto DESPUÉS:' },
      { type: 'image_url', image_url: { url: toDataUrl(frames.after) } },
    ])
    return parseAnalysis(content)
  }

  async identify(image: ShelfImage, catalog: CatalogEntry[]): Promise<ProductIdentification> {
    const content = await this.complete(IDENTIFY_PROMPT, [
      { type: 'text', text: `Catálogo de la tienda (JSON):\n${JSON.stringify(catalog)}` },
      { type: 'image_url', image_url: { url: toDataUrl(image) } },
    ])
    const raw = extractJson(content)
    return {
      productId: cleanId(raw.productId),
      confidence: Number(raw.confidence ?? 0) || 0,
      reason: typeof raw.reason === 'string' ? raw.reason : '',
    }
  }

  private async complete(system: string, userContent: unknown[]): Promise<string> {
    const body = {
      model: this.config.model,
      temperature: 0,
      // Muse Spark razona antes de contestar y esos tokens cuentan contra el límite
      max_tokens: 4096,
      ...(this.config.jsonMode && { response_format: { type: 'json_object' } }),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
    }

    const response = await fetch(`${this.config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.config.apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    })
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 300)
      throw new Error(`HTTP ${response.status} del proveedor de visión: ${detail}`)
    }
    const payload = (await response.json()) as { choices?: { finish_reason?: string; message?: { content?: string | null } }[] }
    const choice = payload.choices?.[0]
    const content = choice?.message?.content
    if (!content) throw new Error(`El modelo no devolvió contenido (finish_reason: ${choice?.finish_reason ?? 'desconocido'})`)
    return content
  }
}

/** Sin llave configurada: los eventos se guardan y quedan en revisión manual. */
export class DisabledShelfVision implements ShelfVisionAnalyzer {
  readonly enabled = false
  readonly model = null

  analyze(): Promise<ShelfAnalysis> {
    return Promise.reject(new Error('Visión no configurada'))
  }

  identify(): Promise<ProductIdentification> {
    return Promise.reject(new Error('Visión no configurada'))
  }
}

const toDataUrl = (image: ShelfImage) => `data:${image.mimeType};base64,${Buffer.from(image.data).toString('base64')}`

/** Acepta el JSON aunque venga rodeado de texto o de un bloque ```json. */
function extractJson(content: string): Record<string, unknown> {
  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error(`Respuesta sin JSON: ${content.slice(0, 200)}`)
  try {
    return JSON.parse(content.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    throw new Error(`JSON inválido del modelo: ${content.slice(0, 200)}`)
  }
}

const cleanId = (value: unknown) =>
  typeof value === 'string' && value.trim() && value.trim().toLowerCase() !== 'null' ? value.trim() : null

export function parseAnalysis(content: string): ShelfAnalysis {
  const raw = extractJson(content)
  const action = String(raw.action ?? '').toUpperCase()
  return {
    action: ACTIONS.has(action) ? (action as ShelfAction) : ShelfAction.NONE,
    productId: cleanId(raw.productId),
    quantity: Number(raw.quantity ?? 0) || 0,
    confidence: Number(raw.confidence ?? 0) || 0,
    reason: typeof raw.reason === 'string' ? raw.reason : '',
  }
}

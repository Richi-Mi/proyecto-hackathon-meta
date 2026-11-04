import type { ShelfAction } from '../../domain/enums'
import type { ShelfEventFrames, ShelfImage } from '../../domain/models/shelf-event'

export interface CatalogEntry {
  id: string
  name: string
  category: string
}

export interface ProductIdentification {
  productId: string | null
  confidence: number
  reason: string
}

export interface ShelfAnalysis {
  action: ShelfAction
  /** SKU del catálogo; null si no lo reconoce */
  productId: string | null
  quantity: number
  /** 0–1 */
  confidence: number
  reason: string
}

/**
 * Modelo de visión que compara la foto de antes y la de después de una interacción con la repisa.
 * Muse Spark en Meta Model API (compatible con OpenAI); Llama Vision en Groq/OpenRouter también sirve cambiando la configuración.
 */
export interface ShelfVisionAnalyzer {
  readonly enabled: boolean
  /** Identificador del modelo, para auditoría */
  readonly model: string | null
  analyze(frames: ShelfEventFrames, catalog: CatalogEntry[]): Promise<ShelfAnalysis>
  /** Una sola foto de un producto (caja / POS): ¿cuál del catálogo es? */
  identify(image: ShelfImage, catalog: CatalogEntry[]): Promise<ProductIdentification>
}

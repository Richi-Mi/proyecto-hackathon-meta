import { Type, type Static } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'

const EnvSchema = Type.Object({
  NODE_ENV: Type.Union([Type.Literal('development'), Type.Literal('test'), Type.Literal('production')], {
    default: 'development',
  }),
  PORT: Type.Integer({ minimum: 1, maximum: 65535, default: 3000 }),
  DATABASE_URL: Type.String({ minLength: 1 }),
  DB_LOGGING: Type.Boolean({ default: false }),

  JWT_SECRET: Type.String({ minLength: 32 }),
  JWT_EXPIRES_IN_SECONDS: Type.Integer({ minimum: 60, default: 8 * 60 * 60 }),

  /** Secreto propio del QR de entrada (distinto al de sesiones) */
  ENTRY_PASS_SECRET: Type.String({ minLength: 32 }),
  ENTRY_PASS_TTL_SECONDS: Type.Integer({ minimum: 15, maximum: 600, default: 60 }),

  /** Llaves de los dispositivos de la tienda (escáner de entrada), separadas por coma, para `X-Device-Key` */
  STORE_DEVICE_KEYS: Type.String({ minLength: 16 }),
  /** Secreto HMAC-SHA256 con el que el sistema de cámaras firma el webhook de salida */
  WEBHOOK_SECRET: Type.String({ minLength: 32 }),
  /** Pasarela simulada: probabilidad (0–1) de rechazar un cobro, para probar adeudos */
  MOCK_PAYMENT_FAILURE_RATE: Type.Number({ minimum: 0, maximum: 1, default: 0 }),
  /** Monta `/dev/simulate-visit` también en producción (demo). Fuera de producción siempre está montado. */
  ENABLE_STORE_SIMULATOR: Type.Boolean({ default: false }),
  /** Cliente que usa el simulador de visitas (el mismo que crea el seed) */
  SEED_CUSTOMER_EMAIL: Type.String({ default: 'cliente@smart-abarrotes.mx' }),

  /**
   * ShelfSight · modelo de visión por una API compatible con OpenAI (`/chat/completions` con imágenes).
   * Por defecto Muse Spark en Meta Model API; también sirve Llama Vision en Groq u OpenRouter cambiando estas variables.
   * Sin `VISION_API_KEY`, los eventos de la cámara se guardan y quedan en revisión manual.
   */
  VISION_API_URL: Type.String({ default: 'https://api.meta.ai/v1' }),
  VISION_API_KEY: Type.String({ default: '' }),
  VISION_MODEL: Type.String({ default: 'muse-spark-1.3' }),
  VISION_TIMEOUT_MS: Type.Integer({ minimum: 1000, maximum: 120_000, default: 30_000 }),
  VISION_JSON_MODE: Type.Boolean({ default: true }),
  /** Confianza mínima (0–1) para aplicar un evento de repisa sin revisión */
  SHELF_AUTO_APPLY_CONFIDENCE: Type.Number({ minimum: 0, maximum: 1, default: 0.75 }),
  /** Más piezas que esto en un solo evento → revisión */
  SHELF_MAX_AUTO_QUANTITY: Type.Integer({ minimum: 1, maximum: 999, default: 6 }),

  /** Zona IANA de la tienda: los reportes agrupan por día/semana/mes en hora local */
  STORE_TIMEZONE: Type.String({ default: 'America/Mexico_City' }),

  /** Carpeta del build del frontend (`frontend/dist`). Vacía = el servidor solo expone la API. */
  FRONTEND_DIST: Type.String({ default: '' }),

  /** Orígenes permitidos separados por coma */
  CORS_ORIGINS: Type.String({ default: 'http://localhost:5173' }),

  OTEL_ENABLED: Type.Boolean({ default: false }),
  OTEL_SERVICE_NAME: Type.String({ default: 'smart-abarrotes-api' }),
  OTEL_EXPORTER_OTLP_ENDPOINT: Type.String({ default: 'http://localhost:4318' }),
})

export type Env = Static<typeof EnvSchema>

function loadEnv(): Env {
  const raw = Object.fromEntries(Object.keys(EnvSchema.properties).map((key) => [key, process.env[key]]))
  const value = Value.Default(EnvSchema, Value.Convert(EnvSchema, raw))

  if (!Value.Check(EnvSchema, value)) {
    const problems = [...Value.Errors(EnvSchema, value)].map((e) => `  ${e.path}: ${e.message}`)
    throw new Error(`Variables de entorno inválidas:\n${problems.join('\n')}`)
  }
  try {
    new Intl.DateTimeFormat('es-MX', { timeZone: value.STORE_TIMEZONE })
  } catch {
    throw new Error(`STORE_TIMEZONE inválida: "${value.STORE_TIMEZONE}" (usa una zona IANA, p. ej. America/Mexico_City)`)
  }
  // Se reporta cuántas llaves se leyeron y cuáles son cortas, nunca su contenido
  const deviceKeys = parseList(value.STORE_DEVICE_KEYS)
  const shortKeys = deviceKeys.flatMap((key, i) => (key.length < 16 ? [`la #${i + 1} tiene ${key.length}`] : []))
  if (deviceKeys.length === 0 || shortKeys.length > 0) {
    throw new Error(
      `STORE_DEVICE_KEYS: se leyeron ${deviceKeys.length} llave(s) separadas por coma; ${shortKeys.join(', ') || 'ninguna es válida'} ` +
        '(cada llave necesita al menos 16 caracteres; usa una sola sin comas, p. ej. `openssl rand -hex 24`)',
    )
  }
  return value
}

/** Lista separada por comas, sin espacios ni elementos vacíos */
export const parseList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

export const env = loadEnv()

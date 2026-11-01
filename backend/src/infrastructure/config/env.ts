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
  return value
}

export const env = loadEnv()

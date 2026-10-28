import { Type, type Static } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'

const EnvSchema = Type.Object({
  NODE_ENV: Type.Union([Type.Literal('development'), Type.Literal('test'), Type.Literal('production')], {
    default: 'development',
  }),
  PORT: Type.Integer({ minimum: 1, maximum: 65535, default: 3000 }),
  DATABASE_URL: Type.String({ minLength: 1 }),
  DB_LOGGING: Type.Boolean({ default: false }),
})

export type Env = Static<typeof EnvSchema>

function loadEnv(): Env {
  const raw = {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL,
    DB_LOGGING: process.env.DB_LOGGING,
  }
  const value = Value.Default(EnvSchema, Value.Convert(EnvSchema, raw))

  if (!Value.Check(EnvSchema, value)) {
    const problems = [...Value.Errors(EnvSchema, value)].map((e) => `  ${e.path}: ${e.message}`)
    throw new Error(`Variables de entorno inválidas:\n${problems.join('\n')}`)
  }
  return value
}

export const env = loadEnv()

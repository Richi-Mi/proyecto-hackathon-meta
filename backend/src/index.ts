import 'reflect-metadata'
import { createContainer } from './container'
import { env } from './infrastructure/config/env'
import { AppDataSource } from './infrastructure/database/data-source'
import { createTelemetryPlugin } from './infrastructure/telemetry/opentelemetry'
import { createApp } from './interfaces/http/app'

await AppDataSource.initialize()

const container = createContainer(AppDataSource)
const app = createApp({
  useCases: container.useCases,
  checkDatabase: container.checkDatabase,
  config: {
    jwtSecret: env.JWT_SECRET,
    jwtExpiresInSeconds: env.JWT_EXPIRES_IN_SECONDS,
    corsOrigins: env.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
    devTools: env.NODE_ENV !== 'production',
    telemetry: env.OTEL_ENABLED
      ? createTelemetryPlugin({ serviceName: env.OTEL_SERVICE_NAME, otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT })
      : undefined,
  },
}).listen(env.PORT)

console.log(`🦊 Smart Abarrotes API en http://${app.server?.hostname}:${app.server?.port}/api/v1`)
console.log(`📘 Swagger en http://${app.server?.hostname}:${app.server?.port}/swagger`)

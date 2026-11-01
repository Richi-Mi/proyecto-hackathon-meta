import { opentelemetry } from '@elysiajs/opentelemetry'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'

export interface TelemetryOptions {
  serviceName: string
  /** Base del collector OTLP/HTTP, p. ej. http://localhost:4318 */
  otlpEndpoint: string
}

/** Trazas de cada request HTTP → OTel Collector → Jaeger (http://localhost:16686). */
export const createTelemetryPlugin = ({ serviceName, otlpEndpoint }: TelemetryOptions) =>
  opentelemetry({
    serviceName,
    traceExporter: new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` }),
  })

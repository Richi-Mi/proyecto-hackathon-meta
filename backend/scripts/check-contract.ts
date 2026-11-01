/**
 * Compara las rutas implementadas (OpenAPI generado por Elysia) contra el contrato SDD
 * docs/specs/openapi.yaml: operationId y códigos de respuesta de cada operación.
 * También lista lo que el contrato define y aún no está implementado.
 *
 *   bun run check:contract
 */
import { createApp } from '../src/interfaces/http/app'

const app = createApp({
  useCases: {} as never,
  checkDatabase: async () => true,
  config: { jwtSecret: 'x'.repeat(32), jwtExpiresInSeconds: 60, corsOrigins: [], devTools: true },
})
const implemented = (await (await app.handle(new Request('http://localhost/swagger/json'))).json()) as {
  paths: Record<string, Record<string, { operationId?: string; responses?: Record<string, unknown> }>>
}
const contract = Bun.YAML.parse(await Bun.file(new URL('../../docs/specs/openapi.yaml', import.meta.url)).text()) as {
  paths: Record<string, Record<string, { operationId: string; responses: Record<string, unknown> }>>
}

const PREFIX = '/api/v1'
const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete'])
const problems: string[] = []
let checked = 0

for (const [path, operations] of Object.entries(implemented.paths)) {
  if (!path.startsWith(PREFIX)) continue
  for (const [method, operation] of Object.entries(operations)) {
    if (!METHODS.has(method)) continue
    checked++
    const label = `${method.toUpperCase()} ${path.slice(PREFIX.length)}`
    const expected = contract.paths[path.slice(PREFIX.length)]?.[method]
    if (!expected) {
      problems.push(`${label}: no existe en el contrato`)
      continue
    }
    if (expected.operationId !== operation.operationId) {
      problems.push(`${label}: operationId ${operation.operationId} ≠ ${expected.operationId}`)
    }
    const actualCodes = Object.keys(operation.responses ?? {}).sort().join(',')
    const expectedCodes = Object.keys(expected.responses).sort().join(',')
    if (actualCodes !== expectedCodes) problems.push(`${label}: respuestas [${actualCodes}] ≠ contrato [${expectedCodes}]`)
  }
}

const pending = Object.entries(contract.paths).flatMap(([path, operations]) =>
  Object.keys(operations)
    .filter((method) => METHODS.has(method) && !implemented.paths[PREFIX + path]?.[method])
    .map((method) => `${method.toUpperCase()} ${path}`),
)

for (const problem of problems) console.log(`✗ ${problem}`)
console.log(`${checked} operaciones implementadas revisadas: ${problems.length} diferencias con el contrato`)
console.log(`Pendientes del contrato (${pending.length}): ${pending.join(', ') || 'ninguna'}`)
process.exit(problems.length > 0 ? 1 : 0)

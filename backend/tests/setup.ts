import { afterAll } from 'bun:test'
import { Client } from 'pg'

// Recrea la base de pruebas desde cero y aplica las migraciones antes de la suite.
const databaseUrl = new URL(process.env.DATABASE_URL ?? '')
const databaseName = databaseUrl.pathname.slice(1)
if (!databaseName.endsWith('_test')) {
  throw new Error(`Las pruebas BORRAN la base de datos: DATABASE_URL debe apuntar a una base *_test (recibí "${databaseName}")`)
}

const maintenanceUrl = new URL(databaseUrl)
maintenanceUrl.pathname = '/postgres'
const admin = new Client({ connectionString: maintenanceUrl.toString() })
await admin.connect()
await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`)
await admin.query(`CREATE DATABASE "${databaseName}"`)
await admin.end()

const { AppDataSource } = await import('../src/infrastructure/database/data-source')
await AppDataSource.initialize()
await AppDataSource.runMigrations()

afterAll(() => AppDataSource.destroy())

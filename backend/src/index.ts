import 'reflect-metadata'
import { Elysia } from 'elysia'
import { env } from './infrastructure/config/env'
import { AppDataSource } from './infrastructure/database/data-source'
import { healthRoutes } from './interfaces/http/health.routes'

await AppDataSource.initialize()

const app = new Elysia({ prefix: '/api/v1' }).use(healthRoutes(AppDataSource)).listen(env.PORT)

console.log(`🦊 Smart Abarrotes API en http://${app.server?.hostname}:${app.server?.port}/api/v1`)

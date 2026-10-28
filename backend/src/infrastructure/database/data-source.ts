import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { env } from '../config/env'
import * as entities from './entities'
import { SnakeNamingStrategy } from './naming-strategy'

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  entities: Object.values(entities),
  migrations: [`${import.meta.dir}/migrations/*.ts`],
  namingStrategy: new SnakeNamingStrategy(),
  // gen_random_uuid() (pgcrypto / nativo en PG 13+) en lugar de uuid-ossp
  uuidExtension: 'pgcrypto',
  // El esquema solo cambia mediante migraciones versionadas
  synchronize: false,
  logging: env.DB_LOGGING ? ['query', 'error', 'warn'] : ['error', 'warn'],
})

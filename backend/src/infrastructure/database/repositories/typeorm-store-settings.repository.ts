import type { DataSource, EntityManager } from 'typeorm'
import type { StoreSettingsRepository } from '../../../application/ports/store-settings-repository'
import { DEFAULT_STORE_SETTINGS, type StoreSettings, type StoreSettingsChanges } from '../../../domain/models/store-settings'
import { StoreSettingsEntity } from '../entities'

const SETTINGS_ID = 1

export class TypeOrmStoreSettingsRepository implements StoreSettingsRepository {
  constructor(private readonly dataSource: DataSource) {}

  async get(): Promise<StoreSettings> {
    const row = await this.dataSource.getRepository(StoreSettingsEntity).findOneBy({ id: SETTINGS_ID })
    return row ? toDomain(row) : DEFAULT_STORE_SETTINGS
  }

  update(change: (current: StoreSettings) => StoreSettingsChanges): Promise<StoreSettings> {
    return this.dataSource.transaction(async (manager) => {
      await ensureRow(manager)
      const row = await manager.findOneOrFail(StoreSettingsEntity, {
        where: { id: SETTINGS_ID },
        lock: { mode: 'pessimistic_write' },
      })
      const saved = await manager.save(StoreSettingsEntity, { ...row, ...definedOnly(change(toDomain(row))) })
      return toDomain(saved)
    })
  }
}

/** Crea la fila con los valores por defecto si aún no existe (sin carrera: ON CONFLICT DO NOTHING). */
async function ensureRow(manager: EntityManager) {
  const { updatedAt: _omit, ...defaults } = DEFAULT_STORE_SETTINGS
  await manager.createQueryBuilder().insert().into(StoreSettingsEntity).values({ id: SETTINGS_ID, ...defaults }).orIgnore().execute()
}

const definedOnly = <T extends object>(changes: T) =>
  Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined)) as Partial<T>

const toDomain = (row: StoreSettingsEntity): StoreSettings => ({
  businessName: row.businessName,
  legalName: row.legalName,
  rfc: row.rfc,
  address: row.address,
  phone: row.phone,
  logoUrl: row.logoUrl,
  currency: row.currency,
  defaultTaxRate: row.defaultTaxRate,
  ticketFooter: row.ticketFooter,
  peripherals: row.peripherals ?? {},
  updatedAt: row.updatedAt,
})

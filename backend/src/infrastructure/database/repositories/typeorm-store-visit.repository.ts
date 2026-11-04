import type { DataSource, EntityManager } from 'typeorm'
import type { NewStoreVisit, StoreVisitRepository, VisitClosing } from '../../../application/ports/store-visit-repository'
import { VisitStatus } from '../../../domain/enums'
import { ConflictError } from '../../../domain/errors'
import type { StoreVisit } from '../../../domain/models/store-visit'
import { StoreVisitEntity, UserEntity } from '../entities'
import { uniqueViolationColumn } from '../pg-errors'

export class TypeOrmStoreVisitRepository implements StoreVisitRepository {
  constructor(private readonly dataSource: DataSource) {}

  async open({ userId, entryTokenJti, gateId }: NewStoreVisit): Promise<StoreVisit> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        // Serializa las entradas del mismo cliente (dos escáneres a la vez)
        await manager.findOne(UserEntity, { where: { id: userId }, lock: { mode: 'pessimistic_write' } })
        await manager.update(
          StoreVisitEntity,
          { userId, status: VisitStatus.ACTIVE },
          { status: VisitStatus.ABANDONED, exitedAt: new Date() },
        )
        const visit = await manager.save(manager.create(StoreVisitEntity, { userId, entryTokenJti, gateId }))
        return toVisit(visit)
      })
    } catch (error) {
      if (uniqueViolationColumn(error) === 'entry_token_jti') {
        throw new ConflictError('ENTRY_TOKEN_REUSED', 'Este código QR ya se usó; genera uno nuevo en la app')
      }
      throw error
    }
  }

  async complete(closing: VisitClosing): Promise<void> {
    await this.dataSource.transaction((manager) => closeVisit(manager, closing))
  }

  async findById(id: string): Promise<StoreVisit | null> {
    const visit = await this.dataSource.getRepository(StoreVisitEntity).findOneBy({ id })
    return visit ? toVisit(visit) : null
  }

  async findByExitEventId(exitEventId: string): Promise<StoreVisit | null> {
    const visit = await this.dataSource.getRepository(StoreVisitEntity).findOneBy({ exitEventId })
    return visit ? toVisit(visit) : null
  }

  async findLatestActive(): Promise<StoreVisit | null> {
    const visit = await this.dataSource
      .getRepository(StoreVisitEntity)
      .findOne({ where: { status: VisitStatus.ACTIVE }, order: { enteredAt: 'DESC' } })
    return visit ? toVisit(visit) : null
  }

  async findActiveByUser(userId: string): Promise<StoreVisit | null> {
    const visit = await this.dataSource.getRepository(StoreVisitEntity).findOneBy({ userId, status: VisitStatus.ACTIVE })
    return visit ? toVisit(visit) : null
  }
}

/**
 * Cierra como COMPLETED una visita que siga ACTIVE (actualización condicional: dos webhooks simultáneos no pueden
 * cerrarla ambos). Se usa también dentro de la transacción de la venta automática.
 */
export async function closeVisit(manager: EntityManager, { visitId, exitEventId, exitedAt }: VisitClosing) {
  try {
    const result = await manager.update(
      StoreVisitEntity,
      { id: visitId, status: VisitStatus.ACTIVE },
      { status: VisitStatus.COMPLETED, exitedAt, exitEventId },
    )
    if (!result.affected) throw new ConflictError('VISIT_CLOSED', 'La visita ya estaba cerrada')
  } catch (error) {
    if (uniqueViolationColumn(error) === 'exit_event_id') {
      throw new ConflictError('EVENT_ID_CONFLICT', `El evento ${exitEventId} ya cerró otra visita`)
    }
    throw error
  }
}

function toVisit(entity: StoreVisitEntity): StoreVisit {
  return {
    id: entity.id,
    userId: entity.userId,
    gateId: entity.gateId,
    status: entity.status,
    enteredAt: entity.enteredAt,
    exitedAt: entity.exitedAt,
    exitEventId: entity.exitEventId,
  }
}

import { In, type DataSource } from 'typeorm'
import type { Page, PageRequest } from '../../../application/common/pagination'
import type {
  NewShelfEvent,
  ShelfEventRepository,
  ShelfEventResolution,
} from '../../../application/ports/shelf-event-repository'
import type { ShelfEventStatus } from '../../../domain/enums'
import type { ShelfEvent, ShelfEventFrames, ShelfImage, ShelfReviewReason } from '../../../domain/models/shelf-event'
import { ShelfEventEntity } from '../entities'

export class TypeOrmShelfEventRepository implements ShelfEventRepository {
  constructor(private readonly dataSource: DataSource) {}

  private get repository() {
    return this.dataSource.getRepository(ShelfEventEntity)
  }

  async create({ frames, ...event }: NewShelfEvent): Promise<ShelfEvent> {
    const saved = await this.repository.save(
      this.repository.create({
        ...event,
        imageMimeType: frames.after.mimeType,
        beforeImage: Buffer.from(frames.before.data),
        afterImage: Buffer.from(frames.after.data),
      }),
    )
    return (await this.findById(saved.id))!
  }

  async findById(id: string): Promise<ShelfEvent | null> {
    const entity = await this.repository.findOne({ where: { id }, relations: { product: true } })
    return entity ? toShelfEvent(entity) : null
  }

  async findFrames(id: string): Promise<ShelfEventFrames | null> {
    const entity = await this.repository
      .createQueryBuilder('event')
      .select(['event.id', 'event.imageMimeType', 'event.beforeImage', 'event.afterImage'])
      .where('event.id = :id', { id })
      .getOne()
    if (!entity) return null
    const mimeType = entity.imageMimeType as ShelfImage['mimeType']
    return {
      before: { mimeType, data: new Uint8Array(entity.beforeImage) },
      after: { mimeType, data: new Uint8Array(entity.afterImage) },
    }
  }

  async list(filters: { status?: ShelfEventStatus }, { page, limit }: PageRequest): Promise<Page<ShelfEvent>> {
    const [data, total] = await this.repository.findAndCount({
      where: filters.status ? { status: filters.status } : {},
      relations: { product: true },
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    })
    return { data: data.map(toShelfEvent), meta: { page, limit, total } }
  }

  async transition(id: string, from: ShelfEventStatus[], changes: ShelfEventResolution): Promise<ShelfEvent | null> {
    const result = await this.repository.update({ id, status: In(from) }, changes)
    if (!result.affected) return null
    return this.findById(id)
  }
}

function toShelfEvent(entity: ShelfEventEntity): ShelfEvent {
  return {
    id: entity.id,
    cameraId: entity.cameraId,
    status: entity.status,
    action: entity.action,
    productId: entity.productId,
    productName: entity.product?.name ?? null,
    quantity: entity.quantity,
    confidence: entity.confidence,
    reviewReason: entity.reviewReason as ShelfReviewReason | null,
    note: entity.note,
    model: entity.model,
    changeRatio: entity.changeRatio,
    movementId: entity.movementId,
    capturedAt: entity.capturedAt,
    createdAt: entity.createdAt,
    resolvedAt: entity.resolvedAt,
    resolvedBy: entity.resolvedBy,
  }
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm'
import { VisitStatus } from '../../../domain/enums'
import { SaleEntity } from './sale.entity'
import { UserEntity } from './user.entity'

/** Visita a la tienda física: se abre al escanear el QR y se cierra con el webhook de salida. */
@Entity('store_visits')
// Como máximo una visita ACTIVE por cliente (al volver a entrar, la anterior pasa a ABANDONED)
@Index('UQ_store_visits_active_user', ['userId'], { unique: true, where: `"status" = 'ACTIVE'` })
export class StoreVisitEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index()
  @Column({ type: 'uuid' })
  userId!: string

  @ManyToOne(() => UserEntity, (user) => user.visits, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<UserEntity>

  /** `jti` del JWT de entrada: impide reutilizar el mismo QR (anti-replay). */
  @Column({ type: 'uuid', unique: true })
  entryTokenJti!: string

  @Column({ type: 'varchar', length: 64 })
  gateId!: string

  @Column({ type: 'enum', enum: VisitStatus, enumName: 'visit_status', default: VisitStatus.ACTIVE })
  status!: VisitStatus

  @CreateDateColumn({ type: 'timestamptz' })
  enteredAt!: Date

  @Column({ type: 'timestamptz', nullable: true })
  exitedAt!: Date | null

  /** `eventId` del webhook que cerró la visita: idempotencia aunque la salida no genere venta. */
  @Index('UQ_store_visits_exit_event_id', { unique: true })
  @Column({ type: 'varchar', length: 128, nullable: true })
  exitEventId!: string | null

  @OneToOne(() => SaleEntity, (sale) => sale.visit)
  sale?: Relation<SaleEntity> | null
}

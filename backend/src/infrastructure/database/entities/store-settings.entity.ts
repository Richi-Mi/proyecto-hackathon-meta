import { Check, Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm'
import type { Peripherals } from '../../../domain/peripherals'
import { rate } from '../transformers'

/** Configuración del negocio. Tabla de una sola fila (id = 1). */
@Entity('store_settings')
@Check(`"id" = 1`)
export class StoreSettingsEntity {
  @PrimaryColumn({ type: 'int', default: 1 })
  id!: number

  @Column({ type: 'varchar', length: 150 })
  businessName!: string

  @Column({ type: 'varchar', length: 200, nullable: true })
  legalName!: string | null

  @Column({ type: 'varchar', length: 13, nullable: true })
  rfc!: string | null

  @Column({ type: 'text' })
  address!: string

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone!: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  logoUrl!: string | null

  @Column({ type: 'char', length: 3, default: 'MXN' })
  currency!: string

  @Column({ ...rate, default: () => '0.16' })
  defaultTaxRate!: number

  @Column({ type: 'text', nullable: true })
  ticketFooter!: string | null

  @Column({ type: 'jsonb', default: () => `'{}'` })
  peripherals!: Peripherals

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date
}

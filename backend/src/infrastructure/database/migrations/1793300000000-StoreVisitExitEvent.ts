import type { MigrationInterface, QueryRunner } from 'typeorm'

/** Flujo automático: idempotencia del webhook de salida y una sola visita ACTIVE por cliente. */
export class StoreVisitExitEvent1793300000000 implements MigrationInterface {
  name = 'StoreVisitExitEvent1793300000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "store_visits" ADD "exit_event_id" character varying(128)`)
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_store_visits_exit_event_id" ON "store_visits" ("exit_event_id") `)
    // Visitas ACTIVE previas duplicadas (no debería haber): se conserva la más reciente
    await queryRunner.query(`
      UPDATE "store_visits" v SET "status" = 'ABANDONED', "exited_at" = now()
      WHERE v."status" = 'ACTIVE' AND EXISTS (
        SELECT 1 FROM "store_visits" newer
        WHERE newer."user_id" = v."user_id" AND newer."status" = 'ACTIVE' AND newer."entered_at" > v."entered_at"
      )`)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_store_visits_active_user" ON "store_visits" ("user_id") WHERE "status" = 'ACTIVE'`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_store_visits_active_user"`)
    await queryRunner.query(`DROP INDEX "public"."UQ_store_visits_exit_event_id"`)
    await queryRunner.query(`ALTER TABLE "store_visits" DROP COLUMN "exit_event_id"`)
  }
}

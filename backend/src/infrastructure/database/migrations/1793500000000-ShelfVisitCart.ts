import type { MigrationInterface, QueryRunner } from 'typeorm'

/** ShelfSight + Smart Store: lo que la cámara ve salir de la repisa va al carrito de la visita activa. */
export class ShelfVisitCart1793500000000 implements MigrationInterface {
  name = 'ShelfVisitCart1793500000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shelf_events" ADD "visit_id" uuid`)
    await queryRunner.query(
      `ALTER TABLE "shelf_events" ADD CONSTRAINT "FK_shelf_events_visit" FOREIGN KEY ("visit_id") REFERENCES "store_visits"("id") ON DELETE RESTRICT`,
    )
    await queryRunner.query(`CREATE INDEX "IDX_shelf_events_visit_id" ON "shelf_events" ("visit_id")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_shelf_events_visit_id"`)
    await queryRunner.query(`ALTER TABLE "shelf_events" DROP CONSTRAINT "FK_shelf_events_visit"`)
    await queryRunner.query(`ALTER TABLE "shelf_events" DROP COLUMN "visit_id"`)
  }
}

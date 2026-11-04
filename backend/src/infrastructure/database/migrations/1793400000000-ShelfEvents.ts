import type { MigrationInterface, QueryRunner } from 'typeorm'

/** ShelfSight: eventos de la cámara de repisa con sus fotos y la cola de revisión. */
export class ShelfEvents1793400000000 implements MigrationInterface {
  name = 'ShelfEvents1793400000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."shelf_event_status" AS ENUM('APPLIED', 'PENDING_REVIEW', 'NO_CHANGE', 'REJECTED')`)
    await queryRunner.query(`CREATE TYPE "public"."shelf_action" AS ENUM('REMOVED', 'ADDED', 'MOVED', 'NONE')`)
    await queryRunner.query(`
      CREATE TABLE "shelf_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "camera_id" character varying(64) NOT NULL,
        "status" "public"."shelf_event_status" NOT NULL,
        "action" "public"."shelf_action" NOT NULL DEFAULT 'NONE',
        "product_id" character varying(64),
        "quantity" integer NOT NULL DEFAULT 0,
        "confidence" numeric(4,3),
        "review_reason" character varying(32),
        "note" text,
        "model" character varying(100),
        "change_ratio" numeric(5,4),
        "movement_id" uuid,
        "image_mime_type" character varying(16) NOT NULL,
        "before_image" bytea NOT NULL,
        "after_image" bytea NOT NULL,
        "captured_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "resolved_at" TIMESTAMP WITH TIME ZONE,
        "resolved_by" uuid,
        CONSTRAINT "CHK_shelf_events_quantity" CHECK ("quantity" >= 0),
        CONSTRAINT "PK_shelf_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_shelf_events_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_shelf_events_movement" FOREIGN KEY ("movement_id") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_shelf_events_resolved_by" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE RESTRICT
      )`)
    await queryRunner.query(`CREATE INDEX "IDX_shelf_events_status_created_at" ON "shelf_events" ("status", "created_at")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "shelf_events"`)
    await queryRunner.query(`DROP TYPE "public"."shelf_action"`)
    await queryRunner.query(`DROP TYPE "public"."shelf_event_status"`)
  }
}

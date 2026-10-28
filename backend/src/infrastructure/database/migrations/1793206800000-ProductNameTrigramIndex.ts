import type { MigrationInterface, QueryRunner } from 'typeorm'

/** Búsqueda por nombre en el POS (ILIKE '%texto%') usando el índice GIN de pg_trgm. */
export class ProductNameTrigramIndex1793206800000 implements MigrationInterface {
  name = 'ProductNameTrigramIndex1793206800000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX "IDX_products_name_trgm" ON "products" USING gin ("name" gin_trgm_ops)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_products_name_trgm"`)
  }
}

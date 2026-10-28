import type { MigrationInterface, QueryRunner } from 'typeorm'

export class EnableExtensions1793206000000 implements MigrationInterface {
  name = 'EnableExtensions1793206000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "citext"`)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP EXTENSION IF EXISTS "pg_trgm"`)
    await queryRunner.query(`DROP EXTENSION IF EXISTS "citext"`)
    await queryRunner.query(`DROP EXTENSION IF EXISTS "pgcrypto"`)
  }
}

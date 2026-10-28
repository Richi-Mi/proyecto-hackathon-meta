import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1793206724553 implements MigrationInterface {
    name = 'InitialSchema1793206724553'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "sale_items" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "sale_id" uuid NOT NULL, "product_id" character varying(64) NOT NULL, "product_name" character varying(150) NOT NULL, "quantity" integer NOT NULL, "unit_price" numeric(12,2) NOT NULL, "unit_cost" numeric(12,2) NOT NULL, "tax_rate" numeric(5,4) NOT NULL, "subtotal" numeric(12,2) NOT NULL, CONSTRAINT "CHK_89f1224224de64d09744117266" CHECK ("quantity" > 0), CONSTRAINT "PK_5a7dc5b4562a9e590528b3e08ab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c210a330b80232c29c2ad68462" ON "sale_items"  ("sale_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_4ecae62db3f9e9cc9a368d57ad" ON "sale_items"  ("product_id") `);
        await queryRunner.query(`CREATE TYPE "public"."user_role" AS ENUM('OWNER', 'CUSTOMER')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(120) NOT NULL, "email" citext NOT NULL, "password_hash" text NOT NULL, "role" "public"."user_role" NOT NULL DEFAULT 'CUSTOMER', "payment_customer_ref" character varying(255), "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."visit_status" AS ENUM('ACTIVE', 'COMPLETED', 'ABANDONED')`);
        await queryRunner.query(`CREATE TABLE "store_visits" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "entry_token_jti" uuid NOT NULL, "gate_id" character varying(64) NOT NULL, "status" "public"."visit_status" NOT NULL DEFAULT 'ACTIVE', "entered_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "exited_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_aee148fca394c4bb605754904f9" UNIQUE ("entry_token_jti"), CONSTRAINT "PK_b7ae8f7ee9d60e6070d49794878" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a9e214174b13ee20c6e03b9a2e" ON "store_visits"  ("user_id") `);
        await queryRunner.query(`CREATE TYPE "public"."sale_type" AS ENUM('AUTOMATED', 'MANUAL')`);
        await queryRunner.query(`CREATE TYPE "public"."payment_method" AS ENUM('CASH', 'CARD', 'TRANSFER', 'CARD_ON_FILE')`);
        await queryRunner.query(`CREATE TYPE "public"."payment_status" AS ENUM('PAID', 'PENDING', 'FAILED', 'REFUNDED')`);
        await queryRunner.query(`CREATE TYPE "public"."sale_status" AS ENUM('COMPLETED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "sales" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "folio" SERIAL NOT NULL, "date_time" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid, "cashier_id" uuid, "visit_id" uuid, "external_event_id" character varying(128), "sale_type" "public"."sale_type" NOT NULL, "payment_method" "public"."payment_method" NOT NULL, "payment_status" "public"."payment_status" NOT NULL, "payment_reference" character varying(128), "status" "public"."sale_status" NOT NULL DEFAULT 'COMPLETED', "subtotal" numeric(12,2) NOT NULL, "tax_amount" numeric(12,2) NOT NULL, "total_amount" numeric(12,2) NOT NULL, "cash_received" numeric(12,2), "change_given" numeric(12,2), "cancelled_at" TIMESTAMP WITH TIME ZONE, "cancelled_by" uuid, "cancel_reason" text, CONSTRAINT "UQ_a1f3b8d94145c843fc8f86fa5bc" UNIQUE ("folio"), CONSTRAINT "UQ_fd1a2e65a46f9e766b61d8db7ff" UNIQUE ("external_event_id"), CONSTRAINT "REL_8ba8dedfb986793cf3b0fc4a31" UNIQUE ("visit_id"), CONSTRAINT "CHK_9e3596636b8651a109e2d7b31a" CHECK ("subtotal" >= 0 AND "tax_amount" >= 0 AND "total_amount" >= 0), CONSTRAINT "PK_4f0bc990ae81dba46da680895ea" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_123d9485b4c648c47878f85be2" ON "sales"  ("date_time") `);
        await queryRunner.query(`CREATE INDEX "IDX_9fd1469a7a5a56a8026a21b82e" ON "sales"  ("user_id", "date_time") `);
        await queryRunner.query(`CREATE TYPE "public"."movement_type" AS ENUM('SALE', 'CANCELLATION', 'RESTOCK', 'ADJUSTMENT')`);
        await queryRunner.query(`CREATE TABLE "inventory_movements" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "product_id" character varying(64) NOT NULL, "type" "public"."movement_type" NOT NULL, "quantity_delta" integer NOT NULL, "stock_after" integer NOT NULL, "sale_id" uuid, "user_id" uuid, "note" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_2010355f55ce32a4fed9e90032" CHECK ("quantity_delta" <> 0), CONSTRAINT "PK_d7597827c1dcffae889db3ab873" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d6c0007a291b66477a0562d8d1" ON "inventory_movements"  ("product_id", "created_at") `);
        await queryRunner.query(`CREATE TYPE "public"."product_status" AS ENUM('ACTIVE', 'INACTIVE', 'DISCONTINUED')`);
        await queryRunner.query(`CREATE TABLE "products" ("id" character varying(64) NOT NULL, "barcode" character varying(64), "name" character varying(150) NOT NULL, "description" text, "category_id" uuid NOT NULL, "price" numeric(12,2) NOT NULL, "purchase_cost" numeric(12,2) NOT NULL, "tax_rate" numeric(5,4) NOT NULL DEFAULT '0.16', "stock" integer NOT NULL DEFAULT '0', "min_stock_alert" integer NOT NULL DEFAULT '5', "status" "public"."product_status" NOT NULL DEFAULT 'ACTIVE', "image_url" character varying(500), "is_quick_access" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_adfc522baf9d9b19cd7d9461b7e" UNIQUE ("barcode"), CONSTRAINT "CHK_53ca198a059eb0ac3d4e29701d" CHECK ("min_stock_alert" >= 0), CONSTRAINT "CHK_7ec9773de1f4f2017453898a01" CHECK ("tax_rate" BETWEEN 0 AND 1), CONSTRAINT "CHK_d0ab9fa671635965db94308e54" CHECK ("purchase_cost" >= 0), CONSTRAINT "CHK_90ac64027434b412e08988bcac" CHECK ("price" >= 0), CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9a5f6868c96e0069e699f33e12" ON "products"  ("category_id") `);
        await queryRunner.query(`CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(60) NOT NULL, "color" character varying(7) NOT NULL, "icon" character varying(60), "sort_order" integer NOT NULL DEFAULT '0', CONSTRAINT "UQ_8b0be371d28245da6e4f4b61878" UNIQUE ("name"), CONSTRAINT "CHK_eb39b9d91cf0021cea8fd01726" CHECK ("color" ~ '^#[0-9A-Fa-f]{6}$'), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "store_settings" ("id" integer NOT NULL DEFAULT '1', "business_name" character varying(150) NOT NULL, "legal_name" character varying(200), "rfc" character varying(13), "address" text NOT NULL, "phone" character varying(20), "logo_url" character varying(500), "currency" character(3) NOT NULL DEFAULT 'MXN', "default_tax_rate" numeric(5,4) NOT NULL DEFAULT '0.16', "ticket_footer" text, "peripherals" jsonb NOT NULL DEFAULT '{}'::jsonb, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_9e07282be9380b38b233ba815d" CHECK ("id" = 1), CONSTRAINT "PK_4da44f346b360f378f1489b6199" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "sale_items" ADD CONSTRAINT "FK_c210a330b80232c29c2ad68462a" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sale_items" ADD CONSTRAINT "FK_4ecae62db3f9e9cc9a368d57adb" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "store_visits" ADD CONSTRAINT "FK_a9e214174b13ee20c6e03b9a2ef" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sales" ADD CONSTRAINT "FK_5f282f3656814ec9ca2675aef6f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sales" ADD CONSTRAINT "FK_52ad26d289eda84215d133ff0f8" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sales" ADD CONSTRAINT "FK_8ba8dedfb986793cf3b0fc4a314" FOREIGN KEY ("visit_id") REFERENCES "store_visits"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sales" ADD CONSTRAINT "FK_50502ae8c7ea443988e220d0c04" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inventory_movements" ADD CONSTRAINT "FK_5c3bec1682252c36fa161587738" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inventory_movements" ADD CONSTRAINT "FK_e4b348ef2301791e3f794680efd" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inventory_movements" ADD CONSTRAINT "FK_63cca4adcd28b6fe19bc4ceb22f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "products" ADD CONSTRAINT "FK_9a5f6868c96e0069e699f33e124" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT "FK_9a5f6868c96e0069e699f33e124"`);
        await queryRunner.query(`ALTER TABLE "inventory_movements" DROP CONSTRAINT "FK_63cca4adcd28b6fe19bc4ceb22f"`);
        await queryRunner.query(`ALTER TABLE "inventory_movements" DROP CONSTRAINT "FK_e4b348ef2301791e3f794680efd"`);
        await queryRunner.query(`ALTER TABLE "inventory_movements" DROP CONSTRAINT "FK_5c3bec1682252c36fa161587738"`);
        await queryRunner.query(`ALTER TABLE "sales" DROP CONSTRAINT "FK_50502ae8c7ea443988e220d0c04"`);
        await queryRunner.query(`ALTER TABLE "sales" DROP CONSTRAINT "FK_8ba8dedfb986793cf3b0fc4a314"`);
        await queryRunner.query(`ALTER TABLE "sales" DROP CONSTRAINT "FK_52ad26d289eda84215d133ff0f8"`);
        await queryRunner.query(`ALTER TABLE "sales" DROP CONSTRAINT "FK_5f282f3656814ec9ca2675aef6f"`);
        await queryRunner.query(`ALTER TABLE "store_visits" DROP CONSTRAINT "FK_a9e214174b13ee20c6e03b9a2ef"`);
        await queryRunner.query(`ALTER TABLE "sale_items" DROP CONSTRAINT "FK_4ecae62db3f9e9cc9a368d57adb"`);
        await queryRunner.query(`ALTER TABLE "sale_items" DROP CONSTRAINT "FK_c210a330b80232c29c2ad68462a"`);
        await queryRunner.query(`DROP TABLE "store_settings"`);
        await queryRunner.query(`DROP TABLE "categories"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9a5f6868c96e0069e699f33e12"`);
        await queryRunner.query(`DROP TABLE "products"`);
        await queryRunner.query(`DROP TYPE "public"."product_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d6c0007a291b66477a0562d8d1"`);
        await queryRunner.query(`DROP TABLE "inventory_movements"`);
        await queryRunner.query(`DROP TYPE "public"."movement_type"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9fd1469a7a5a56a8026a21b82e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_123d9485b4c648c47878f85be2"`);
        await queryRunner.query(`DROP TABLE "sales"`);
        await queryRunner.query(`DROP TYPE "public"."sale_status"`);
        await queryRunner.query(`DROP TYPE "public"."payment_status"`);
        await queryRunner.query(`DROP TYPE "public"."payment_method"`);
        await queryRunner.query(`DROP TYPE "public"."sale_type"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a9e214174b13ee20c6e03b9a2e"`);
        await queryRunner.query(`DROP TABLE "store_visits"`);
        await queryRunner.query(`DROP TYPE "public"."visit_status"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."user_role"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4ecae62db3f9e9cc9a368d57ad"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c210a330b80232c29c2ad68462"`);
        await queryRunner.query(`DROP TABLE "sale_items"`);
    }

}

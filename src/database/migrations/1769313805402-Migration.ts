import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1769313805402 implements MigrationInterface {
    name = 'Migration1769313805402'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."WEBHOOK_DELIVERY_TYPE" AS ENUM('RISK_RESULT')`);
        await queryRunner.query(`CREATE TYPE "public"."WEBHOOK_DELIVERY_STATUS" AS ENUM('PENDING', 'SENT', 'SUCCESS', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "webhook_deliveries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "application_id" uuid NOT NULL, "type" "public"."WEBHOOK_DELIVERY_TYPE" NOT NULL, "status" "public"."WEBHOOK_DELIVERY_STATUS" NOT NULL DEFAULT 'PENDING', "url" character varying NOT NULL, "request_body" jsonb NOT NULL, "request_headers" jsonb, "response_status_code" integer, "response_body" jsonb, "error_message" text, "attempt_count" integer NOT NULL DEFAULT '0', "idempotency_key" character varying(128), "delivered_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_535dd409947fb6d8fc6dfc0112a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "ix_webhook_deliveries_tenant_type_status" ON "webhook_deliveries" ("tenant_id", "type", "status") `);
        await queryRunner.query(`CREATE INDEX "ix_webhook_deliveries_tenant_application" ON "webhook_deliveries" ("tenant_id", "application_id") `);
        await queryRunner.query(`ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "FK_dd2bc3de0e4a0329a4ef30600b4" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "FK_2cceec579def751f858bad3e4e6" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "webhook_deliveries" DROP CONSTRAINT "FK_2cceec579def751f858bad3e4e6"`);
        await queryRunner.query(`ALTER TABLE "webhook_deliveries" DROP CONSTRAINT "FK_dd2bc3de0e4a0329a4ef30600b4"`);
        await queryRunner.query(`DROP INDEX "public"."ix_webhook_deliveries_tenant_application"`);
        await queryRunner.query(`DROP INDEX "public"."ix_webhook_deliveries_tenant_type_status"`);
        await queryRunner.query(`DROP TABLE "webhook_deliveries"`);
        await queryRunner.query(`DROP TYPE "public"."WEBHOOK_DELIVERY_STATUS"`);
        await queryRunner.query(`DROP TYPE "public"."WEBHOOK_DELIVERY_TYPE"`);
    }

}

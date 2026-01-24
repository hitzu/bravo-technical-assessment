import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1769286366652 implements MigrationInterface {
    name = 'Migration1769286366652'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."COUNTRY_STATUS" AS ENUM('ACTIVE', 'INACTIVE')`);
        await queryRunner.query(`CREATE TABLE "countries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "code" character(2) NOT NULL, "name" character varying(100) NOT NULL, "status" "public"."COUNTRY_STATUS" NOT NULL DEFAULT 'ACTIVE', CONSTRAINT "UQ_b47cbb5311bad9c9ae17b8c1eda" UNIQUE ("code"), CONSTRAINT "PK_b2d7006793e8697ab3ae2deff18" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "ix_countries_status" ON "countries" ("status") `);
        await queryRunner.query(`CREATE TABLE "credit_applications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "created_by" uuid NOT NULL, "country_id" uuid NOT NULL, "full_name" character varying(255) NOT NULL, "document_id" character varying(255) NOT NULL, "monthly_income" numeric NOT NULL, "requested_amount" numeric NOT NULL, "status" "public"."CREDIT_APPLICATION_STATUS" NOT NULL DEFAULT 'PENDING', "bank_info" jsonb, CONSTRAINT "PK_1943980f81286bd5dc733b5119c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "ix_credit_applications_tenant_status_created_at" ON "credit_applications" ("tenant_id", "status", "created_at") `);
        await queryRunner.query(`ALTER TABLE "credit_applications" ADD CONSTRAINT "FK_ec6c674c20d5f1607acd4b8edaf" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "credit_applications" ADD CONSTRAINT "FK_437f3032e252082d601d7bf0b00" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "credit_applications" DROP CONSTRAINT "FK_437f3032e252082d601d7bf0b00"`);
        await queryRunner.query(`ALTER TABLE "credit_applications" DROP CONSTRAINT "FK_ec6c674c20d5f1607acd4b8edaf"`);
        await queryRunner.query(`DROP INDEX "public"."ix_credit_applications_tenant_status_created_at"`);
        await queryRunner.query(`DROP TABLE "credit_applications"`);
        await queryRunner.query(`DROP INDEX "public"."ix_countries_status"`);
        await queryRunner.query(`DROP TABLE "countries"`);
        await queryRunner.query(`DROP TYPE "public"."COUNTRY_STATUS"`);
    }

}

import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1769290716487 implements MigrationInterface {
    name = 'Migration1769290716487'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."APPLICATION_RISK_DECISION" AS ENUM('APPROVE', 'REVIEW', 'REJECT')`);
        await queryRunner.query(`CREATE TABLE "application_risk_results" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "application_id" uuid NOT NULL, "tenant_id" uuid NOT NULL, "country_id" uuid NOT NULL, "debt_to_income_ratio" numeric NOT NULL, "risk_score" integer NOT NULL, "decision" "public"."APPLICATION_RISK_DECISION" NOT NULL, "raw_bank_snapshot" jsonb NOT NULL, CONSTRAINT "PK_5128b5f7ad885663abb813a4f23" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "ix_application_risk_results_tenant_application" ON "application_risk_results" ("tenant_id", "application_id") `);
        await queryRunner.query(`ALTER TABLE "application_risk_results" ADD CONSTRAINT "FK_a8eb06a0d1d5de39204d3d9f21e" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "application_risk_results" ADD CONSTRAINT "FK_6380e6c40350a1fc4dd9feffab5" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "application_risk_results" ADD CONSTRAINT "FK_ab9cf7c16d738895af2552fec77" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "application_risk_results" DROP CONSTRAINT "FK_ab9cf7c16d738895af2552fec77"`);
        await queryRunner.query(`ALTER TABLE "application_risk_results" DROP CONSTRAINT "FK_6380e6c40350a1fc4dd9feffab5"`);
        await queryRunner.query(`ALTER TABLE "application_risk_results" DROP CONSTRAINT "FK_a8eb06a0d1d5de39204d3d9f21e"`);
        await queryRunner.query(`DROP INDEX "public"."ix_application_risk_results_tenant_application"`);
        await queryRunner.query(`DROP TABLE "application_risk_results"`);
        await queryRunner.query(`DROP TYPE "public"."APPLICATION_RISK_DECISION"`);
    }

}

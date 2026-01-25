import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1769303614527 implements MigrationInterface {
    name = 'Migration1769303614527'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."ASYNC_JOB_TYPE" AS ENUM('RISK_EVAL')`);
        await queryRunner.query(`CREATE TYPE "public"."ASYNC_JOB_STATUS" AS ENUM('PENDING', 'RUNNING', 'DONE', 'DLQ')`);
        await queryRunner.query(`CREATE TABLE "async_jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "type" "public"."ASYNC_JOB_TYPE" NOT NULL, "payload" jsonb NOT NULL, "status" "public"."ASYNC_JOB_STATUS" NOT NULL DEFAULT 'PENDING', "attempts" integer NOT NULL DEFAULT '0', "last_error" text, "processed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_c8d5ccfc43ccc29845e85753de0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "ix_async_jobs_tenant_status" ON "async_jobs" ("tenant_id", "status") `);
        await queryRunner.query(`CREATE INDEX "ix_async_jobs_status_created" ON "async_jobs" ("status", "created_at") `);
        await queryRunner.query(`CREATE OR REPLACE FUNCTION "public"."fn_enqueue_risk_job_for_credit_application"() RETURNS TRIGGER AS $$
        BEGIN
        INSERT INTO "async_jobs" ("tenant_id", "type", "payload", "status", "attempts")
        VALUES (
            NEW."tenant_id",
            'RISK_EVAL',
            jsonb_build_object('applicationId', NEW."id"::text),
            'PENDING',
            0
        );
        RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;`);
        await queryRunner.query(`CREATE TRIGGER "trg_credit_applications_enqueue_risk_job" AFTER INSERT ON "credit_applications" FOR EACH ROW EXECUTE FUNCTION "public"."fn_enqueue_risk_job_for_credit_application"();`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."ix_async_jobs_status_created"`);
        await queryRunner.query(`DROP INDEX "public"."ix_async_jobs_tenant_status"`);
        await queryRunner.query(`DROP TABLE "async_jobs"`);
        await queryRunner.query(`DROP TYPE "public"."ASYNC_JOB_STATUS"`);
        await queryRunner.query(`DROP TYPE "public"."ASYNC_JOB_TYPE"`);
    }

}

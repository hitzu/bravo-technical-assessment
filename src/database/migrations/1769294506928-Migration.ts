import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1769294506928 implements MigrationInterface {
    name = 'Migration1769294506928'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "country_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "country_id" uuid NOT NULL, "version" integer NOT NULL DEFAULT '1', "is_active" boolean NOT NULL DEFAULT false, "document_min_length" integer, "document_max_length" integer, "dti_approve_max" numeric, "dti_review_max" numeric, "requested_amount_review_threshold" numeric, "requested_amount_to_monthly_income_approve_max" numeric, "requested_amount_to_monthly_income_review_max" numeric, "min_monthly_income" numeric, "min_risk_score_approve" integer, "min_risk_score_review" integer, CONSTRAINT "ux_country_rules_country_version" UNIQUE ("country_id", "version"), CONSTRAINT "PK_b9c459c7390d45f1d999e1be236" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "ix_country_rules_country_active" ON "country_rules" ("country_id", "is_active") `);
        await queryRunner.query(`ALTER TABLE "country_rules" ADD CONSTRAINT "FK_2a3f99dd0ebabd9904dfaca32bd" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "country_rules" DROP CONSTRAINT "FK_2a3f99dd0ebabd9904dfaca32bd"`);
        await queryRunner.query(`DROP INDEX "public"."ix_country_rules_country_active"`);
        await queryRunner.query(`DROP TABLE "country_rules"`);
    }

}

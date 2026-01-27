import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1769484559665 implements MigrationInterface {
    name = 'Migration1769484559665'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "application_risk_results" ADD "requested_amount_to_monthly_income_ratio" numeric(10,4) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "credit_applications" ADD CONSTRAINT "FK_88f5bb8bc484e03d54179d25ce3" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "credit_applications" DROP CONSTRAINT "FK_88f5bb8bc484e03d54179d25ce3"`);
        await queryRunner.query(`ALTER TABLE "application_risk_results" DROP COLUMN "requested_amount_to_monthly_income_ratio"`);
    }

}

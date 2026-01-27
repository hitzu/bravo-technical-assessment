import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1769530677027 implements MigrationInterface {
    name = 'Migration1769530677027'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "countries" ADD "document_label" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "countries" ADD "document_regex_pattern" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "countries" ADD "document_example" character varying(100)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "countries" DROP COLUMN "document_example"`);
        await queryRunner.query(`ALTER TABLE "countries" DROP COLUMN "document_regex_pattern"`);
        await queryRunner.query(`ALTER TABLE "countries" DROP COLUMN "document_label"`);
    }

}

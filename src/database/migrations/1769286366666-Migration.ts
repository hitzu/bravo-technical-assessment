import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1769286366666 implements MigrationInterface {
    name = 'Migration1769286366666'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO "countries" ("code", "name", "status", "created_at", "updated_at")
            VALUES
              ('ES', 'Spain', 'ACTIVE', now(), now()),
              ('MX', 'Mexico', 'ACTIVE', now(), now()),
              ('BR', 'Brazil', 'ACTIVE', now(), now())
          `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM "countries" WHERE "code" IN ('ES', 'MX', 'BR')
        `);
    }

}

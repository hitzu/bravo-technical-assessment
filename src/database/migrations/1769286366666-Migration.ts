import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1769286366666 implements MigrationInterface {
    name = 'Migration1769286366666'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Intentionally left blank.
        // Countries are now seeded via the dev seeder:
        //   pnpm seed:dev-data
        void queryRunner;
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No-op (see note in up()).
        void queryRunner;
    }

}

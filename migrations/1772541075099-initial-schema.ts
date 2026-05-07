import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1772541075099 implements MigrationInterface {
    name = 'InitialSchema1772541075099'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`courses\` DROP COLUMN \`code\``);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`courses\` ADD \`code\` varchar(7) NOT NULL`);
    }

}

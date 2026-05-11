import { MigrationInterface, QueryRunner } from "typeorm";

export class ModifyFkJwtList1778493403306 implements MigrationInterface {
    name = 'ModifyFkJwtList1778493403306'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`jwt_token_list\` DROP FOREIGN KEY \`FK_42fc802833521b42e2fd85b827b\``);
        await queryRunner.query(`ALTER TABLE \`jwt_token_list\` ADD CONSTRAINT \`FK_42fc802833521b42e2fd85b827b\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`jwt_token_list\` DROP FOREIGN KEY \`FK_42fc802833521b42e2fd85b827b\``);
        await queryRunner.query(`ALTER TABLE \`jwt_token_list\` ADD CONSTRAINT \`FK_42fc802833521b42e2fd85b827b\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}

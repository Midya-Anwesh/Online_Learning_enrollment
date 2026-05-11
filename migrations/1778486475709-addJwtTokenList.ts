import { MigrationInterface, QueryRunner } from "typeorm";

export class AddJwtTokenList1778486475709 implements MigrationInterface {
    name = 'AddJwtTokenList1778486475709'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`jwt_token_list\` (\`id\` varchar(36) NOT NULL, \`tokenIdentifier\` varchar(255) NOT NULL, \`blockListed\` tinyint NOT NULL DEFAULT 0, \`userId\` varchar(36) NULL, UNIQUE INDEX \`UNC_user_token_unique\` (\`userId\`, \`tokenIdentifier\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`jwt_token_list\` ADD CONSTRAINT \`FK_42fc802833521b42e2fd85b827b\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`jwt_token_list\` DROP FOREIGN KEY \`FK_42fc802833521b42e2fd85b827b\``);
        await queryRunner.query(`DROP INDEX \`UNC_user_token_unique\` ON \`jwt_token_list\``);
        await queryRunner.query(`DROP TABLE \`jwt_token_list\``);
    }

}

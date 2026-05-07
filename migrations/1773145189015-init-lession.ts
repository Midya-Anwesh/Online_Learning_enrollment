import { MigrationInterface, QueryRunner } from "typeorm";

export class InitLession1773145189015 implements MigrationInterface {
    name = 'InitLession1773145189015'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`lessions\` (\`id\` varchar(36) NOT NULL, \`name\` text NOT NULL, \`code\` varchar(10) NOT NULL, \`description\` text NOT NULL, \`courseId\` varchar(36) NULL, UNIQUE INDEX \`lession_unq_constraint\` (\`code\`, \`courseId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`lessions\` ADD CONSTRAINT \`FK_da762c56632c49895a6b6aabb25\` FOREIGN KEY (\`courseId\`) REFERENCES \`courses\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`lessions\` DROP FOREIGN KEY \`FK_da762c56632c49895a6b6aabb25\``);
        await queryRunner.query(`DROP INDEX \`lession_unq_constraint\` ON \`lessions\``);
        await queryRunner.query(`DROP TABLE \`lessions\``);
    }

}

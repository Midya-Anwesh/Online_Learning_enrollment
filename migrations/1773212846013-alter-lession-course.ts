import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterLessionCourse1773212846013 implements MigrationInterface {
    name = 'AlterLessionCourse1773212846013'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`lessions\` DROP FOREIGN KEY \`FK_da762c56632c49895a6b6aabb25\``);
        await queryRunner.query(`ALTER TABLE \`lessions\` ADD CONSTRAINT \`FK_da762c56632c49895a6b6aabb25\` FOREIGN KEY (\`courseId\`) REFERENCES \`courses\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`lessions\` DROP FOREIGN KEY \`FK_da762c56632c49895a6b6aabb25\``);
        await queryRunner.query(`ALTER TABLE \`lessions\` ADD CONSTRAINT \`FK_da762c56632c49895a6b6aabb25\` FOREIGN KEY (\`courseId\`) REFERENCES \`courses\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}

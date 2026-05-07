import { MigrationInterface, QueryRunner } from "typeorm";

export class AltSchema1772645320241 implements MigrationInterface {
    name = 'AltSchema1772645320241'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` ADD UNIQUE INDEX \`IDX_97672ac88f789774dd47f7c8be\` (\`email\`)`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`unique_constraint_enrollment\` ON \`enrollments\` (\`userId\`, \`courseId\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`unique_constraint_enrollment\` ON \`enrollments\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP INDEX \`IDX_97672ac88f789774dd47f7c8be\``);
    }

}

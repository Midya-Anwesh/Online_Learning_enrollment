import { MigrationInterface, QueryRunner } from "typeorm";

export class InstructorSchema1772624465397 implements MigrationInterface {
    name = 'InstructorSchema1772624465397'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`instructors\` (\`id\` varchar(36) NOT NULL, \`instructorId\` varchar(36) NULL, \`courseId\` varchar(36) NULL, UNIQUE INDEX \`unique_constraint_instructor\` (\`instructorId\`, \`courseId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`instructors\` ADD CONSTRAINT \`FK_ff2c86217780548e32be09e013c\` FOREIGN KEY (\`instructorId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`instructors\` ADD CONSTRAINT \`FK_627c5745b13987b90ee5d543a7f\` FOREIGN KEY (\`courseId\`) REFERENCES \`courses\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`instructors\` DROP FOREIGN KEY \`FK_627c5745b13987b90ee5d543a7f\``);
        await queryRunner.query(`ALTER TABLE \`instructors\` DROP FOREIGN KEY \`FK_ff2c86217780548e32be09e013c\``);
        await queryRunner.query(`DROP INDEX \`unique_constraint_instructor\` ON \`instructors\``);
        await queryRunner.query(`DROP TABLE \`instructors\``);
    }

}

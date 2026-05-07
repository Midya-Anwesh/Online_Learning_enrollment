import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1772540603414 implements MigrationInterface {
    name = 'InitialSchema1772540603414'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`courses\` (\`id\` varchar(36) NOT NULL, \`title\` varchar(255) NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`enrollments\` (\`id\` varchar(36) NOT NULL, \`enrolledOn\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, \`userId\` varchar(36) NULL, \`courseId\` varchar(36) NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`users\` (\`id\` varchar(36) NOT NULL, \`name\` varchar(50) NOT NULL, \`role\` varchar(255) NOT NULL, \`email\` varchar(255) NOT NULL, \`password\` varchar(255) NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`users_courses_courses\` (\`usersId\` varchar(36) NOT NULL, \`coursesId\` varchar(36) NOT NULL, INDEX \`IDX_afff210a929f40d8cc1dea31a3\` (\`usersId\`), INDEX \`IDX_d326ad91159fe611ccc2890782\` (\`coursesId\`), PRIMARY KEY (\`usersId\`, \`coursesId\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`courses\` ADD \`code\` varchar(7) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`enrollments\` ADD CONSTRAINT \`FK_de33d443c8ae36800c37c58c929\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`enrollments\` ADD CONSTRAINT \`FK_60dd0ae4e21002e63a5fdefeec8\` FOREIGN KEY (\`courseId\`) REFERENCES \`courses\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`users_courses_courses\` ADD CONSTRAINT \`FK_afff210a929f40d8cc1dea31a36\` FOREIGN KEY (\`usersId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`users_courses_courses\` ADD CONSTRAINT \`FK_d326ad91159fe611ccc28907827\` FOREIGN KEY (\`coursesId\`) REFERENCES \`courses\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users_courses_courses\` DROP FOREIGN KEY \`FK_d326ad91159fe611ccc28907827\``);
        await queryRunner.query(`ALTER TABLE \`users_courses_courses\` DROP FOREIGN KEY \`FK_afff210a929f40d8cc1dea31a36\``);
        await queryRunner.query(`ALTER TABLE \`enrollments\` DROP FOREIGN KEY \`FK_60dd0ae4e21002e63a5fdefeec8\``);
        await queryRunner.query(`ALTER TABLE \`enrollments\` DROP FOREIGN KEY \`FK_de33d443c8ae36800c37c58c929\``);
        await queryRunner.query(`ALTER TABLE \`courses\` DROP COLUMN \`code\``);
        await queryRunner.query(`DROP INDEX \`IDX_d326ad91159fe611ccc2890782\` ON \`users_courses_courses\``);
        await queryRunner.query(`DROP INDEX \`IDX_afff210a929f40d8cc1dea31a3\` ON \`users_courses_courses\``);
        await queryRunner.query(`DROP TABLE \`users_courses_courses\``);
        await queryRunner.query(`DROP TABLE \`users\``);
        await queryRunner.query(`DROP TABLE \`enrollments\``);
        await queryRunner.query(`DROP TABLE \`courses\``);
    }

}

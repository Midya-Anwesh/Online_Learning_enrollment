import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config({path: `.env.${process.env.NODE_ENV}`});

let db_connection = {
    type: 'mysql',
    synchronize: false,
    migrations: [__dirname + '/migrations/*.{ts,js}'],
    cli: {
        migrationDir: 'migrations'
    }
}

switch (process.env.NODE_ENV){
    case 'development':
        db_connection = Object.assign(db_connection, {
            type: process.env.DB_TYPE,
            database: process.env.DB_NAME,
            username: process.env.USER_NAME,
            password: process.env.PASSWORD,
            entities: [__dirname + '/**/*.entity.{ts,js}']
        });
        break;
    default:
        console.log(`Unknown environment: ${process.env.NODE_ENV}`);
}

export const db_config = new DataSource((db_connection as DataSource["options"]));
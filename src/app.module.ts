import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { CoursesModule } from './courses/courses.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';

import { db_config } from 'datasource';
import { InstructorsModule } from './instructors/instructors.module';
import { SqlExceptionFilter } from './exceptionFilters/sql.exceptionFilter';
import { APP_FILTER } from '@nestjs/core';
import { CurrentUsersMiddleware } from './middlewares/current-user.middleware';
import { AuthModule } from './auth/auth.module';
import { LessionsModule } from './lessions/lessions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV}`
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory(configService: ConfigService) {
        return [{
          name: 'default',
          ttl: configService.get<number>('TTL') ?? 60000,
          limit: configService.get<number>('LIMIT') ?? 1,
          getTracker(req: any){
            return req.currUser?.sub ?? req.ip;
          }
        }]
      },
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<any>('JWT_EXPIRES_IN') || '1d'
        }
      })
    }),
    TypeOrmModule.forRoot(db_config.options),
    UsersModule, CoursesModule, EnrollmentsModule, InstructorsModule, AuthModule, LessionsModule
  ],
  controllers: [AppController],
  providers: [AppService,
    {
      provide: APP_FILTER,
      useClass: SqlExceptionFilter
    }
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer){
    consumer.apply(
      CurrentUsersMiddleware
    )
    .exclude(
      {path: 'auth/signup', method: RequestMethod.POST},
      {path: 'auth/login', method: RequestMethod.POST},
      {path: 'courses', method: RequestMethod.GET},
      {path: 'courses/stat', method: RequestMethod.GET},
      {path: 'courses/student_count', method: RequestMethod.GET},
      {path: 'coourses/lession_count', method: RequestMethod.GET}
    )
    .forRoutes('*');
  }
}

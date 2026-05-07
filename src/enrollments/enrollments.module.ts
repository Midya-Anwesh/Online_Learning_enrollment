import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';
import { CoursesModule } from '../courses/courses.module';
import { UsersModule } from '../users/users.module';
import { Enrollments } from './enrollments.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Enrollments])
    ,CoursesModule, UsersModule],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService]
})
export class EnrollmentsModule {}

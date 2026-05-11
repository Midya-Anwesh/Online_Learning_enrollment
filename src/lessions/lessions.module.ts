import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessionsService } from './lessions.service';
import { LessionsController } from './lessions.controller';
import { Lessions } from './lessions.entity';
import { CoursesModule } from '../courses/courses.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Lessions]), CoursesModule, UsersModule],
  providers: [LessionsService],
  controllers: [LessionsController]
})
export class LessionsModule {}

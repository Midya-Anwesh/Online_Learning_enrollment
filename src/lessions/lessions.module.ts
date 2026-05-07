import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessionsService } from './lessions.service';
import { LessionsController } from './lessions.controller';
import { Lessions } from './lessions.entity';
import { CoursesModule } from '../courses/courses.module';
import { Courses } from '../courses/courses.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Lessions, Courses]), CoursesModule],
  providers: [LessionsService],
  controllers: [LessionsController]
})
export class LessionsModule {}

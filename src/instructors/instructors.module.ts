import { forwardRef, Module } from '@nestjs/common';
import { InstructorsService } from './instructors.service';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Instructors } from './instructors.entity';
import { UsersModule } from '../users/users.module';
import { CoursesModule } from '../courses/courses.module';
import { InstructorsController } from './instructors.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Instructors]),
    UsersModule,
    forwardRef(() => CoursesModule)
  ],
  providers: [InstructorsService],
  exports: [InstructorsService],
  controllers: [InstructorsController]
})
export class InstructorsModule {}

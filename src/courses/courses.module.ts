import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Courses } from './courses.entity';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { InstructorsModule } from '../instructors/instructors.module';
@Module({
    imports: [
        TypeOrmModule.forFeature([Courses]),
        forwardRef(() => InstructorsModule)
    ],
    controllers: [CoursesController],
    providers: [CoursesService],
    exports: [CoursesService]
})
export class CoursesModule {}

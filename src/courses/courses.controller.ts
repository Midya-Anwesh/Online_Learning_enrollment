import { Controller, Post, Body, Delete, Param, Patch, UseGuards, Get, Query, Request } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dtos/create-course.dto';
import { UpdateCoursesDto } from './dtos/update-course.dto';
import { InstructorsDto } from '../instructors/dtos/assignOrRemove.instructors.dto';
import { Roles } from '../decorators/roles.decorators';
import { jwtAuthGuard } from '../guards/passport.jwt.guard';

@Controller('courses')
export class CoursesController {
    constructor(
        private coursesService: CoursesService
    ){}

    @Get()
    listAllCourses(@Query('term') term?: string){
        term ??= '_';
        return this.coursesService.getAllCourses(term);
    }

    @Get('stat')
    getCourseStat(@Query('courseId') courseId?: string, @Query('page') page?: string, @Query('limit') limit?: string, @Query('sort') sort?: string, @Query('order') order?: string){
        let [pageNo, pageLimit, doSort] = [parseInt(page ?? '1'), parseInt(limit ?? '10'), parseInt(sort ?? '1')];
        pageNo = (isNaN(pageNo))? 1 : pageNo;
        pageLimit = (isNaN(pageLimit))? 10 : pageLimit;
        if (doSort){
            order ??= "ASC";
            if (!(["ASC", "DESC"].includes(order))){
                order = "ASC";
            }
        }
        return this.coursesService.courseStat(courseId ?? '*', pageNo, pageLimit, Boolean(doSort), order as "ASC"|"DESC");
    }

    @Get('student_count')
    getStudentCount(@Query('id') id?: string){
        id ??= '*';
        return this.coursesService.getStudentCountPerCourse(id);
    }

    @Get('lession_count')
    getLessionCount(@Query('id') id?: string){
        return this.coursesService.getLessionCount(id ?? '*');
    }

    @Roles('admin', 'instructor')
    @UseGuards(jwtAuthGuard)
    @Post()
    createCourse(@Body() body: CreateCourseDto, @Request() req: any){
        return this.coursesService.createCourse(body, req.currUser);
    }

    @Roles('admin')
    @UseGuards(jwtAuthGuard)
    @Post('/:courseId/assign_instructors')
    addInstructors(@Param('courseId') courseId: string, @Body() body: InstructorsDto){
        return this.coursesService.addInstructors(courseId, body.instructorIds);
    }

    @Roles('admin', 'instructor')
    @UseGuards(jwtAuthGuard)
    @Patch()
    updateCourse(@Body() body: UpdateCoursesDto, @Request() req: any){
        return this.coursesService.updateCourse(body.id, body.newTitle, req.currUser as any);
    }

    @Roles('admin')
    @UseGuards(jwtAuthGuard)
    @Delete('/:id')
    deleteCourse(@Param('id') id: string){
        return this.coursesService.deleteCourse(id);
    }

    @Roles('admin')
    @UseGuards(jwtAuthGuard)
    @Delete('/:courseId/remove_instructors')
    removeInstructors(@Param('courseId') courseId: string, @Body() body: InstructorsDto){
        return this.coursesService.removeInstructors(courseId, body.instructorIds);
    }
}

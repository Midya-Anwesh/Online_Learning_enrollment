import { Controller, Get, UseGuards, Request, Param, Post } from '@nestjs/common';
import { InstructorsService } from './instructors.service';
import { Roles } from '../decorators/roles.decorators';
import { jwtAuthGuard } from '../guards/passport.jwt.guard';

@Controller('instructors')
export class InstructorsController {
    constructor(
        private instructorsService: InstructorsService
    ){}

    @Get('/:userId/courses')
    getCourses(@Param('userId') userId: string){
        return this.instructorsService.getCoursesByUser(userId);
    }
    
    @Roles('instructor', 'admin')
    @UseGuards(jwtAuthGuard)
    @Get('myCourses')
    myCourses(@Request() req: any){
        return this.instructorsService.getCoursesByUser(req.currUser.sub);
    }
}
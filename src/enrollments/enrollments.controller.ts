import { Controller, Post, Body, Get, Param, UseInterceptors, UseGuards, Request, Delete, Query } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dtos/create-enrollment.dto';
import { SerializeEnrollments } from './interceptors/serialize.enrollments.interceptor';
import { jwtAuthGuard } from 'src/guards/passport.jwt.guard';
import { Roles } from '../decorators/roles.decorators';
import type { Request as ExpressRequest} from 'express';

@Controller('enrollments')
export class EnrollmentsController {
    constructor(
        private enrollmentsService: EnrollmentsService
    ){}

    @Roles('admin')
    @UseGuards(jwtAuthGuard)
    @Get()
    getAllEnrollments(@Request() req: ExpressRequest){
        return this.enrollmentsService.getEnrollments('*', req.currUser);
    }

    @Roles('student', 'instructor', 'admin')
    @UseGuards(jwtAuthGuard)
    @Get('/:userId')
    getEnrollmentsByUser(@Param('userId') userId: string, @Request() req: ExpressRequest){
        return this.enrollmentsService.getEnrollments(userId, req.currUser);
    }

    @Roles('student', 'instructor', 'admin')
    @UseGuards(jwtAuthGuard)
    @UseInterceptors(SerializeEnrollments)
    @Post()
    createEnrollment(@Body() body: CreateEnrollmentDto, @Request() req: ExpressRequest){
        return this.enrollmentsService.createEnrollment(body, req.currUser);
    }

    @Roles('student', 'instructor', 'admin')
    @UseGuards(jwtAuthGuard)
    @Delete('/:courseId')
    unEnroll(@Param('courseId') courseId: string, @Request() req: ExpressRequest, @Query('userId') userId?: string){
        // By deault we prefer user is unenrolling themselves
        let userIdToDelete = userId ?? req.currUser.sub;
        return this.enrollmentsService.deleteEnrollment(courseId, userIdToDelete as string, req.currUser);
    }
}

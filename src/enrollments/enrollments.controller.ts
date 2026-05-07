import { Controller, Post, Body, Get, Param, UseInterceptors, UseGuards, Request, Delete, Query } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dtos/create-enrollment.dto';
import { SerializeEnrollments } from './interceptors/serialize.enrollments.interceptor';
import { RoleGuard } from '../guards/role.guard';
import { Roles } from '../decorators/roles.decorators';
import type { Request as ExpressRequest} from 'express';

@Controller('enrollments')
export class EnrollmentsController {
    constructor(
        private enrollmentsService: EnrollmentsService
    ){}

    @Get()
    getAllEnrollments(){
        return this.enrollmentsService.getEnrollments();
    }

    @Get('/:userId')
    getEnrollmentsByUser(@Param('userId') userId: string){
        return this.enrollmentsService.getEnrollments(userId);
    }

    @Roles('student', 'instructor', 'admin')
    @UseGuards(RoleGuard)
    @UseInterceptors(SerializeEnrollments)
    @Post()
    createEnrollment(@Body() body: CreateEnrollmentDto, @Request() req: ExpressRequest){
        return this.enrollmentsService.createEnrollment(body, req.currUser);
    }

    @Roles('student', 'instructor', 'admin')
    @UseGuards(RoleGuard)
    @Delete('/:courseId')
    unEnroll(@Param('courseId') courseId: string, @Request() req: ExpressRequest, @Query('userId') userId?: string){
        // By deault we prefer user is unenrolling themselves
        let [userIdToDelete, currUserRole] = [req.currUser?.sub, undefined as undefined|string];
        // If someone is trying to unenroll another user, we need to change which user to delete and also we need to send role of currently logged in user
        if (userId){
            [userIdToDelete, currUserRole] = [userId, req.currUser?.role];
        }
        return this.enrollmentsService.deleteEnrollment(courseId, userIdToDelete as string, currUserRole);
    }
}

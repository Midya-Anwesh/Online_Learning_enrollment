import { Controller, Post, Body, Get, Query, Patch, Delete, Param, UseGuards, Request } from '@nestjs/common';
import { LessionsService } from './lessions.service';
import { CreateLessionsDto } from './dtos/create-lessions.dto';
import { UpdateLessionsDto } from './dtos/update-lessions.dto';
import { Roles } from '../decorators/roles.decorators';
import { jwtAuthGuard } from 'src/guards/passport.jwt.guard';
import type { Request as ExpressRequest } from 'express';

@Controller('lessions')
export class LessionsController {
    constructor(
        private lessionsService: LessionsService
    ){}

    @Roles('student', 'instructor', 'admin')
    @UseGuards(jwtAuthGuard)
    @Get()
    getLessionsByCourses(@Request() req: ExpressRequest, @Query('courseId') courseId?: string){
        return this.lessionsService.getLessionsByCourse(courseId ?? '*', req.currUser);
    }

    @Roles('instructor', 'admin')
    @UseGuards(jwtAuthGuard)
    @Post()
    createLession(@Body() body: CreateLessionsDto, @Request() req: ExpressRequest){
        return this.lessionsService.createLession(body, req.currUser);
    }

    @Roles('admin', 'instructor')
    @UseGuards(jwtAuthGuard)
    @Patch()
    updateLession(@Body() body: UpdateLessionsDto, @Request() req: ExpressRequest){
        return this.lessionsService.updateLession(body, req.currUser);
    }

    @Roles('admin')
    @UseGuards(jwtAuthGuard)
    @Delete('/:id')
    deleteLession(@Param('id') id: string){
        return this.lessionsService.deleteLession(id);
    }
}

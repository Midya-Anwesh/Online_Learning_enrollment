import { Controller, Post, Body, Get, Query, Patch, Delete, Param, UseGuards, Request } from '@nestjs/common';
import { LessionsService } from './lessions.service';
import { CreateLessionsDto } from './dtos/create-lessions.dto';
import { UpdateLessionsDto } from './dtos/update-lessions.dto';
import { Roles } from '../decorators/roles.decorators';
import { RoleGuard } from '../guards/role.guard';
import type { Request as ExpressRequest } from 'express';

@Controller('lessions')
export class LessionsController {
    constructor(
        private lessionsService: LessionsService
    ){}

    @Get()
    getLessionsByCourses(@Query('courseId') courseId?: string){
        return this.lessionsService.getLessionsByCourse(courseId ?? '*');
    }

    @Roles('instructor', 'admin')
    @UseGuards(RoleGuard)
    @Post()
    createLession(@Body() body: CreateLessionsDto){
        return this.lessionsService.createLession(body);
    }

    @Roles('admin', 'instructor')
    @UseGuards(RoleGuard)
    @Patch()
    updateLession(@Body() body: UpdateLessionsDto, @Request() req: ExpressRequest){
        return this.lessionsService.updateLession(body, req.currUser);
    }

    @Roles('admin')
    @UseGuards(RoleGuard)
    @Delete('/:id')
    deleteLession(@Param('id') id: string){
        return this.lessionsService.deleteLession(id);
    }
}

import { Controller, Get, Body, Delete, Param, Patch, UseGuards, UseInterceptors, Request, Query, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUsersDto } from './dtos/update-user.dto';
import { jwtAuthGuard } from 'src/guards/passport.jwt.guard';
import { SerializeUsers } from './interceptors/serialize-user.interceptor';
import { Roles } from 'src/decorators/roles.decorators';
import type { Request as ExpressRequest } from 'express';
import { AssignUserRoleDto } from './dtos/assign-user-role.dto';
import { ThrottlerGuard } from '@nestjs/throttler';

@UseInterceptors(SerializeUsers)
@Controller('users')
export class UsersController {
    constructor(
        private usersService: UsersService
    ){}

    @Get()
    getUserByRole(@Query('role') role: string){
        return this.usersService.getUserByRole(role);
    }

    @Roles('student', 'instructor', 'admin')
    @UseGuards(jwtAuthGuard, ThrottlerGuard)
    @Patch()
    updateUser(@Body() body: UpdateUsersDto, @Request() req: ExpressRequest){
        return this.usersService.updateUser(body, req.currUser);
    }

    @Roles('student', 'instructor', 'admin')
    @UseGuards(jwtAuthGuard)
    @Get('enrolled_courses')
    myEnrolledCourses(@Request() req: any){
        return this.usersService.enrolledCourses(req.currUser.sub);
    }

    @Roles('admin')
    @UseGuards(jwtAuthGuard)
    @Post('assign_role')
    assignRole(@Body() body: AssignUserRoleDto){
        return this.usersService.assignRole(body);
    }

    @Roles('admin')
    @UseGuards(jwtAuthGuard)
    @Get('all')
    getAllUser(){
        return this.usersService.getAllUsers();
    }

    @Roles('student', 'instructor', 'admin')
    @UseGuards(jwtAuthGuard)
    @Get('profile')
    viewProfile(@Request() req: any){
        return this.usersService.viewProfile(req.currUser.sub);
    }
}

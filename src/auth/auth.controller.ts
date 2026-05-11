import { Controller, Post, Body, UseInterceptors, UseGuards, Request, Get, Delete, Req, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dtos/create-user.dto';
import { SerializeUsers } from '../users/interceptors/serialize-user.interceptor';
import { PassportLocalGuard } from '../guards/passport.local.guard';
import { Roles } from '../decorators/roles.decorators';
import { jwtAuthGuard } from '../guards/passport.jwt.guard';
import { UpdatePasswordDto } from './dtos/update-password.dto';
import type { Request as ExpressRequest } from 'express';

@UseInterceptors(SerializeUsers)
@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService
    ){}

    @Post('signup')
    signup(@Body() userObj: CreateUserDto){
        return this.authService.signup(userObj);
    }

    @UseGuards(PassportLocalGuard)
    @Post('login')
    login(@Request() req: any){
        return req.user;
    }

    @Roles('student', 'instructor', 'admin')
    @UseGuards(jwtAuthGuard)
    @Post('update_password')
    updatePassword(@Body() body: UpdatePasswordDto, @Request() req: ExpressRequest){
        return this.authService.updatePassword(body, req.currUser);
    }

    @Roles('student', 'instructor', 'admin')
    @UseGuards(jwtAuthGuard)
    @Get('me')
    whoAmI(@Request() req: ExpressRequest){
        return req.currUser;
    }

    @UseGuards(jwtAuthGuard)
    @Delete('delete')
    deleteUser(@Req() req: ExpressRequest, @Query('userId') userId: string){
        return this.authService.deleteUser(userId ?? req.currUser.sub, req.currUser);
    }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from 'argon2';

import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dtos/create-user.dto';
import { LoginUsersDto } from '../users/dtos/login-user.dto';
import { Users } from 'src/users/users.entity';
import type { Request as ExpressRequest } from 'express';
import { UpdatePasswordDto } from './dtos/update-password.dto';

@Injectable()
export class AuthService {
    constructor(
        private jwtService: JwtService,
        private usersService: UsersService
    ){}

    private async createSignedUser(user: Users){
        const payload = {
            sub: user.id,
            mail: user.email,
            role: user.role
        }
        const signedPayload = await this.jwtService.signAsync(payload);
        return Object.assign(payload, { accessToken: signedPayload });
    }

    async signup(userObj: CreateUserDto){
        userObj.password = await hash(userObj.password);
        const user = await this.usersService.createUser(userObj);
        return user;
    }

    async login(userObj: LoginUsersDto){
        const user = await this.usersService.findByEmail(userObj.email);
        if (!user){
            throw new NotFoundException(`No registered user found with email: ${userObj.email}`);
        }
        const isValid = await verify(user.password, userObj.password);
        if (!isValid){
            throw new BadRequestException(`Invalid email or password`);
        }
        return await this.createSignedUser(user);
    }

    async updatePassword(updatePasswordDto: UpdatePasswordDto, currUser: ExpressRequest["currUser"]){
        if ((updatePasswordDto.email !== currUser?.email) && (currUser?.role !== 'admin')){
            throw new BadRequestException(`Logged in users can only update their own password`);
        }
        const {email, oldPassword, newPassword} = updatePasswordDto;
        const user = await this.usersService.findByEmail(email);
        if (!user){
            throw new NotFoundException(`No registered users found with email: ${email}`);
        }
        if (!(await verify(user.password, oldPassword))){
            throw new BadRequestException(`Incorrect old password`);
        }
        user.password = await hash(newPassword);
        return this.usersService.saveUser(user);
    }
}

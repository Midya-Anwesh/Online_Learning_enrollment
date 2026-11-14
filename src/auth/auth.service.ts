import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { hash, verify } from 'argon2';

import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dtos/create-user.dto';
import { LoginUsersDto } from '../users/dtos/login-user.dto';
import type { Request as ExpressRequest } from 'express';
import { UpdatePasswordDto } from './dtos/update-password.dto';
import { JwtTokenSerive } from './jwtTokenList/jwtTokenService';
import { Users } from 'src/users/users.entity';
import { UpdateEmailDto } from './dtos/update-email.dto';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private tokenService: JwtTokenSerive
    ){}

    async signup(userObj: CreateUserDto){
        userObj.password = await hash(userObj.password);
        const user = await this.usersService.createUser(userObj);
        return user;
    }

    async validateUser(digest: string, password: string){
        return await verify(digest, password);
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
        const signedUser = await this.tokenService.createSignedUser(user);
        await this.tokenService.saveToken(signedUser.tokenIdentifier, signedUser.sub);
        return signedUser;
    }

    async updatePassword(updatePasswordObj: UpdatePasswordDto, currUser: ExpressRequest["currUser"]){
        const user = await this.usersService.findUser(currUser.sub);
        if (!user){
            throw new NotFoundException(`No registered users found with id: ${currUser.sub}`);
        }
        if ((updatePasswordObj.email !== user.email) && (user.role !== 'admin')){
            throw new BadRequestException(`Logged in users can only update their own password`);
        }
        const {oldPassword, newPassword} = updatePasswordObj;
        
        if (!(await verify(user.password, oldPassword))){
            throw new BadRequestException(`Incorrect old password`);
        }
        user.password = await hash(newPassword);
        await this.usersService.saveUser(user);
        await this.tokenService.blockToken('', currUser.sub, true);
        return this.login({
            email: user.email,
            password: updatePasswordObj.newPassword
        });
    }

    async deleteUser(userId: string, currUser: ExpressRequest["currUser"]){
        // If current user and the user to be deleted has different mail id, check if user trying to delete is an admin or not
        let user: Users | null = null;
        if (userId !== currUser.sub){
            user = await this.usersService.findUser(currUser.sub);
            if (!user){
                throw new BadRequestException(`Bad Token, login again...`);
            }
            if (user.role !== 'admin'){
                throw new BadRequestException(`Only admins have the permission to delete other users`);
            }
        }
        user = await this.usersService.findUser(userId);
        if (!user){
            throw new NotFoundException(`No user found with id: ${userId}`);
        }
        // Block all the tokens issued to the user to be deleted
        await this.tokenService.blockToken('', user.id, true);
        return this.usersService.remove(user);
    }

    async updateEmail( updateEmailObj: UpdateEmailDto, currUser: ExpressRequest["currUser"] ){

        // Check if new email available or not, if not raise exception
        if (await this.usersService.findByEmail(updateEmailObj.newEmail)){
            throw new BadRequestException(`User already exists with email: ${updateEmailObj.newEmail}`);
        }

        let user = await this.usersService.findUser(currUser.sub);
        if (!user){
            throw new BadRequestException(`Bad token.... please login again`);
        }
        // Check if current user trying to change their email
        // If not, then check if the current user admin or not
        if ( user.email !== updateEmailObj.oldEmail ){
            if (user.role !== 'admin'){
                throw new BadRequestException(`Only admins can change emails of other users`);
            }
            // Checge the user to be updated
            user = await this.usersService.findByEmail(updateEmailObj.oldEmail);
            if (!user){
                throw new NotFoundException(`No user found with email: ${updateEmailObj.oldEmail}`);
            }
        }

        // now update the user's email
        user.email = updateEmailObj.newEmail;
        const updatedUser = await this.usersService.saveUser(user);
        await this.tokenService.blockToken('', user.id, true);
        return updatedUser;
    }
}

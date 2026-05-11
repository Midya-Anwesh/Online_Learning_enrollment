import { AuthGuard } from "@nestjs/passport";
import { Reflector } from "@nestjs/core";
import { ExecutionContext, NotFoundException } from "@nestjs/common";
import type { Request as ExpressRequest } from "express";
import { UsersService } from "../users/users.service";
import { Injectable } from "@nestjs/common";

@Injectable()
export class jwtAuthGuard extends AuthGuard('jwt'){
    constructor(
        private usersSerivce: UsersService,
        private reflector: Reflector
    ){
        super({
            property: 'currUser'
        })
    }

    async canActivate(context: ExecutionContext) {
        await super.canActivate(context);
        const req: ExpressRequest = context.switchToHttp().getRequest();
        const payload = req.currUser;
        const usr = await this.usersSerivce.findUser(payload.sub);
        if (!usr){
            throw new NotFoundException(`No registered user found: Bad token, login again...`);
        }
        // Get All Roles
        const roles =  this.reflector.getAllAndOverride('roles', [
            context.getHandler(),
            context.getClass()
        ]);

        // If no roles are specified grant access
        if (!roles){
            return true;
        }
        // Check if the user has valid role to access
        return roles.includes(usr.role);
    }
}
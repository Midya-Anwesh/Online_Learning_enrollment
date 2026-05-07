import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";

declare global{
    namespace Express{
        interface Request{
            currUser?: {sub: string, role: string, name: string, email: string}
        }
    }
}

@Injectable()
export class RoleGuard implements CanActivate{
    constructor(
        private reflector: Reflector
    ){}
    async canActivate(context: ExecutionContext){
        const ctx = context.switchToHttp();
        const req = ctx.getRequest<Request>();
        const currUser = req.currUser;
        if (!currUser){
            return false;
        }
        return this.reflector.get('roles', context.getHandler()).includes(currUser.role);
    }
}
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Request } from "express";

@Injectable()
export class AdminGuard implements CanActivate{
    constructor(){}
    async canActivate(context: ExecutionContext){
        const ctx = context.switchToHttp();
        const req = ctx.getRequest<Request>();
        const currUser = req.currUser;
        if (!currUser){
            return false;
        }
        return currUser.role === "admin";
    }
}
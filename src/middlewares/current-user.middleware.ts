import { NestMiddleware, Injectable, BadRequestException } from "@nestjs/common";
import { NextFunction } from "express";
import { JsonWebTokenError, JwtService } from "@nestjs/jwt";

@Injectable()
export class CurrentUsersMiddleware implements NestMiddleware {
    constructor(
        private jwtService: JwtService
    ){}
    async use(req: any, res: any, next: NextFunction) {
        const authorization = req.headers.authorization;
        if (authorization){
            const accessToken = authorization.split(' ')[1];
            try{
                const userPayload = await this.jwtService.verifyAsync(accessToken);
                req.currUser = userPayload;
            }
            catch(err){
                throw new BadRequestException((err as JsonWebTokenError).message)
            }
        }
        next();
    }
}
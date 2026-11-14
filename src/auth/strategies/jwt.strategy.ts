import { Strategy, ExtractJwt } from 'passport-jwt'
import { PassportStrategy } from '@nestjs/passport'
import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtTokenSerive } from '../jwtTokenList/jwtTokenService'
import type { Request as ExpressRequest } from 'express'

@Injectable()
export class jwtValidationStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(
        configService: ConfigService,
        private tokenService: JwtTokenSerive
    ){
        super({
            ignoreExpiration: false,
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: configService.getOrThrow<string>('JWT_SECRET')
        })
    }
    async validate(payload: ExpressRequest["currUser"]) {
        if (!payload){
            throw new BadRequestException(`Bad / missing jwt token, please login again...`);
        }
        if (await this.tokenService.isBlocked(payload.tokenIdentifier, payload.sub)){
            throw new BadRequestException(`Blocklisted token, please login again for new one...`);
        }

        return payload;
    }
}
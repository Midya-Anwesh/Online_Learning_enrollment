import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { AuthService } from '../auth.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local'){
    constructor(
        private authService: AuthService
    ){
        super({
            usernameField: 'email'
        })
    }

    async validate(username: string, password: string){
        const currUser = await this.authService.login({
            email: username,
            password: password
        });
        return currUser;
    }
}
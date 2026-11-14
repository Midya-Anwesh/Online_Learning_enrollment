import { Repository } from "typeorm";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { JwtTokenList } from "./jwtTokenList.entity";
import { Users } from "../../users/users.entity";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "crypto";
import { UsersService } from "../../users/users.service";

declare global{
    namespace Express{
        interface Request{
            currUser: {sub: string, tokenIdentifier: string}
        }
    }
}

@Injectable()
export class JwtTokenSerive {
    constructor(
        @InjectRepository(JwtTokenList) private jwtRepo: Repository<JwtTokenList>,
        private jwtService: JwtService,
        private usersService: UsersService
    ){}

    async createSignedUser(user: Users){
        const payload = {
            sub: user.id,
            tokenIdentifier: randomUUID(),
            mail: user.email,
            role: user.role
        }
        const signedPayload = await this.jwtService.signAsync(payload);
        return Object.assign(payload, { accessToken: signedPayload });
    }

    async saveToken(tokenIdentifier: string, userId: string){
        const user = await this.usersService.findUser(userId);
        if (!user){
            throw new NotFoundException(`No user entry found with id: ${userId}`);
        }
        const token = this.jwtRepo.create({
            tokenIdentifier,
            user,
            blockListed: false
        });
        return await this.jwtRepo.save(token);
    }

    async findToken(tokenIdentifier: string, userId: string){
        return await this.jwtRepo.findOne({
            where: {
                tokenIdentifier,
                user: {
                    id: userId
                }
            },
            select: {
                id: true,
                tokenIdentifier: true,
                blockListed: true,
                user: true
            }
        });
    }

    async isBlocked(tokenIdentifier: string, userId: string){
        const token = await this.findToken(tokenIdentifier, userId);
        if (!token){
            throw new NotFoundException(`No token entry found, please login again...`)
        }
        return token.blockListed;
    }

    async blockToken(tokenIdentifier: string, userId: string, all: boolean){
        // If all set to false just block the specified token
        if (!all){
            const token = await this.findToken(tokenIdentifier, userId);
            if (!token){
                throw new BadRequestException(`No token found to block...`);
            }
            token.blockListed = true;
            return await this.jwtRepo.save(token);
        }

        // Otherwise ignore tokenIdentifier and block all issued token to a user
        return await this.jwtRepo.createQueryBuilder('jwtToken')
                .update()
                .set({blockListed: true})
                .where('userId = :userId', {userId})
                .execute();
    }
}
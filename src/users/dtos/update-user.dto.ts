import { IsString, IsEmail, IsOptional } from "class-validator";

export class UpdateUsersDto{
    @IsEmail()
    oldEmail: string;

    @IsOptional()
    @IsString()
    name: string;

    @IsOptional()
    @IsEmail()
    email: string;
}
import { IsString, IsEmail, IsIn, IsOptional } from "class-validator";

export class CreateUserDto {
    @IsString()
    name: string;
    
    @IsOptional()
    @IsIn(['student'])
    role?: string;

    @IsEmail()
    email: string;

    @IsString()
    password: string;
}
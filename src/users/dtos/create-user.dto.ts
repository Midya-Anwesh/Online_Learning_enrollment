import { IsString, IsEmail, IsIn } from "class-validator";

export class CreateUserDto {
    @IsString()
    name: string;
    
    @IsString()
    @IsIn(['admin', 'instructor', 'student'])
    role: string;

    @IsEmail()
    email: string;

    @IsString()
    password: string;
}
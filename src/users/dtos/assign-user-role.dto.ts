import { IsEmail, IsString, IsIn } from "class-validator";

export class AssignUserRoleDto {
    @IsEmail()
    email: string;

    @IsString()
    @IsIn(['student', 'instructor', 'admin'])
    role: string;
}
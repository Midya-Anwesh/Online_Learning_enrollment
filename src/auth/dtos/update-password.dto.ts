import { IsString } from "class-validator";

export class UpdatePasswordDto {
    @IsString()
    email: string;

    @IsString()
    oldPassword: string;

    @IsString()
    newPassword: string;
}
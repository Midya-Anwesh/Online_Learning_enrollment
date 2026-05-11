import { IsString, IsEmail } from "class-validator";

export class UpdateEmailDto {
    @IsEmail()
    oldEmail: string;

    @IsEmail()
    newEmail: string;
}
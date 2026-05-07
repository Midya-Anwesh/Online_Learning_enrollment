import { IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateLessionsDto{
    @IsString()
    @MinLength(1)
    name: string;

    @IsString()
    @MinLength(1)
    @MaxLength(10)
    code: string;

    @IsString()
    @MinLength(1)
    desc: string;

    @IsUUID()
    courseId: string;
}
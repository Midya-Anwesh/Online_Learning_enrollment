import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class UpdateLessionsDto{
    @IsUUID()
    id: string;

    @IsOptional()
    @IsString()
    @MinLength(1)
    name: string;

    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(10)
    code: string;

    @IsOptional()
    @IsString()
    @MinLength(1)
    desc: string;
}
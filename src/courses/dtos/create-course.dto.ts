import { IsString, IsArray, IsUUID, ArrayMinSize, ArrayUnique } from "class-validator";

export class CreateCourseDto {
    @IsString()
    title: string;

    @IsArray()
    @IsUUID('all', {each: true})
    @ArrayMinSize(1)
    @ArrayUnique()
    instructors: string[];
}
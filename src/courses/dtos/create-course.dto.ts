import { IsString, IsArray, IsUUID, ArrayMinSize } from "class-validator";

export class CreateCourseDto {
    @IsString()
    title: string;

    @IsArray()
    @IsUUID('all', {each: true})
    @ArrayMinSize(1)
    instructors: string[];
}
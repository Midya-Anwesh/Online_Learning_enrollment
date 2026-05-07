import { IsUUID, IsString } from "class-validator";

export class UpdateCoursesDto {
    @IsUUID()
    id: string;

    @IsString()
    newTitle: string;
}
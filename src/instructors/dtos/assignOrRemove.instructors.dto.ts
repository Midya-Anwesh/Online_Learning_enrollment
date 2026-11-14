import { IsUUID, IsArray, ArrayMinSize, ArrayUnique } from "class-validator";

export class InstructorsDto{
    @IsArray()
    @ArrayMinSize(1)
    @ArrayUnique()
    @IsUUID('all', {each: true})
    instructorIds: string[]
}
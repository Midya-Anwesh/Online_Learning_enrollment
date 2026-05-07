import { IsUUID, MinLength } from "class-validator";

export class InstructorsDto{
    @IsUUID('all', {each: true})
    instructorIds: string[]
}
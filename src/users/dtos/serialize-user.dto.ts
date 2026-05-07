import { Expose } from "class-transformer";
import { MinLength } from "class-validator";

export class SerializeUsersDto {
    @Expose()
    accessToken?: string;

    @Expose()
    sub?: string;

    @Expose()
    mail?: string;

    @Expose()
    name: string;

    @Expose()
    email: string;

    @Expose()
    role: string;

    @Expose()
    "Course Title"?: string;

    @Expose()
    "Enrollment Date"?: Date;

    @Expose()
    @MinLength(1)
    "created courses"?: string[];

    @Expose()
    @MinLength(1)
    "enrolled courses"?: {
        'Course Title': string;
        'Enrollment Date': Date;
    }
}
import { Expose, Type } from "class-transformer";
import { SerializeUsersDto } from "../../users/dtos/serialize-user.dto";

class CourseDto{
    @Expose()
    id: string;
    @Expose()
    title: string;
}

export class SerializeEnrollmentsDto{
    @Expose()
    id: string;

    @Expose()
    enrolledOn: Date;

    @Expose()
    @Type(() => SerializeUsersDto)
    user;

    @Expose()
    @Type(() => CourseDto)
    course;
}
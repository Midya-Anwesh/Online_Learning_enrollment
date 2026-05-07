import { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import { plainToClass } from "class-transformer";
import { map } from "rxjs/operators";
import { SerializeEnrollmentsDto } from "../dtos/serialize-enrollment.dto";

export class SerializeEnrollments implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler<any>) {
        return next.handle().pipe(
            map((data: any) => {
                return plainToClass(SerializeEnrollmentsDto, data, {excludeExtraneousValues: true});
            })
        )
    }
}
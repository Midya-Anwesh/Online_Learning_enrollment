import { NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { plainToClass } from "class-transformer";
import { map } from "rxjs/operators";
import { SerializeUsersDto } from "../dtos/serialize-user.dto";

export class SerializeUsers implements NestInterceptor{
    intercept(context: ExecutionContext, next: CallHandler<any>){
        return next.handle().pipe(
            map((data: any) => plainToClass(SerializeUsersDto, data, {excludeExtraneousValues: true}))
        );
    }
}
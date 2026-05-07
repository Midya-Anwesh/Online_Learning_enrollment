import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from "@nestjs/common";
import { QueryFailedError } from "typeorm";
import { Response } from "express";

@Catch(QueryFailedError)
export class SqlExceptionFilter implements ExceptionFilter {
    catch(exception: QueryFailedError, host: ArgumentsHost) {
        const response = host.switchToHttp().getResponse<Response>();
        return response
        .status(HttpStatus.BAD_REQUEST)
        .json({
            msg: exception.message,
            sql_err_code: exception.driverError["errno"],
            sql_err: exception.driverError["code"]
        })
    }
}
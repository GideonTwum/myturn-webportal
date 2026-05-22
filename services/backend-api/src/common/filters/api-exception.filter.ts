import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Response } from "express";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ url?: string }>();
    const path = request.url ?? "";
    const wrapped = path.includes("/member") || path.includes("/auth/otp");

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : "Internal server error";

    let message = "Request failed";
    let code: string | undefined;

    if (typeof exceptionResponse === "string") {
      message = exceptionResponse;
    } else if (
      typeof exceptionResponse === "object" &&
      exceptionResponse !== null
    ) {
      const body = exceptionResponse as {
        message?: string | string[];
        error?: string;
        code?: string;
      };
      if (typeof body.message === "string") message = body.message;
      else if (Array.isArray(body.message)) message = body.message.join(", ");
      else if (body.error) message = body.error;
      code = body.code;
    }

    if (!(exception instanceof HttpException)) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    if (wrapped) {
      response.status(status).json({
        success: false,
        message,
        code,
        statusCode: status,
      });
      return;
    }

    if (exception instanceof HttpException) {
      response.status(status).json(exceptionResponse);
      return;
    }

    response.status(status).json({
      statusCode: status,
      message: "Internal server error",
    });
  }
}

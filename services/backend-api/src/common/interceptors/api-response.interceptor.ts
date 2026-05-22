import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { map, Observable } from "rxjs";
import { API_WRAPPED_KEY } from "../decorators/api-wrapped.decorator";

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const wrapped = this.reflector.getAllAndOverride<boolean>(API_WRAPPED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!wrapped) {
      return next.handle();
    }
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
      })),
    );
  }
}

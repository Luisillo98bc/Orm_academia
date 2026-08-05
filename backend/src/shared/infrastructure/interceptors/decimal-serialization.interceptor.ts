import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable, map } from 'rxjs';

function serializeDecimals(value: unknown): unknown {
  if (Prisma.Decimal.isDecimal(value)) return value.toFixed(2);
  if (Array.isArray(value)) return value.map(serializeDecimals);
  if (
    value &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        serializeDecimals(item),
      ]),
    );
  }
  return value;
}

@Injectable()
export class DecimalSerializationInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(map(serializeDecimals));
  }
}

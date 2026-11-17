import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request } from 'express';
import { AuditService } from './audit.service';

interface AuditUser {
  id?: string;
}

type AuditRequest = Request<
  Record<string, string>,
  unknown,
  unknown,
  Record<string, string>
> & {
  user?: AuditUser;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'dni',
  'salary',
  'amount',
  'token',
  'tokenId',
  'email',
  'phone',
  'address',
  'district',
  'province',
  'department',
  'profilePicture',
  'message',
  'content',
]);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuditRequest>();
    const method = String(request.method || '').toUpperCase();
    const path = String(request.path || request.url || '');
    const auditable =
      method !== 'GET' &&
      [
        '/academic',
        '/evaluations',
        '/rrhh',
        '/payments',
        '/users',
        '/certificates',
        '/settings',
        '/prospects',
        '/support',
      ].some((prefix) => path.includes(prefix));
    const auditUser = request.user;
    if (!auditable || !auditUser?.id) return next.handle();
    const startedAt = Date.now();
    const safeBody = Object.fromEntries(
      Object.entries(asRecord(request.body)).map(([key, value]) => [
        key,
        SENSITIVE_KEYS.has(key) ? '[REDACTED]' : value,
      ]),
    );
    const safeParams = Object.fromEntries(
      Object.entries(asRecord(request.params)).map(([key, value]) => [
        key,
        SENSITIVE_KEYS.has(key) ? '[REDACTED]' : value,
      ]),
    );
    const safeQuery = Object.fromEntries(
      Object.entries(asRecord(request.query)).map(([key, value]) => [
        key,
        SENSITIVE_KEYS.has(key) ? '[REDACTED]' : value,
      ]),
    );
    return next.handle().pipe(
      tap((response: unknown) => {
        const responseSummary =
          response && typeof response === 'object'
            ? { keys: Object.keys(response).slice(0, 25) }
            : { type: typeof response };
        void this.audit.log(
          {
            userId: auditUser.id,
            ipAddress: request.ip,
            userAgent: request.headers?.['user-agent'],
          },
          `${method}_${path
            .split('?')[0]
            .replace(/^.*api\/v1\//, '')
            .replace(/[^a-z0-9]+/gi, '_')
            .toUpperCase()}`.slice(0, 100),
          path.includes('/rrhh')
            ? 'RRHH'
            : path.includes('/evaluations')
              ? 'Evaluation'
              : path.includes('/payments')
                ? 'Payments'
                : path.includes('/users')
                  ? 'Users'
                  : path.includes('/certificates')
                    ? 'Certificates'
                    : path.includes('/settings')
                      ? 'Settings'
                      : path.includes('/prospects')
                        ? 'Prospects'
                        : path.includes('/support')
                          ? 'Support'
                          : 'Academic',
          request.params?.id ||
            request.params?.moduleId ||
            request.params?.workerId,
          undefined,
          {
            body: safeBody,
            params: safeParams,
            query: safeQuery,
            response: responseSummary,
            durationMs: Date.now() - startedAt,
          },
        );
      }),
    );
  }
}

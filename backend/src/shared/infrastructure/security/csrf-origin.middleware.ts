import type { NextFunction, Request, Response } from 'express';
import { Injectable, type NestMiddleware } from '@nestjs/common';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Defensa CSRF para la autenticación basada en cookies.
 *
 * Solo se activa en producción. Las peticiones que mutan estado deben venir
 * del frontend configurado mediante Origin o Referer. El webhook de Culqi se
 * excluye porque es una integración servidor-a-servidor y no usa cookies.
 */
@Injectable()
export class CsrfOriginMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    if (process.env.NODE_ENV !== 'production') {
      next();
      return;
    }

    if (SAFE_METHODS.has(request.method)) {
      next();
      return;
    }

    if (request.path.endsWith('/payments/webhook/culqi')) {
      next();
      return;
    }

    const allowedOrigins = this.allowedOrigins();
    const requestOrigin = this.requestOrigin(request);

    if (requestOrigin && allowedOrigins.has(requestOrigin)) {
      next();
      return;
    }

    response.status(403).json({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Origen de la solicitud no permitido',
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private allowedOrigins(): Set<string> {
    const configured = [
      process.env.CORS_ORIGIN ?? '',
      process.env.FRONTEND_URL ?? '',
    ]
      .flatMap((value) => value.split(','))
      .map((value) => value.trim().replace(/\/$/, ''))
      .filter((value) => value && value !== '*');

    return new Set(configured);
  }

  private requestOrigin(request: Request): string | null {
    const origin = request.header('origin');
    if (origin) return origin.replace(/\/$/, '');

    const referer = request.header('referer');
    if (!referer) return null;

    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }
}

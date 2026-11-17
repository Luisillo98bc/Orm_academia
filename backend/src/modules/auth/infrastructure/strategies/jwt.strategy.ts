// ============================================================================
// JwtStrategy — Estrategia de validación de tokens JWT
// ============================================================================

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { ACCESS_COOKIE_NAME, readCookie } from '../auth-cookies.service';
import type { Request } from 'express';
import { RefreshSessionService } from '../refresh-session.service';

/**
 * Payload decodificado del JWT.
 */
interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  sid?: string;
}

/**
 * Estrategia Passport para validar tokens JWT en cada request protegido.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly sessions: RefreshSessionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => {
          const queryToken = req?.query?.token;
          if (
            typeof queryToken === 'string' &&
            queryToken.trim() &&
            req.path?.endsWith('/storage/download')
          ) {
            return queryToken.trim();
          }
          return null;
        },
        (req: Request) => {
          return readCookie(req.headers.cookie, ACCESS_COOKIE_NAME);
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_SECRET',
        'default-secret-change-me',
      ),
    });
  }

  /**
   * Método invocado automáticamente por Passport tras decodificar el JWT.
   * El objeto retornado se inyecta en `req.user`.
   */
  validate(payload: JwtPayload) {
    if (!payload.sub) {
      throw new UnauthorizedException('Token inválido');
    }

    return this.sessions.validateAccessClaims(payload);
  }
}

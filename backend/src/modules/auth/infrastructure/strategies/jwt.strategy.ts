// ============================================================================
// JwtStrategy — Estrategia de validación de tokens JWT
// ============================================================================

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { ACCESS_COOKIE_NAME, readCookie } from '../auth-cookies.service';
import type { Request } from 'express';

/**
 * Payload decodificado del JWT.
 */
interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
}

/**
 * Estrategia Passport para validar tokens JWT en cada request protegido.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          return readCookie(req.headers.cookie, ACCESS_COOKIE_NAME);
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
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

    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles,
      permissions: payload.permissions,
    };
  }
}

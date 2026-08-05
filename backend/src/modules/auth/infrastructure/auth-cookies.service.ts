import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response, CookieOptions } from 'express';

export const ACCESS_COOKIE_NAME = 'av_access';
export const REFRESH_COOKIE_NAME = 'av_refresh';

export function readCookie(
  cookieHeader: string | undefined,
  name: string,
): string | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;

    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }

  return null;
}

function durationToMilliseconds(value: string, fallback: number): number {
  const match = /^(\d+)(s|m|h|d)$/i.exec(value.trim());
  if (!match) return fallback;

  const amount = Number(match[1]);
  const multipliers = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return (
    amount * multipliers[match[2].toLowerCase() as keyof typeof multipliers]
  );
}

@Injectable()
export class AuthCookiesService {
  private readonly secure: boolean;
  private readonly sameSite: 'lax' | 'strict' | 'none';
  private readonly accessMaxAge: number;
  private readonly refreshMaxAge: number;

  constructor(private readonly config: ConfigService) {
    this.secure =
      this.config.get('COOKIE_SECURE') === 'true' ||
      this.config.get('NODE_ENV') === 'production';
    this.sameSite = this.config.get<'lax' | 'strict' | 'none'>(
      'COOKIE_SAME_SITE',
      'lax',
    );
    this.accessMaxAge = durationToMilliseconds(
      this.config.get('JWT_EXPIRES_IN', '15m'),
      15 * 60_000,
    );
    this.refreshMaxAge =
      Number(this.config.get('REFRESH_TOKEN_TTL_DAYS', 30)) * 86_400_000;
  }

  getAccessToken(request: Request): string | null {
    return readCookie(request.headers.cookie, ACCESS_COOKIE_NAME);
  }

  getRefreshToken(request: Request): string | null {
    return readCookie(request.headers.cookie, REFRESH_COOKIE_NAME);
  }

  set(response: Response, accessToken: string, refreshToken: string): void {
    response.cookie(ACCESS_COOKIE_NAME, accessToken, {
      ...this.baseOptions(),
      path: '/',
      maxAge: this.accessMaxAge,
    });
    response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      ...this.baseOptions(),
      path: '/api/v1/auth',
      maxAge: this.refreshMaxAge,
    });
  }

  clear(response: Response): void {
    response.clearCookie(ACCESS_COOKIE_NAME, {
      ...this.baseOptions(),
      path: '/',
    });
    response.clearCookie(REFRESH_COOKIE_NAME, {
      ...this.baseOptions(),
      path: '/api/v1/auth',
    });
  }

  private baseOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.secure,
      sameSite: this.sameSite,
    };
  }
}

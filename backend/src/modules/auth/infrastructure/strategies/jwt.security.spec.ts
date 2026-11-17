import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../guards/optional-jwt-auth.guard';
import type { ConfigService } from '@nestjs/config';

describe('JWT strategy and guards', () => {
  it('validates payloads and rejects missing subjects', () => {
    const sessions = {
      validateAccessClaims: jest.fn().mockReturnValue({
        id: 'user-1',
        email: 'user@example.com',
        roles: ['ADMIN'],
        permissions: ['users:read'],
      }),
    };
    const strategy = new JwtStrategy(
      {
        get: jest.fn().mockReturnValue('secret'),
      } as unknown as ConfigService,
      sessions as never,
    );
    expect(
      strategy.validate({
        sub: 'user-1',
        email: 'user@example.com',
        roles: ['ADMIN'],
        permissions: ['users:read'],
      }),
    ).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      roles: ['ADMIN'],
      permissions: ['users:read'],
    });
    expect(() =>
      strategy.validate({ sub: '', email: '', roles: [], permissions: [] }),
    ).toThrow(UnauthorizedException);
    expect(sessions.validateAccessClaims).toHaveBeenCalledTimes(1);
  });

  it('allows public JWT routes without invoking passport', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) };
    const guard = new JwtAuthGuard(reflector as unknown as Reflector);
    const context = { getHandler: jest.fn(), getClass: jest.fn() };
    expect(guard.canActivate(context as never)).toBe(true);
  });

  it('allows optional authentication when passport rejects', async () => {
    const guard = new OptionalJwtAuthGuard();
    const parent = Object.getPrototypeOf(OptionalJwtAuthGuard.prototype) as {
      canActivate: jest.Mock;
    };
    const original = parent.canActivate;
    parent.canActivate = jest
      .fn()
      .mockRejectedValue(new Error('invalid token'));
    await expect(guard.canActivate({} as never)).resolves.toBe(true);
    parent.canActivate = original;
  });

  it('returns the passport result when optional authentication succeeds', async () => {
    const guard = new OptionalJwtAuthGuard();
    const parent = Object.getPrototypeOf(OptionalJwtAuthGuard.prototype) as {
      canActivate: jest.Mock;
    };
    const original = parent.canActivate;
    parent.canActivate = jest.fn().mockResolvedValue(true);
    await expect(guard.canActivate({} as never)).resolves.toBe(true);
    parent.canActivate = original;
  });
});

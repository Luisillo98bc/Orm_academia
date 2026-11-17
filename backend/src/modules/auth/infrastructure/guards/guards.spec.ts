import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { PermissionsGuard } from './permissions.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from '../strategies/jwt.strategy';

const context = (user?: { roles?: string[]; permissions?: string[] }) => ({
  getHandler: jest.fn(),
  getClass: jest.fn(),
  switchToHttp: () => ({ getRequest: () => ({ user }) }),
});

describe('Authorization guards', () => {
  it('allows or denies roles according to metadata and request user', () => {
    const reflector = { getAllAndOverride: jest.fn() };
    const guard = new RolesGuard(reflector as unknown as Reflector);
    reflector.getAllAndOverride.mockReturnValueOnce(undefined);
    expect(guard.canActivate(context() as never)).toBe(true);
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    expect(guard.canActivate(context() as never)).toBe(false);
    expect(guard.canActivate(context({ roles: ['ESTUDIANTE'] }) as never)).toBe(
      false,
    );
    expect(guard.canActivate(context({ roles: ['ADMIN'] }) as never)).toBe(
      true,
    );
  });

  it('allows admin permissions and validates regular user permissions', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['reports:read']),
    };
    const guard = new PermissionsGuard(reflector as unknown as Reflector);
    expect(guard.canActivate(context() as never)).toBe(false);
    expect(
      guard.canActivate(
        context({ roles: ['ESTUDIANTE'], permissions: [] }) as never,
      ),
    ).toBe(false);
    expect(
      guard.canActivate(
        context({
          roles: ['ESTUDIANTE'],
          permissions: ['reports:read'],
        }) as never,
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        context({ roles: ['ADMIN'], permissions: [] }) as never,
      ),
    ).toBe(true);
    reflector.getAllAndOverride.mockReturnValue([]);
    expect(guard.canActivate(context() as never)).toBe(true);
  });

  it('bypasses public routes and delegates protected routes to Passport', () => {
    const reflector = { getAllAndOverride: jest.fn() };
    const guard = new JwtAuthGuard(reflector as unknown as Reflector);
    reflector.getAllAndOverride.mockReturnValueOnce(true);
    expect(guard.canActivate(context() as never)).toBe(true);

    const parent = Object.getPrototypeOf(JwtAuthGuard.prototype) as {
      canActivate: (value: unknown) => boolean;
    };
    const delegated = jest.spyOn(parent, 'canActivate').mockReturnValue(true);
    reflector.getAllAndOverride.mockReturnValueOnce(false);
    expect(guard.canActivate(context() as never)).toBe(true);
    expect(delegated).toHaveBeenCalled();
    delegated.mockRestore();
  });

  it('reads cookie JWTs and validates payloads', () => {
    const strategy = new JwtStrategy(
      {
        get: jest.fn((_key: string, fallback: string) => fallback),
      } as never,
      {
        validateAccessClaims: jest.fn().mockReturnValue({
          id: 'user-1',
          email: 'user@example.com',
          roles: ['ADMIN'],
          permissions: ['read'],
        }),
      } as never,
    );
    const extractor = (
      strategy as unknown as {
        _jwtFromRequest: (request: {
          headers: { cookie?: string };
        }) => string | null;
      }
    )._jwtFromRequest;
    expect(extractor({ headers: { cookie: 'av_access=cookie-token' } })).toBe(
      'cookie-token',
    );
    expect(
      strategy.validate({
        sub: 'user-1',
        email: 'user@example.com',
        roles: ['ADMIN'],
        permissions: ['read'],
      }),
    ).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      roles: ['ADMIN'],
      permissions: ['read'],
    });
  });
});

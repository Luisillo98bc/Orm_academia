import { createHash } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { RefreshSessionService } from './refresh-session.service';

describe('Refresh session security', () => {
  const sid = 'a'.repeat(64);
  const session = () => ({
    userId: 'user-1',
    revokedAt: null as Date | null,
    expiresAt: new Date(Date.now() + 60_000),
    user: {
      id: 'user-1',
      email: 'current@example.com',
      isActive: true,
      deletedAt: null as Date | null,
      roles: [
        {
          role: {
            name: 'ESTUDIANTE',
            permissions: [
              { permission: { subject: 'courses', action: 'read' } },
            ],
          },
        },
      ],
    },
  });
  const setup = () => {
    const prisma = {
      refreshSession: {
        findUnique: jest.fn().mockResolvedValue(session()),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(),
    };
    const jwt = {
      verifyAsync: jest.fn(),
      signAsync: jest.fn().mockResolvedValue('bound-access'),
    };
    return {
      prisma,
      jwt,
      service: new RefreshSessionService(
        prisma as never,
        jwt as never,
        { get: () => 30 } as never,
      ),
    };
  };

  it('uses current roles and permissions instead of trusting stale JWT claims', async () => {
    const { service } = setup();
    expect(await service.validateAccessClaims({ sub: 'user-1', sid })).toEqual({
      id: 'user-1',
      email: 'current@example.com',
      roles: ['ESTUDIANTE'],
      permissions: ['courses:read'],
    });
  });

  it.each([
    'revoked',
    'expired',
    'disabled',
    'deleted',
    'other-user',
    'missing',
  ])('rejects a %s session', async (state) => {
    const { service, prisma } = setup();
    const stored = session();
    if (state === 'revoked') stored.revokedAt = new Date();
    if (state === 'expired') stored.expiresAt = new Date(0);
    if (state === 'disabled') stored.user.isActive = false;
    if (state === 'deleted') stored.user.deletedAt = new Date();
    if (state === 'other-user') stored.userId = 'other';
    prisma.refreshSession.findUnique.mockResolvedValue(
      state === 'missing' ? null : stored,
    );
    await expect(
      service.validateAccessClaims({ sub: 'user-1', sid }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects legacy tokens and malformed session identifiers before querying the database', async () => {
    const { service, prisma } = setup();
    await expect(
      service.validateAccessClaims({ sub: 'user-1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.validateAccessClaims({ sub: 'user-1', sid: 'invalid' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshSession.findUnique).not.toHaveBeenCalled();
  });

  it('binds the access token to the hash of the refresh token without copying old expiration claims', async () => {
    const { service, jwt } = setup();
    jwt.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      email: 'a@example.com',
      roles: [],
      permissions: [],
      iat: 1,
      exp: 2,
    });
    await service.bindAccessToken('original-access', 'private-refresh');
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      sid: createHash('sha256').update('private-refresh').digest('hex'),
    });
  });

  it('commits replay revocation before rejecting the reused refresh token', async () => {
    const { service, prisma } = setup();
    let committed = false;
    let revoked = false;
    prisma.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => {
        try {
          const result = await callback({
            refreshSession: {
              findUnique: jest
                .fn()
                .mockResolvedValue({ revokedAt: new Date(), userId: 'user-1' }),
              updateMany: jest.fn().mockImplementation(() => {
                revoked = true;
                return Promise.resolve({ count: 1 });
              }),
            },
          });
          committed = true;
          return result;
        } catch (error) {
          revoked = false;
          throw error;
        }
      },
    );
    await expect(service.rotate('used-token', {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(committed).toBe(true);
    expect(revoked).toBe(true);
  });

  it('can revoke a session using verified access claims without a refresh cookie', async () => {
    const { service, prisma } = setup();
    expect(await service.revokeAccessSession({ sub: 'user-1', sid })).toBe(
      'user-1',
    );
    expect(prisma.refreshSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', tokenHash: sid, revokedAt: null },
      data: { revokedAt: expect.any(Date) as jest.AsymmetricMatcher },
    });
  });
});

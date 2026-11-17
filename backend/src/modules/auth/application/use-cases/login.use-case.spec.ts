import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { LoginUseCase } from './login.use-case';
import { UserEntity } from '../../domain/entities/user.entity';

jest.mock('bcrypt', () => ({ compare: jest.fn() }));

function user(
  overrides: Partial<ConstructorParameters<typeof UserEntity>[0]> = {},
) {
  return new UserEntity({
    id: 'user-1',
    email: 'student@example.com',
    passwordHash: 'hash',
    firstName: 'Ana',
    lastName: 'Pérez',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    roles: [
      {
        id: 'role-1',
        name: 'ESTUDIANTE',
        permissions: [{ subject: 'course', action: 'read' }],
      },
    ],
    ...overrides,
  });
}

describe('LoginUseCase', () => {
  const compare = bcrypt.compare as unknown as jest.Mock;

  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['missing user', null],
    ['inactive user', user({ isActive: false })],
    ['deleted user', user({ deletedAt: new Date() })],
  ])('rejects %s', async (_label, account) => {
    const repository = {
      findByEmail: jest.fn().mockResolvedValue(account),
    };
    const service = new LoginUseCase(
      repository as never,
      { signAsync: jest.fn() } as never,
      { verifyStoredCode: jest.fn(), upgradeLegacySecret: jest.fn() } as never,
    );

    await expect(
      service.execute('student@example.com', 'secret'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(compare).not.toHaveBeenCalled();
  });

  it('rejects an invalid password', async () => {
    compare.mockResolvedValue(false);
    const repository = { findByEmail: jest.fn().mockResolvedValue(user()) };
    const service = new LoginUseCase(
      repository as never,
      { signAsync: jest.fn() } as never,
      {} as never,
    );

    await expect(
      service.execute('student@example.com', 'wrong'),
    ).rejects.toThrow('Credenciales inválidas');
  });

  it('requires and validates 2FA for administrators', async () => {
    compare.mockResolvedValue(true);
    const account = user({
      roles: [{ id: 'admin', name: 'ADMIN', permissions: [] }],
      twoFactorEnabled: true,
      twoFactorSecret: 'secret',
    });
    const repository = { findByEmail: jest.fn().mockResolvedValue(account) };
    const twoFactor = {
      verifyStoredCode: jest.fn().mockReturnValue(false),
      upgradeLegacySecret: jest.fn(),
    };
    const service = new LoginUseCase(
      repository as never,
      { signAsync: jest.fn() } as never,
      twoFactor as never,
    );

    await expect(
      service.execute(account.email, 'secret'),
    ).rejects.toMatchObject({ response: { code: 'TWO_FACTOR_REQUIRED' } });
    await expect(
      service.execute(account.email, 'secret', '000000'),
    ).rejects.toMatchObject({ response: { code: 'TWO_FACTOR_INVALID' } });
  });

  it('returns a token and permissions after successful authentication', async () => {
    compare.mockResolvedValue(true);
    const repository = {
      findByEmail: jest.fn().mockResolvedValue(user()),
      updateLastLogin: jest.fn().mockResolvedValue(undefined),
    };
    const jwt = { signAsync: jest.fn().mockResolvedValue('token-1') };
    const service = new LoginUseCase(
      repository as never,
      jwt as never,
      {} as never,
    );

    await expect(
      service.execute('student@example.com', 'secret'),
    ).resolves.toMatchObject({
      accessToken: 'token-1',
      tokenType: 'Bearer',
      user: { id: 'user-1', roles: ['ESTUDIANTE'] },
      permissions: ['course:read'],
    });
    expect(repository.updateLastLogin).toHaveBeenCalledWith(
      'user-1',
      expect.any(Date),
    );
  });

  it('authenticates an administrator with valid 2FA and tolerates audit update failures', async () => {
    compare.mockResolvedValue(true);
    const account = user({
      roles: [{ id: 'admin', name: 'ADMIN', permissions: [] }],
      twoFactorEnabled: true,
      twoFactorSecret: 'secret',
    });
    const repository = {
      findByEmail: jest.fn().mockResolvedValue(account),
      updateLastLogin: jest.fn().mockRejectedValue(new Error('database down')),
    };
    const twoFactor = {
      verifyStoredCode: jest.fn().mockReturnValue(true),
      upgradeLegacySecret: jest
        .fn()
        .mockRejectedValue(new Error('legacy secret')),
    };
    const service = new LoginUseCase(
      repository as never,
      { signAsync: jest.fn().mockResolvedValue('admin-token') } as never,
      twoFactor as never,
    );

    await expect(
      service.execute(account.email, 'secret', '123456'),
    ).resolves.toMatchObject({ accessToken: 'admin-token' });
    expect(twoFactor.upgradeLegacySecret).toHaveBeenCalledWith(
      account.id,
      account.twoFactorSecret,
    );
  });
});

import { ConflictException } from '@nestjs/common';
import { AdminCreateUserUseCase } from './admin-create-user.use-case';
import { ListUsersUseCase } from './list-users.use-case';
import { UserEntity } from '../../domain/entities/user.entity';
import { RefreshSessionService } from '../../infrastructure/refresh-session.service';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

const user = new UserEntity({
  id: 'user-1',
  email: 'user@example.com',
  passwordHash: 'hash',
  firstName: 'Ada',
  lastName: 'Lovelace',
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  roles: [{ id: 'role-1', name: 'ESTUDIANTE', permissions: [] }],
});

describe('Auth secondary use cases', () => {
  it('creates an admin-managed user with a selected or default role', async () => {
    const repository = {
      findByEmail: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(user),
    };
    const useCase = new AdminCreateUserUseCase(repository as never);

    await expect(
      useCase.execute({
        email: 'user@example.com',
        password: 'Password123!',
        firstName: 'Ada',
        lastName: 'Lovelace',
        roles: ['DOCENTE'],
      }),
    ).resolves.toMatchObject({ id: 'user-1', roles: user.roles });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        passwordHash: expect.any(String) as jest.AsymmetricMatcher,
      }),
      'DOCENTE',
    );

    await useCase.execute({
      email: 'other@example.com',
      password: 'Password123!',
      firstName: 'Grace',
      lastName: 'Hopper',
    });
    expect(repository.create).toHaveBeenLastCalledWith(
      expect.anything(),
      'ESTUDIANTE',
    );
  });

  it('rejects duplicate admin-managed users', async () => {
    const repository = { findByEmail: jest.fn().mockResolvedValue(user) };
    const useCase = new AdminCreateUserUseCase(repository as never);

    await expect(
      useCase.execute({
        email: 'user@example.com',
        password: 'Password123!',
        firstName: 'Ada',
        lastName: 'Lovelace',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps paginated users and treats Todos as no role filter', async () => {
    const repository = {
      findPage: jest.fn().mockResolvedValue({
        data: [user],
        pagination: { page: 2, limit: 5, total: 1, totalPages: 1 },
      }),
    };
    const useCase = new ListUsersUseCase(repository as never);

    await expect(useCase.execute('Todos', 2, 5)).resolves.toEqual({
      data: [
        {
          id: 'user-1',
          email: 'user@example.com',
          firstName: 'Ada',
          lastName: 'Lovelace',
          isActive: true,
          roles: ['ESTUDIANTE'],
        },
      ],
      pagination: { page: 2, limit: 5, total: 1, totalPages: 1 },
    });
    expect(repository.findPage).toHaveBeenCalledWith(undefined, 2, 5);
  });
});

describe('RefreshSessionService', () => {
  const config = { get: jest.fn().mockReturnValue(30) };
  const jwt = { signAsync: jest.fn().mockResolvedValue('access-token') };
  let prisma: Record<string, jest.Mock | Record<string, jest.Mock>>;
  let service: RefreshSessionService;

  beforeEach(() => {
    prisma = {
      refreshSession: {
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(),
    };
    service = new RefreshSessionService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
    );
  });

  it('creates, revokes and revokes all sessions with hashed tokens', async () => {
    const token = await service.create('user-1', {
      userAgent: 'a'.repeat(600),
      ipAddress: '1'.repeat(60),
    });
    expect(token).toEqual(expect.any(String));
    expect(
      (prisma.refreshSession as Record<string, jest.Mock>).create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          tokenHash: expect.any(String) as jest.AsymmetricMatcher,
          userAgent: 'a'.repeat(500),
          ipAddress: '1'.repeat(45),
        }) as jest.AsymmetricMatcher,
      }),
    );
    await service.revoke('refresh-token');
    await service.revokeAll('user-1');
    expect(
      (prisma.refreshSession as Record<string, jest.Mock>).updateMany,
    ).toHaveBeenCalledTimes(2);
  });

  it('rotates a valid session and binds access to the replacement session', async () => {
    const transaction = {
      refreshSession: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'session-1',
          userId: 'user-1',
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          user: {
            id: 'user-1',
            email: 'user@example.com',
            isActive: true,
            deletedAt: null,
            roles: [
              {
                role: {
                  name: 'ADMIN',
                  permissions: [
                    { permission: { subject: 'users', action: 'read' } },
                    { permission: { subject: 'users', action: 'read' } },
                  ],
                },
              },
            ],
          },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(
      (callback: (tx: unknown) => unknown) => callback(transaction),
    );

    await expect(
      service.rotate('old-token', {
        userAgent: 'browser',
        ipAddress: '127.0.0.1',
      }),
    ).resolves.toMatchObject({
      accessToken: 'access-token',
      refreshToken: expect.any(String) as jest.AsymmetricMatcher,
    });
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      sid: expect.stringMatching(/^[a-f0-9]{64}$/) as jest.AsymmetricMatcher,
    });
  });

  it('rejects invalid, reused, expired and concurrently revoked sessions', async () => {
    const findUnique = jest.fn();
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const transaction = {
      refreshSession: { findUnique, updateMany, create: jest.fn() },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(
      (callback: (tx: unknown) => unknown) => callback(transaction),
    );

    findUnique.mockResolvedValue(null);
    await expect(service.rotate('missing', {})).rejects.toThrow(
      'Sesión no válida',
    );
    findUnique.mockResolvedValue({ revokedAt: new Date(), userId: 'user-1' });
    await expect(service.rotate('reused', {})).rejects.toThrow(
      'La sesión ya fue utilizada',
    );
    findUnique.mockResolvedValue({
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      user: { isActive: true, deletedAt: null },
    });
    await expect(service.rotate('expired', {})).rejects.toThrow(
      'La sesión expiró',
    );
    findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 1000),
      user: { isActive: true, deletedAt: null, roles: [] },
    });
    updateMany.mockResolvedValue({ count: 0 });
    await expect(service.rotate('race', {})).rejects.toThrow(
      'La sesión ya fue utilizada',
    );
  });
});

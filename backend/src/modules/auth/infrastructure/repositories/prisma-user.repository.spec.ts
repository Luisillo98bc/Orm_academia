import { BadRequestException } from '@nestjs/common';
import { PrismaUserRepository } from './prisma-user.repository';
import type { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

const roleRecord = (name = 'ESTUDIANTE') => ({
  id: `role-${name}`,
  name,
  permissions: [
    { permission: { action: 'read', subject: 'courses' } },
    { permission: { action: 'read', subject: 'courses' } },
  ],
});

const userRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-1',
  email: 'student@example.com',
  googleSubject: null,
  passwordHash: 'hash',
  firstName: 'Ada',
  lastName: 'Lovelace',
  profilePicture: null,
  dni: null,
  phone: null,
  address: null,
  district: null,
  province: null,
  department: null,
  isActive: true,
  emailVerifiedAt: null,
  lastLoginAt: null,
  twoFactorEnabled: false,
  twoFactorSecret: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-02'),
  deletedAt: null,
  roles: [{ role: roleRecord() }],
  ...overrides,
});

describe('PrismaUserRepository', () => {
  let repository: PrismaUserRepository;
  let prisma: {
    user: Record<string, jest.Mock>;
    role: Record<string, jest.Mock>;
  };

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      role: { findUnique: jest.fn(), findMany: jest.fn() },
    };
    repository = new PrismaUserRepository(prisma as unknown as PrismaService);
  });

  it('normalizes email and maps roles with unique permissions', async () => {
    prisma.user.findFirst.mockResolvedValue(userRecord());

    const result = await repository.findByEmail('  STUDENT@EXAMPLE.COM ');

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'student@example.com', deletedAt: null },
      }),
    );
    expect(result?.fullName).toBe('Ada Lovelace');
    expect(result?.flatPermissions).toEqual(['courses:read']);
  });

  it('returns null when lookup by email or Google subject has no user', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      repository.findByEmail('missing@example.com'),
    ).resolves.toBeNull();
    await expect(
      repository.findByGoogleSubject('missing-google'),
    ).resolves.toBeNull();
  });

  it('finds by Google subject and links a profile', async () => {
    prisma.user.findFirst.mockResolvedValue(
      userRecord({ googleSubject: 'google-1' }),
    );
    prisma.user.update.mockResolvedValue(
      userRecord({ googleSubject: 'google-1' }),
    );

    await expect(
      repository.findByGoogleSubject('google-1'),
    ).resolves.toMatchObject({
      googleSubject: 'google-1',
    });
    await expect(
      repository.linkGoogleSubject('user-1', 'google-2', 'avatar'),
    ).resolves.toBeDefined();
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          googleSubject: 'google-2',
          profilePicture: 'avatar',
        }) as jest.AsymmetricMatcher,
      }),
    );
  });

  it('replaces roles and reports a missing role', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'role-admin' });
    prisma.user.update.mockResolvedValue(
      userRecord({ roles: [{ role: roleRecord('ADMIN') }] }),
    );

    await expect(
      repository.replaceRoles('user-1', 'ADMIN'),
    ).resolves.toMatchObject({
      roles: [expect.objectContaining({ name: 'ADMIN' })],
    });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { roles: { deleteMany: {}, create: { roleId: 'role-admin' } } },
      }),
    );

    prisma.role.findUnique.mockResolvedValue(null);
    await expect(repository.replaceRoles('user-1', 'UNKNOWN')).rejects.toThrow(
      'Role UNKNOWN not found',
    );
  });

  it('finds by id, by role and all active users', async () => {
    prisma.user.findFirst
      .mockResolvedValueOnce(userRecord())
      .mockResolvedValueOnce(null);
    prisma.user.findMany.mockResolvedValue([
      userRecord(),
      userRecord({ id: 'user-2' }),
    ]);

    await expect(repository.findById('user-1')).resolves.toMatchObject({
      id: 'user-1',
    });
    await expect(repository.findById('missing')).resolves.toBeNull();
    await expect(repository.findByRole('DOCENTE')).resolves.toHaveLength(2);
    await expect(repository.findAll()).resolves.toHaveLength(2);
  });

  it('returns a paginated page with or without a role filter', async () => {
    prisma.user.findMany.mockResolvedValue([userRecord()]);
    prisma.user.count.mockResolvedValue(7);

    const filtered = await repository.findPage('ADMIN', 2, 3);
    const all = await repository.findPage(undefined, 1, 20);

    expect(filtered.pagination).toMatchObject({
      page: 2,
      limit: 3,
      total: 7,
      totalPages: 3,
    });
    expect(filtered.data[0].id).toBe('user-1');
    expect(prisma.user.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
        where: { deletedAt: null },
      }),
    );
    expect(all.data).toHaveLength(1);
  });

  it('updates email and roles, and rejects invalid roles', async () => {
    prisma.role.findMany.mockResolvedValue([
      { id: 'role-admin', name: 'ADMIN' },
    ]);
    prisma.user.update.mockResolvedValue(
      userRecord({ email: 'new@example.com' }),
    );

    await expect(
      repository.update('user-1', {
        email: '  NEW@EXAMPLE.COM ',
        roles: ['ADMIN', 'ADMIN'],
      }),
    ).resolves.toMatchObject({ email: 'new@example.com' });
    expect(prisma.role.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { in: ['ADMIN'] },
        }) as jest.AsymmetricMatcher,
      }),
    );

    prisma.role.findMany.mockResolvedValue([]);
    await expect(
      repository.update('user-1', { roles: ['INVALID'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('soft deletes, lists trash and restores users', async () => {
    prisma.user.update.mockResolvedValue(userRecord({ deletedAt: new Date() }));
    prisma.user.findMany.mockResolvedValue([
      userRecord({ deletedAt: new Date() }),
    ]);

    await expect(repository.softDelete('user-1')).resolves.toBeUndefined();
    await expect(repository.findTrash()).resolves.toHaveLength(1);
    await expect(repository.restore('user-1')).resolves.toMatchObject({
      id: 'user-1',
    });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { deletedAt: null, isActive: true } }),
    );
  });

  it('creates users with normalized email and default role', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'role-student' });
    prisma.user.create.mockResolvedValue(userRecord());

    await expect(
      repository.create(
        {
          email: '  NEW@EXAMPLE.COM ',
          passwordHash: 'hash',
          firstName: 'Ada',
          lastName: 'Lovelace',
        },
        'ESTUDIANTE',
      ),
    ).resolves.toMatchObject({ email: 'student@example.com' });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'new@example.com',
          roles: { create: { roleId: 'role-student' } },
        }) as jest.AsymmetricMatcher,
      }),
    );

    prisma.role.findUnique.mockResolvedValue(null);
    await expect(
      repository.create(
        {
          email: 'new@example.com',
          passwordHash: 'hash',
          firstName: 'A',
          lastName: 'B',
        },
        'UNKNOWN',
      ),
    ).rejects.toThrow('Role UNKNOWN not found');
  });

  it('updates last login', async () => {
    const date = new Date('2026-01-01');
    await repository.updateLastLogin('user-1', date);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { lastLoginAt: date },
    });
  });
});

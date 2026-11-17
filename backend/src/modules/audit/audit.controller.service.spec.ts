import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import type { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

describe('AuditController and AuditService', () => {
  let prisma: Record<string, Record<string, jest.Mock>>;
  let service: AuditService;

  beforeEach(() => {
    prisma = {
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(2),
      },
      refreshSession: { count: jest.fn().mockResolvedValue(1) },
      user: { count: jest.fn().mockResolvedValue(1) },
    };
    service = new AuditService(prisma as unknown as PrismaService);
  });

  it('redacts sensitive audit values and limits metadata lengths', async () => {
    await service.log(
      {
        userId: 'user-1',
        ipAddress: '1'.repeat(60),
        userAgent: 'a'.repeat(600),
      },
      'UPDATE_USER',
      'User',
      'user-1',
      { email: 'secret@example.com', nested: { phone: '999', safe: true } },
      { password: 'secret', safe: true },
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        oldValue: {
          email: '[REDACTED]',
          nested: { phone: '[REDACTED]', safe: true },
        },
        newValue: { password: '[REDACTED]', safe: true },
        ipAddress: '1'.repeat(45),
        userAgent: 'a'.repeat(500),
      }) as jest.AsymmetricMatcher,
    });
  });

  it('handles primitive, array and omitted audit values', async () => {
    await service.log({}, 'READ', 'Report', undefined, undefined, [
      { token: 'secret' },
      true,
    ]);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          oldValue: undefined,
          newValue: [{ token: '[REDACTED]' }, true],
        }) as unknown,
      }),
    );
    await service.log({}, 'READ', 'Report', undefined, 'plain', 5);
  });

  it('lists audit logs with normalized pagination and search filters', async () => {
    const result = await service.list(
      0,
      500,
      'LOGIN',
      'User',
      '2026-01-01',
      '2026-01-31',
      'ada',
    );
    expect(result).toMatchObject({ data: [], total: 2, page: 1, limit: 100 });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 100,
        where: expect.objectContaining({
          action: 'LOGIN',
          entity: 'User',
        }) as jest.AsymmetricMatcher,
      }),
    );
  });

  it('returns a security summary with risk levels', async () => {
    prisma.auditLog.count.mockResolvedValueOnce(12).mockResolvedValueOnce(4);
    await expect(service.getSecuritySummary(400)).resolves.toMatchObject({
      days: 365,
      failedLogins: 12,
      successfulLogins: 4,
      activeSessions: 1,
      adminsWithoutTwoFactor: 1,
      riskLevel: 'REVIEW',
    });
    const controller = new AuditController(service);
    await controller.list('2', '10', 'LOGIN', 'User', 'start', 'end', 'ada');
    await controller.getSecuritySummary('7');
    expect(prisma.auditLog.findMany).toHaveBeenCalled();
  });

  it('uses defaults for empty audit filters and reports normal risk', async () => {
    await expect(service.list()).resolves.toMatchObject({
      page: 1,
      limit: 25,
    });
    prisma.auditLog.count.mockResolvedValue(0);
    prisma.refreshSession.count.mockResolvedValue(0);
    prisma.user.count.mockResolvedValue(0);
    await expect(service.getSecuritySummary(0)).resolves.toMatchObject({
      days: 30,
      riskLevel: 'NORMAL',
    });
  });
});

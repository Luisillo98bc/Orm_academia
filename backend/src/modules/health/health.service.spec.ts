import { ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import type { RequestMetricsService } from './request-metrics.service';

describe('HealthService', () => {
  let service: HealthService;
  let prisma: {
    $queryRaw: jest.Mock;
    user: { count: jest.Mock };
    enrollment: { count: jest.Mock };
    supportTicket: { count: jest.Mock };
    notificationDelivery: { count: jest.Mock; findMany: jest.Mock };
    auditLog: { count: jest.Mock };
    payment: { count: jest.Mock };
  };
  let config: { get: jest.Mock };
  let metrics: { snapshot: jest.Mock };

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ ok: 1 }]),
      user: { count: jest.fn().mockResolvedValue(10) },
      enrollment: { count: jest.fn().mockResolvedValue(5) },
      supportTicket: { count: jest.fn().mockResolvedValue(2) },
      notificationDelivery: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([]),
      },
      auditLog: { count: jest.fn().mockResolvedValue(3) },
      payment: { count: jest.fn().mockResolvedValue(4) },
    };
    config = {
      get: jest.fn(
        (key: string) =>
          ({
            NODE_ENV: 'test',
            SMTP_HOST: 'smtp.example.com',
            WHATSAPP_API_URL: '',
            STORAGE_PROVIDER: 'local',
          })[key],
      ),
    };
    metrics = { snapshot: jest.fn().mockReturnValue({ total: 4 }) };
    service = new HealthService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      metrics as unknown as RequestMetricsService,
    );
  });

  it('reports a healthy database', async () => {
    await expect(service.check()).resolves.toMatchObject({
      status: 'ok',
      database: 'up',
    });
  });

  it('converts database failures into service unavailable', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('database down'));
    await expect(service.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('reports technical details for up and down integrations', async () => {
    await expect(service.details()).resolves.toMatchObject({
      status: 'ok',
      database: 'up',
      environment: 'test',
      integrations: { smtp: true, whatsapp: false, storage: 'local' },
    });
    prisma.$queryRaw.mockRejectedValue(new Error('database down'));
    await expect(service.details()).resolves.toMatchObject({
      status: 'degraded',
      database: 'down',
    });
  });

  it('returns operational metrics and request counters', async () => {
    await expect(service.metrics()).resolves.toMatchObject({
      period: '24h',
      users: 10,
      activeEnrollments: 5,
      openTickets: 2,
      failedDeliveries: 1,
      failedLogins: 3,
      pendingPayments: 4,
      expiringReservations: 5,
      recentFailedDeliveries: [],
      requests: { total: 4 },
    });
    expect(metrics.snapshot).toHaveBeenCalled();
  });
});

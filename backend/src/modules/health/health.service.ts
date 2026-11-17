import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as net from 'net';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { RequestMetricsService } from './request-metrics.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly requestMetrics: RequestMetricsService,
  ) {}

  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'up',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async readiness() {
    return this.check();
  }

  prometheus() {
    const metrics = this.requestMetrics.snapshot();
    return (
      [
        '# HELP academia_http_requests_total HTTP requests observed in the recent window',
        '# TYPE academia_http_requests_total gauge',
        `academia_http_requests_total ${metrics.requests}`,
        '# HELP academia_http_errors_total HTTP 5xx responses observed in the recent window',
        '# TYPE academia_http_errors_total gauge',
        `academia_http_errors_total ${metrics.errors}`,
        '# HELP academia_http_request_duration_ms HTTP request duration percentiles',
        '# TYPE academia_http_request_duration_ms gauge',
        `academia_http_request_duration_ms{quantile="0.5"} ${metrics.p50Ms}`,
        `academia_http_request_duration_ms{quantile="0.95"} ${metrics.p95Ms}`,
        `academia_http_request_duration_ms{quantile="0.99"} ${metrics.p99Ms}`,
        `process_uptime_seconds ${Math.round(process.uptime())}`,
      ].join('\n') + '\n'
    );
  }

  async details() {
    const started = performance.now();
    let database: 'up' | 'down' = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }
    const clamav = await this.checkClamAv();
    const storageQuotaBytes = Number(
      this.config.get('STORAGE_BUCKET_QUOTA_BYTES') || 0,
    );
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      databaseLatencyMs: Math.round(performance.now() - started),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.0.1',
      environment: this.config.get<string>('NODE_ENV') || 'development',
      paymentsMode: this.config.get<string>('PAYMENTS_MODE') || 'cash',
      scheduledJobsMode:
        this.config.get<string>('SCHEDULED_JOBS_MODE') || 'inline',
      storageBucketQuotaBytes: Number.isFinite(storageQuotaBytes)
        ? storageQuotaBytes
        : 0,
      integrations: {
        smtp: Boolean(this.config.get<string>('SMTP_HOST')),
        whatsapp: Boolean(this.config.get<string>('WHATSAPP_API_URL')),
        storage: this.config.get<string>('STORAGE_PROVIDER') || 'local',
        clamav,
      },
      schedulers: {
        academicReminders: true,
        rrhh: true,
        certificates: true,
        automations: true,
      },
    };
  }

  private checkClamAv(): Promise<{
    enabled: boolean;
    required: boolean;
    status: 'up' | 'down' | 'disabled';
  }> {
    const host = this.config.get<string>('CLAMAV_HOST')?.trim();
    const port = Number(this.config.get('CLAMAV_PORT') || 3310);
    const required =
      this.config.get('CLAMAV_REQUIRED') === true ||
      this.config.get('CLAMAV_REQUIRED') === 'true';

    if (!host) {
      return Promise.resolve({ enabled: false, required, status: 'disabled' });
    }

    return new Promise((resolve) => {
      let settled = false;
      const done = (status: 'up' | 'down') => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve({ enabled: true, required, status });
      };
      const socket = net.createConnection({ host, port });
      socket.setTimeout(1500);
      socket.on('connect', () => {
        socket.write('PING\n');
      });
      socket.on('data', (chunk) => {
        if (chunk.toString('utf8').includes('PONG')) {
          done('up');
        } else {
          done('up');
        }
      });
      socket.on('timeout', () => done('down'));
      socket.on('error', () => done('down'));
    });
  }

  async metrics() {
    const now = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const started = performance.now();
    const [
      users,
      activeEnrollments,
      openTickets,
      failedDeliveries,
      failedLogins,
      pendingPayments,
      expiringReservations,
      recentFailedDeliveries,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.enrollment.count({
        where: { status: 'ACTIVE', deletedAt: null },
      }),
      this.prisma.supportTicket.count({
        where: { status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_USER'] } },
      }),
      this.prisma.notificationDelivery.count({
        where: { status: 'FAILED', createdAt: { gte: since } },
      }),
      this.prisma.auditLog.count({
        where: { action: 'LOGIN_FAILED', createdAt: { gte: since } },
      }),
      this.prisma.payment?.count
        ? this.prisma.payment.count({
            where: { status: 'PENDING' },
          })
        : Promise.resolve(0),
      this.prisma.enrollment.count({
        where: {
          status: 'PENDING_PAYMENT',
          deletedAt: null,
          reservationExpiresAt: { gt: now, lte: next24h },
        },
      }),
      this.prisma.notificationDelivery.findMany
        ? this.prisma.notificationDelivery.findMany({
            where: { status: 'FAILED' },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              id: true,
              channel: true,
              recipient: true,
              errorMessage: true,
              attempts: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
    ]);
    return {
      period: '24h',
      responseTimeMs: Math.round(performance.now() - started),
      users,
      activeEnrollments,
      openTickets,
      failedDeliveries,
      failedLogins,
      pendingPayments,
      expiringReservations,
      recentFailedDeliveries,
      requests: this.requestMetrics.snapshot(),
      generatedAt: new Date().toISOString(),
    };
  }
}

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { NotificationsService } from '../communication/notifications.service';
import { SchedulerLockService } from '../../shared/infrastructure/scheduler/scheduler-lock.service';

@Injectable()
export class AutomationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutomationService.name);
  private timer: NodeJS.Timeout | null = null;
  private lastRunAt: Date | null = null;
  private lastResult: Record<string, number> | null = null;
  private nextRunAt: Date | null = null;
  private history: Array<{
    at: string;
    executed: boolean;
    result: Record<string, number>;
  }> = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    private readonly lock: SchedulerLockService,
  ) {}

  onModuleInit() {
    if (
      this.config.get('NODE_ENV', 'development') === 'test' ||
      this.config.get('ENABLE_SCHEDULED_JOBS', 'true') === 'false' ||
      this.config.get('SCHEDULED_JOBS_MODE', 'inline') !== 'inline'
    )
      return;
    const interval = Math.max(
      60_000,
      Number(this.config.get('AUTOMATION_INTERVAL_MS', 3_600_000)) || 3_600_000,
    );
    void this.run();
    this.nextRunAt = new Date(Date.now() + interval);
    this.timer = setInterval(() => {
      this.nextRunAt = new Date(Date.now() + interval);
      void this.run();
    }, interval);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.nextRunAt = null;
  }

  private run() {
    return this.runOnce().catch((error: unknown) => {
      this.logger.error(
        'No se pudieron ejecutar las automatizaciones',
        error instanceof Error ? error.stack : String(error),
      );
    });
  }

  async runOnce() {
    let result: Record<string, number> = {
      prospects: 0,
      payments: 0,
      inactiveStudents: 0,
      notificationRetries: 0,
    };
    const acquired = await this.lock.runExclusive(
      'academia:scheduled:automations',
      async () => {
        const retries = await this.notifications.retryFailedDeliveries(25);
        result = {
          prospects: await this.followUpProspects(),
          payments: await this.remindPendingPayments(),
          inactiveStudents: await this.remindInactiveStudents(),
          notificationRetries: retries.sent,
        };
      },
    );
    if (!acquired) this.lock.logSkipped('academia:scheduled:automations');
    this.lastRunAt = new Date();
    this.lastResult = result;
    this.history = [
      { at: this.lastRunAt.toISOString(), executed: acquired, result },
      ...this.history,
    ].slice(0, 20);
    return {
      executed: acquired,
      ...result,
      lastRunAt: this.lastRunAt.toISOString(),
    };
  }

  status() {
    return {
      enabled: this.timer !== null,
      lastRunAt: this.lastRunAt?.toISOString() || null,
      lastResult: this.lastResult,
      nextRunAt: this.nextRunAt?.toISOString() || null,
      history: this.history,
    };
  }

  private async alreadyNotified(userId: string, title: string) {
    return (
      (await this.prisma.notification.count({
        where: {
          userId,
          title,
          createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) },
        },
      })) > 0
    );
  }

  private async followUpProspects() {
    const admins = await this.prisma.user.findMany({
      where: { isActive: true, roles: { some: { role: { name: 'ADMIN' } } } },
      select: { id: true },
      take: 10,
    });
    let afterId: string | undefined;
    let sent = 0;
    while (true) {
      const prospects = await this.prisma.prospect.findMany({
        where: {
          ...(afterId ? { id: { gt: afterId } } : {}),
          nextFollowUpAt: { lte: new Date() },
          status: { in: ['NEW', 'CONTACTED', 'INTERESTED'] },
        },
        select: { id: true, name: true, assignedToId: true },
        orderBy: { id: 'asc' },
        take: 200,
      });
      for (const prospect of prospects) {
        const recipients = prospect.assignedToId
          ? [prospect.assignedToId]
          : admins.map((admin) => admin.id);
        for (const userId of recipients) {
          const title = `Seguimiento pendiente: ${prospect.name}`;
          if (!(await this.alreadyNotified(userId, title))) {
            await this.notifications.createNotification({
              userId,
              title,
              message:
                'Este prospecto tiene una actividad de seguimiento vencida.',
              type: 'prospect',
              actionUrl: `/dashboard/prospects?search=${encodeURIComponent(prospect.name)}`,
            });
            sent++;
          }
        }
      }
      if (prospects.length < 200) break;
      afterId = prospects[prospects.length - 1].id;
    }
    return sent;
  }

  private async remindPendingPayments() {
    let afterId: string | undefined;
    let sent = 0;
    while (true) {
      const payments = await this.prisma.payment.findMany({
        where: {
          ...(afterId ? { id: { gt: afterId } } : {}),
          status: 'PENDING',
          createdAt: { lte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        select: {
          id: true,
          enrollment: {
            select: { userId: true, cohort: { select: { name: true } } },
          },
        },
        orderBy: { id: 'asc' },
        take: 200,
      });
      for (const payment of payments) {
        const title = `Pago pendiente: ${payment.enrollment.cohort.name}`;
        if (!(await this.alreadyNotified(payment.enrollment.userId, title))) {
          await this.notifications.createNotification({
            userId: payment.enrollment.userId,
            title,
            message:
              'Tu pago está pendiente de validación. Revisa el estado de tu matrícula.',
            type: 'payment',
            actionUrl: '/dashboard/my-payments',
          });
          sent++;
        }
      }
      if (payments.length < 200) break;
      afterId = payments[payments.length - 1].id;
    }
    return sent;
  }

  private async remindInactiveStudents() {
    const since = new Date(Date.now() - 14 * 86_400_000);
    let afterId: string | undefined;
    let sent = 0;
    while (true) {
      const enrollments = await this.prisma.enrollment.findMany({
        where: {
          ...(afterId ? { id: { gt: afterId } } : {}),
          status: 'ACTIVE',
          deletedAt: null,
        },
        select: {
          id: true,
          userId: true,
          cohort: { select: { name: true } },
          user: {
            select: {
              materialProgress: {
                orderBy: { updatedAt: 'desc' },
                take: 1,
                select: { updatedAt: true },
              },
            },
          },
        },
        orderBy: { id: 'asc' },
        take: 500,
      });
      for (const enrollment of enrollments) {
        const last = enrollment.user.materialProgress[0]?.updatedAt;
        if (last && last >= since) continue;
        const title = `Retoma tu aprendizaje: ${enrollment.cohort.name}`;
        if (!(await this.alreadyNotified(enrollment.userId, title))) {
          await this.notifications.createNotification({
            userId: enrollment.userId,
            title,
            message:
              'Hace varios días que no registramos avance. Vuelve al aula y continúa donde quedaste.',
            type: 'academic',
            actionUrl: `/dashboard/my-courses`,
          });
          sent++;
        }
      }
      if (enrollments.length < 500) break;
      afterId = enrollments[enrollments.length - 1].id;
    }
    return sent;
  }
}

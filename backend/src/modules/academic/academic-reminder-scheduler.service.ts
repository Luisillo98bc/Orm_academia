import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { SchedulerLockService } from '../../shared/infrastructure/scheduler/scheduler-lock.service';
import { NotificationsService } from '../communication/notifications.service';

/** Genera recordatorios internos para clases y evaluaciones próximas. */
@Injectable()
export class AcademicReminderSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AcademicReminderSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly configService: ConfigService,
    private readonly schedulerLock: SchedulerLockService,
  ) {}

  onModuleInit() {
    if (
      this.configService.get('NODE_ENV', 'development') === 'test' ||
      this.configService.get('ENABLE_SCHEDULED_JOBS', 'true') === 'false' ||
      ['worker', 'disabled'].includes(
        this.configService.get('SCHEDULED_JOBS_MODE', 'inline'),
      )
    ) {
      this.logger.log('Recordatorios académicos automáticos deshabilitados');
      return;
    }

    const configuredInterval = Number(
      this.configService.get('ACADEMIC_REMINDER_INTERVAL_MS', 3_600_000),
    );
    const intervalMs = Number.isFinite(configuredInterval)
      ? Math.max(60_000, configuredInterval)
      : 3_600_000;
    void this.run();
    this.timer = setInterval(() => void this.run(), intervalMs);
    this.timer.unref();
    this.logger.log(`Recordatorios académicos cada ${intervalMs} ms`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(): Promise<void> {
    const lockName = 'academia:scheduled:academic-reminders';
    const acquired = await this.schedulerLock.runExclusive(
      lockName,
      async () => {
        const now = new Date();
        const horizon = new Date(now.getTime() + 48 * 60 * 60 * 1000);
        const reservationHorizon = new Date(
          now.getTime() + 24 * 60 * 60 * 1000,
        );
        await this.notifyUpcomingClasses(now, horizon);
        await this.notifyUpcomingEvaluations(now, horizon);
        await this.notifyExpiringReservations(now, reservationHorizon);
      },
    );
    if (!acquired) this.schedulerLock.logSkipped(lockName);
  }

  private async notifyUpcomingClasses(now: Date, horizon: Date) {
    const sessions = await this.prisma.classSession.findMany({
      where: { date: { gte: now, lte: horizon } },
      include: {
        module: {
          include: {
            cohort: {
              include: {
                course: true,
                enrollments: {
                  where: { status: 'ACTIVE', deletedAt: null },
                  select: { userId: true },
                },
              },
            },
          },
        },
      },
    });

    for (const session of sessions) {
      const cohort = session.module.cohort;
      for (const enrollment of cohort.enrollments) {
        await this.createOnce(
          enrollment.userId,
          `Clase próxima: ${session.title}`,
          `${cohort.course.name} · ${cohort.name} comienza pronto.`,
          `/dashboard/my-courses/${cohort.id}`,
        );
      }
    }
  }

  private async notifyUpcomingEvaluations(now: Date, horizon: Date) {
    const evaluations = await this.prisma.evaluation.findMany({
      where: {
        isPublished: true,
        deletedAt: null,
        dueDate: { gte: now, lte: horizon },
      },
      include: {
        cohort: {
          include: {
            course: true,
            enrollments: {
              where: { status: 'ACTIVE', deletedAt: null },
              select: { userId: true },
            },
          },
        },
        deliverables: { select: { studentId: true } },
      },
    });

    for (const evaluation of evaluations) {
      const submitted = new Set(
        evaluation.deliverables.map((deliverable) => deliverable.studentId),
      );
      for (const enrollment of evaluation.cohort.enrollments) {
        if (submitted.has(enrollment.userId)) continue;
        await this.createOnce(
          enrollment.userId,
          `Tarea próxima a vencer: ${evaluation.title}`,
          `${evaluation.cohort.course.name} · Entrega pendiente en ${evaluation.cohort.name}.`,
          `/dashboard/my-courses/${evaluation.cohort.id}`,
        );
      }
    }
  }

  private async notifyExpiringReservations(now: Date, horizon: Date) {
    if (!this.prisma.enrollment?.findMany) return;
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        status: 'PENDING_PAYMENT',
        deletedAt: null,
        reservationExpiresAt: { gt: now, lte: horizon },
      },
      include: {
        cohort: {
          include: { course: { select: { name: true } } },
        },
      },
    });

    for (const enrollment of enrollments) {
      const courseName = enrollment.cohort?.course?.name || 'tu curso';
      const cohortName = enrollment.cohort?.name || '';
      await this.createOnce(
        enrollment.userId,
        `Reserva por vencer: ${courseName}`,
        `Tu reserva en ${courseName}${cohortName ? ` · ${cohortName}` : ''} vence pronto. Completa o sube tu pago para no perder el cupo.`,
        '/dashboard/my-payments',
      );
    }
  }

  private async createOnce(
    userId: string,
    title: string,
    message: string,
    actionUrl: string,
  ) {
    const recent = await this.prisma.notification.findFirst({
      where: {
        userId,
        title,
        createdAt: { gte: new Date(Date.now() - 18 * 60 * 60 * 1000) },
      },
      select: { id: true },
    });
    if (recent) return;
    await this.notifications.createNotification({
      userId,
      title,
      message,
      type: 'academic',
      actionUrl,
    });
  }

  private run() {
    return this.runOnce().catch((error: unknown) => {
      this.logger.error(
        'No se pudieron procesar los recordatorios académicos',
        error instanceof Error ? error.stack : String(error),
      );
    });
  }
}

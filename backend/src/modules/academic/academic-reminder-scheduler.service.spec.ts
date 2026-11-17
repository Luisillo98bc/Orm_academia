import { AcademicReminderSchedulerService } from './academic-reminder-scheduler.service';
import type { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import type { NotificationsService } from '../communication/notifications.service';
import type { ConfigService } from '@nestjs/config';
import type { SchedulerLockService } from '../../shared/infrastructure/scheduler/scheduler-lock.service';

describe('AcademicReminderSchedulerService', () => {
  let service: AcademicReminderSchedulerService;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let notifications: { createNotification: jest.Mock };
  let config: { get: jest.Mock };
  let lock: Record<string, jest.Mock>;

  beforeEach(() => {
    prisma = {
      classSession: { findMany: jest.fn().mockResolvedValue([]) },
      evaluation: { findMany: jest.fn().mockResolvedValue([]) },
      notification: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    notifications = {
      createNotification: jest.fn().mockResolvedValue(undefined),
    };
    config = {
      get: jest
        .fn()
        .mockImplementation((_key: string, fallback: unknown) => fallback),
    };
    lock = {
      runExclusive: jest
        .fn()
        .mockImplementation(
          async (_name: string, callback: () => Promise<void>) => {
            await callback();
            return true;
          },
        ),
      logSkipped: jest.fn(),
    };
    service = new AcademicReminderSchedulerService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
      config as unknown as ConfigService,
      lock as unknown as SchedulerLockService,
    );
  });

  it('stays disabled in test mode', () => {
    config.get.mockImplementation((key: string, fallback: unknown) =>
      key === 'NODE_ENV' ? 'test' : fallback,
    );
    service.onModuleInit();
    expect(lock.runExclusive).not.toHaveBeenCalled();
  });

  it('notifies active students for upcoming classes and pending evaluations', async () => {
    prisma.classSession.findMany.mockResolvedValue([
      {
        title: 'Live class',
        module: {
          cohort: {
            id: 'cohort-1',
            name: 'Cohort 1',
            course: { name: 'Math' },
            enrollments: [{ userId: 'student-1' }],
          },
        },
      },
    ]);
    prisma.evaluation.findMany.mockResolvedValue([
      {
        title: 'Exam',
        deliverables: [{ studentId: 'student-2' }],
        cohort: {
          id: 'cohort-1',
          name: 'Cohort 1',
          course: { name: 'Math' },
          enrollments: [{ userId: 'student-1' }, { userId: 'student-2' }],
        },
      },
    ]);

    await service.runOnce();

    expect(notifications.createNotification).toHaveBeenCalledTimes(2);
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'student-1', type: 'academic' }),
    );
  });

  it('skips duplicate reminders and logs when another worker owns the lock', async () => {
    prisma.classSession.findMany.mockResolvedValue([
      {
        title: 'Live',
        module: {
          cohort: {
            id: 'c',
            name: 'C',
            course: { name: 'Math' },
            enrollments: [{ userId: 'student-1' }],
          },
        },
      },
    ]);
    prisma.notification.findFirst.mockResolvedValue({ id: 'already-sent' });
    await service.runOnce();
    expect(notifications.createNotification).not.toHaveBeenCalled();
    lock.runExclusive.mockResolvedValue(false);
    await service.runOnce();
    expect(lock.logSkipped).toHaveBeenCalledWith(
      'academia:scheduled:academic-reminders',
    );
  });

  it('starts and stops the inline reminder timer when enabled', () => {
    jest.useFakeTimers();
    config.get.mockImplementation((key: string, fallback: unknown) => {
      if (key === 'NODE_ENV') return 'development';
      if (key === 'ENABLE_SCHEDULED_JOBS') return 'true';
      if (key === 'SCHEDULED_JOBS_MODE') return 'inline';
      if (key === 'ACADEMIC_REMINDER_INTERVAL_MS') return 60_000;
      return fallback;
    });
    const runOnce = jest.spyOn(service, 'runOnce').mockResolvedValue(undefined);
    service.onModuleInit();
    expect(runOnce).toHaveBeenCalled();
    jest.advanceTimersByTime(60_000);
    expect(runOnce).toHaveBeenCalledTimes(2);
    service.onModuleDestroy();
    jest.useRealTimers();
  });

  it('absorbs failures from a scheduled reminder run', async () => {
    const runOnce = jest
      .spyOn(service, 'runOnce')
      .mockRejectedValue(new Error('scheduler failure'));
    config.get.mockImplementation((key: string, fallback: unknown) => {
      if (key === 'NODE_ENV') return 'development';
      if (key === 'ENABLE_SCHEDULED_JOBS') return 'true';
      if (key === 'SCHEDULED_JOBS_MODE') return 'inline';
      return fallback;
    });
    service.onModuleInit();
    await Promise.resolve();
    expect(runOnce).toHaveBeenCalled();
    service.onModuleDestroy();
  });

  it('notifies students whose PENDING_PAYMENT reservation is expiring within 24h', async () => {
    prisma.enrollment = {
      findMany: jest.fn().mockResolvedValue([
        {
          userId: 'student-pending',
          cohort: { name: 'Grupo 1', course: { name: 'Python' } },
        },
      ]),
    };

    await service.runOnce();

    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'student-pending',
        title: 'Reserva por vencer: Python',
        actionUrl: '/dashboard/my-payments',
      }),
    );
  });
});

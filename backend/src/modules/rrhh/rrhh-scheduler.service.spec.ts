import { RrhhSchedulerService } from './rrhh-scheduler.service';
import type { RrhhService } from './rrhh.service';
import type { ConfigService } from '@nestjs/config';
import type { SchedulerLockService } from '../../shared/infrastructure/scheduler/scheduler-lock.service';

describe('RrhhSchedulerService', () => {
  it('disables itself in test mode and runs locked alerts', async () => {
    const rrhh = {
      processExpiringContractAlerts: jest.fn().mockResolvedValue(undefined),
    };
    const config = {
      get: jest
        .fn()
        .mockImplementation((key: string, fallback: unknown) =>
          key === 'NODE_ENV' ? 'test' : fallback,
        ),
    };
    const lock = {
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
    const service = new RrhhSchedulerService(
      rrhh as unknown as RrhhService,
      config as unknown as ConfigService,
      lock as unknown as SchedulerLockService,
    );
    service.onModuleInit();
    expect(lock.runExclusive).not.toHaveBeenCalled();
    await service.runOnce();
    expect(rrhh.processExpiringContractAlerts).toHaveBeenCalled();
  });

  it('logs skipped and swallowed scheduler errors', async () => {
    const rrhh = {
      processExpiringContractAlerts: jest
        .fn()
        .mockRejectedValue(new Error('failed')),
    };
    const config = { get: jest.fn().mockReturnValue('test') };
    const lock = {
      runExclusive: jest.fn().mockResolvedValue(false),
      logSkipped: jest.fn(),
    };
    const service = new RrhhSchedulerService(
      rrhh as unknown as RrhhService,
      config as unknown as ConfigService,
      lock as unknown as SchedulerLockService,
    );
    await service.runOnce();
    expect(lock.logSkipped).toHaveBeenCalledWith(
      'academia:scheduled:contract-alerts',
    );
    lock.runExclusive.mockRejectedValue(new Error('lock failed'));
    await expect(service.runOnce()).resolves.toBeUndefined();
  });

  it('starts and stops the inline scheduler when enabled', () => {
    jest.useFakeTimers();
    const rrhh = {
      processExpiringContractAlerts: jest.fn().mockResolvedValue(undefined),
    };
    const config = {
      get: jest.fn((key: string, fallback: unknown) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'ENABLE_SCHEDULED_JOBS') return 'true';
        if (key === 'SCHEDULED_JOBS_MODE') return 'inline';
        if (key === 'CONTRACT_ALERT_INTERVAL_MS') return 60_000;
        return fallback;
      }),
    };
    const lock = {
      runExclusive: jest.fn().mockResolvedValue(true),
      logSkipped: jest.fn(),
    };
    const service = new RrhhSchedulerService(
      rrhh as unknown as RrhhService,
      config as unknown as ConfigService,
      lock as unknown as SchedulerLockService,
    );
    const runOnce = jest.spyOn(service, 'runOnce').mockResolvedValue(undefined);
    service.onModuleInit();
    expect(runOnce).toHaveBeenCalled();
    jest.advanceTimersByTime(60_000);
    expect(runOnce).toHaveBeenCalledTimes(2);
    service.onModuleDestroy();
    jest.useRealTimers();
  });
});

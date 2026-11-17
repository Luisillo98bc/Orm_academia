import { CertificateSchedulerService } from './certificate-scheduler.service';
import type { CertificateService } from './application/services/certificate.service';
import type { ConfigService } from '@nestjs/config';
import type { SchedulerLockService } from '../../shared/infrastructure/scheduler/scheduler-lock.service';

describe('CertificateSchedulerService', () => {
  let service: CertificateSchedulerService;
  let certificates: Record<string, jest.Mock>;
  let config: { get: jest.Mock };
  let lock: Record<string, jest.Mock>;

  beforeEach(() => {
    certificates = {
      getCompletedEnrollmentsWithoutCertificate: jest
        .fn()
        .mockResolvedValue([{ id: 'enrollment-1' }, { id: 'enrollment-2' }]),
      generateAutoCertificate: jest.fn().mockResolvedValue({ code: 'CERT-1' }),
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
    service = new CertificateSchedulerService(
      certificates as unknown as CertificateService,
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

  it('emits eligible certificates and tolerates individual failures', async () => {
    certificates.generateAutoCertificate
      .mockRejectedValueOnce(new Error('already issued'))
      .mockResolvedValueOnce({ code: 'CERT-2' });
    await service.runOnce();
    expect(
      certificates.getCompletedEnrollmentsWithoutCertificate,
    ).toHaveBeenCalled();
    expect(certificates.generateAutoCertificate).toHaveBeenCalledTimes(2);
  });

  it('logs skipped execution when another worker owns the lock', async () => {
    lock.runExclusive.mockResolvedValue(false);
    await service.runOnce();
    expect(lock.logSkipped).toHaveBeenCalledWith(
      'academia:scheduled:automatic-certificates',
    );
  });

  it('limits simultaneous certificate generation to five', async () => {
    certificates.getCompletedEnrollmentsWithoutCertificate.mockResolvedValue(
      Array.from({ length: 12 }, (_, index) => ({ id: `enrollment-${index}` })),
    );
    let active = 0;
    let peak = 0;
    certificates.generateAutoCertificate.mockImplementation(() => {
      active++;
      peak = Math.max(peak, active);
      return new Promise<void>((resolve) =>
        setImmediate(() => {
          active--;
          resolve();
        }),
      );
    });
    await service.runOnce();
    expect(certificates.generateAutoCertificate).toHaveBeenCalledTimes(12);
    expect(peak).toBe(5);
    expect(active).toBe(0);
  });

  it('continues past the first page without loading all enrollments together', async () => {
    certificates.getCompletedEnrollmentsWithoutCertificate
      .mockResolvedValueOnce(
        Array.from({ length: 100 }, (_, index) => ({ id: `first-${index}` })),
      )
      .mockResolvedValueOnce([{ id: 'next-page' }]);
    await service.runOnce();
    expect(certificates.generateAutoCertificate).toHaveBeenCalledTimes(101);
    expect(certificates.generateAutoCertificate).toHaveBeenCalledWith(
      'next-page',
    );
  });

  it('swallows scheduler errors and clears an active timer on destroy', async () => {
    lock.runExclusive.mockRejectedValue(new Error('lock failure'));
    await expect(service.runOnce()).resolves.toBeUndefined();
    service.onModuleDestroy();
  });

  it('starts and stops the inline certificate timer when enabled', () => {
    jest.useFakeTimers();
    config.get.mockImplementation((key: string, fallback: unknown) => {
      if (key === 'NODE_ENV') return 'development';
      if (key === 'ENABLE_SCHEDULED_JOBS') return 'true';
      if (key === 'SCHEDULED_JOBS_MODE') return 'inline';
      if (key === 'CERTIFICATE_AUTO_INTERVAL_MS') return 60_000;
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
});

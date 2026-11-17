import { NestFactory } from '@nestjs/core';

jest.mock('./app.module', () => ({ AppModule: class AppModule {} }));
jest.mock('./modules/rrhh/rrhh-scheduler.service', () => ({
  RrhhSchedulerService: class RrhhSchedulerService {},
}));
jest.mock('./modules/certificates/certificate-scheduler.service', () => ({
  CertificateSchedulerService: class CertificateSchedulerService {},
}));
jest.mock('./modules/academic/academic-reminder-scheduler.service', () => ({
  AcademicReminderSchedulerService: class AcademicReminderSchedulerService {},
}));
jest.mock('@nestjs/core', () => ({
  NestFactory: { createApplicationContext: jest.fn() },
}));

describe('scheduled worker bootstrap', () => {
  it('starts configured intervals, runs jobs and shuts down idempotently', async () => {
    jest.useFakeTimers();
    const config = {
      get: jest.fn((name: string, fallback: number) => {
        const values: Record<string, unknown> = {
          CONTRACT_ALERT_INTERVAL_MS: 30_000,
          CERTIFICATE_AUTO_INTERVAL_MS: 'invalid',
          ACADEMIC_REMINDER_INTERVAL_MS: 120_000,
        };
        return values[name] ?? fallback;
      }),
    };
    const rrhh = { runOnce: jest.fn().mockResolvedValue(undefined) };
    const certificates = { runOnce: jest.fn().mockResolvedValue(undefined) };
    const academic = { runOnce: jest.fn().mockResolvedValue(undefined) };
    const payments = { runOnce: jest.fn().mockResolvedValue(undefined) };
    const automations = { runOnce: jest.fn().mockResolvedValue(undefined) };
    const app = {
      get: jest
        .fn()
        .mockReturnValueOnce(config)
        .mockReturnValueOnce(rrhh)
        .mockReturnValueOnce(certificates)
        .mockReturnValueOnce(academic)
        .mockReturnValueOnce(payments)
        .mockReturnValueOnce(automations),
      close: jest.fn().mockResolvedValue(undefined),
    };
    (NestFactory.createApplicationContext as jest.Mock).mockResolvedValue(app);
    const oldTerm = process.listeners('SIGTERM');
    const oldInt = process.listeners('SIGINT');

    jest.isolateModules(() => {
      jest.requireActual('./worker');
    });
    await jest.advanceTimersByTimeAsync(0);
    expect(rrhh.runOnce).toHaveBeenCalled();
    expect(certificates.runOnce).toHaveBeenCalled();
    expect(academic.runOnce).toHaveBeenCalled();
    expect(payments.runOnce).toHaveBeenCalled();
    expect(automations.runOnce).toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(60_000);
    expect(rrhh.runOnce).toHaveBeenCalledTimes(2);
    expect(certificates.runOnce).toHaveBeenCalledTimes(1);
    process.listeners('SIGTERM').at(-1)?.(undefined as never);
    process.listeners('SIGTERM').at(-1)?.(undefined as never);
    await jest.advanceTimersByTimeAsync(0);
    expect(app.close).toHaveBeenCalledTimes(1);

    for (const listener of process.listeners('SIGTERM')) {
      if (!oldTerm.includes(listener))
        process.removeListener('SIGTERM', listener);
    }
    for (const listener of process.listeners('SIGINT')) {
      if (!oldInt.includes(listener))
        process.removeListener('SIGINT', listener);
    }
    jest.useRealTimers();
  });

  it('closes the application and reports failures when an initial job rejects', async () => {
    const app = {
      get: jest
        .fn()
        .mockReturnValueOnce({
          get: jest.fn((_name: string, fallback: number) => fallback),
        })
        .mockReturnValueOnce({
          runOnce: jest.fn().mockRejectedValue(new Error('job failed')),
        })
        .mockReturnValueOnce({
          runOnce: jest.fn().mockResolvedValue(undefined),
        })
        .mockReturnValueOnce({
          runOnce: jest.fn().mockResolvedValue(undefined),
        })
        .mockReturnValueOnce({
          runOnce: jest.fn().mockResolvedValue(undefined),
        })
        .mockReturnValueOnce({
          runOnce: jest.fn().mockResolvedValue(undefined),
        }),
      close: jest.fn().mockResolvedValue(undefined),
    };
    (NestFactory.createApplicationContext as jest.Mock).mockResolvedValue(app);
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const previousExitCode = process.exitCode;
    jest.isolateModules(() => {
      jest.requireActual('./worker');
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    await Promise.resolve();
    expect(app.close).toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      'Worker de procesos programados detenido',
      expect.any(Error),
    );
    process.exitCode = previousExitCode;
    error.mockRestore();
  });
});

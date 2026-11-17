import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  createSchedulerLockDatabase,
  SchedulerLockService,
} from '../src/shared/infrastructure/scheduler/scheduler-lock.service';

describe('Scheduler session locks against PostgreSQL', () => {
  it('keeps a long job exclusive across two connections and releases it afterward', async () => {
    const config = new ConfigService({ DIRECT_URL: process.env.DATABASE_URL });
    const first = new SchedulerLockService(createSchedulerLockDatabase(config));
    const second = new SchedulerLockService(
      createSchedulerLockDatabase(config),
    );
    const key = `e2e:scheduler:${randomUUID()}`;
    let release!: () => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const running = first.runExclusive(key, () => {
      started();
      return waiting;
    });
    const otherTask = jest.fn().mockResolvedValue(undefined);
    try {
      await ready;
      // The previous interactive-transaction lock expired after five seconds.
      await new Promise<void>((resolve) => setTimeout(resolve, 5_500));
      await expect(second.runExclusive(key, otherTask)).resolves.toBe(false);
      expect(otherTask).not.toHaveBeenCalled();
      release();
      await expect(running).resolves.toBe(true);
      await expect(second.runExclusive(key, otherTask)).resolves.toBe(true);
      expect(otherTask).toHaveBeenCalledTimes(1);
    } finally {
      release();
      await running.catch(() => undefined);
      await Promise.all([first.onModuleDestroy(), second.onModuleDestroy()]);
    }
  }, 15_000);
});

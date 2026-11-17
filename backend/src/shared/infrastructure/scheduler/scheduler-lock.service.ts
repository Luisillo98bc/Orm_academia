import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

export const SCHEDULER_LOCK_DATABASE = Symbol('SCHEDULER_LOCK_DATABASE');

export function createSchedulerLockDatabase(
  config: ConfigService,
): PrismaClient {
  const url = new URL(
    config.get<string>('DIRECT_URL') ||
      config.getOrThrow<string>('DATABASE_URL'),
  );
  if (url.searchParams.get('pgbouncer') === 'true') {
    throw new Error(
      'Los bloqueos programados requieren DIRECT_URL sin pooling por transacción',
    );
  }
  // Una única sesión, sin reciclaje por inactividad, conserva los advisory locks.
  url.searchParams.set('connection_limit', '1');
  url.searchParams.set('max_idle_connection_lifetime', '0');
  url.searchParams.set('max_connection_lifetime', '0');
  return new PrismaClient({
    datasources: { db: { url: url.toString() } },
    log: ['error'],
  });
}

/**
 * Evita que una tarea programada se ejecute simultáneamente en varias
 * instancias. Una sesión dedicada conserva el bloqueo durante todo el trabajo,
 * sin mantener abierta una transacción ni ocupar el pool de consultas HTTP.
 */
@Injectable()
export class SchedulerLockService implements OnModuleDestroy {
  private readonly logger = new Logger(SchedulerLockService.name);
  private readonly running = new Map<string, Promise<boolean>>();
  private stopping = false;
  private failed = false;

  constructor(
    @Inject(SCHEDULER_LOCK_DATABASE) private readonly database: PrismaClient,
  ) {}

  async runExclusive(
    lockName: string,
    task: () => Promise<void>,
  ): Promise<boolean> {
    if (this.stopping || this.failed || this.running.has(lockName))
      return false;
    const execution = this.execute(lockName, task);
    this.running.set(lockName, execution);
    try {
      return await execution;
    } finally {
      this.running.delete(lockName);
    }
  }

  private async execute(
    lockName: string,
    task: () => Promise<void>,
  ): Promise<boolean> {
    let acquired = false;
    try {
      const rows = await this.database.$queryRaw<Array<{ locked: boolean }>>`
        SELECT pg_try_advisory_lock(hashtext(${lockName})) AS locked
      `;
      acquired = rows[0]?.locked === true;
    } catch (error) {
      this.failed = true;
      throw error;
    }
    if (!acquired) return false;
    const result = await Promise.resolve()
      .then(task)
      .then(
        () => ({ ok: true as const }),
        (error: unknown) => ({ ok: false as const, error }),
      );
    try {
      const rows = await this.database.$queryRaw<Array<{ unlocked: boolean }>>`
        SELECT pg_advisory_unlock(hashtext(${lockName})) AS unlocked
      `;
      if (!rows[0]?.unlocked)
        throw new Error(`Se perdió la sesión de bloqueo: ${lockName}`);
    } catch (error) {
      // No reutilizar una sesión cuyo estado ya no podemos garantizar.
      this.failed = true;
      this.logger.error(
        'Bloqueos programados detenidos; reinicia el worker',
        error,
      );
      if (result.ok) throw error;
    }
    if (!result.ok) throw result.error;
    return true;
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    await Promise.allSettled(this.running.values());
    await this.database.$disconnect();
  }

  logSkipped(lockName: string) {
    this.logger.debug(`Tarea omitida porque ya está ejecutándose: ${lockName}`);
  }
}

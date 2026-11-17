import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RrhhService } from './rrhh.service';
import { SchedulerLockService } from '../../shared/infrastructure/scheduler/scheduler-lock.service';

/** Ejecuta las alertas de contratos sin depender de una petición HTTP. */
@Injectable()
export class RrhhSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RrhhSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly rrhhService: RrhhService,
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
      this.logger.log('Procesos programados deshabilitados por configuración');
      return;
    }

    const configuredInterval = Number(
      this.configService.get('CONTRACT_ALERT_INTERVAL_MS', 86_400_000),
    );
    const intervalMs = Number.isFinite(configuredInterval)
      ? Math.max(60_000, configuredInterval)
      : 86_400_000;
    void this.run();
    this.timer = setInterval(() => void this.run(), intervalMs);
    this.timer.unref();
    this.logger.log(`Alertas de contratos programadas cada ${intervalMs} ms`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(): Promise<void> {
    try {
      const lockName = 'academia:scheduled:contract-alerts';
      const acquired = await this.schedulerLock.runExclusive(lockName, () =>
        this.rrhhService.processExpiringContractAlerts().then(() => undefined),
      );
      if (!acquired) this.schedulerLock.logSkipped(lockName);
    } catch (error) {
      this.logger.error(
        'No se pudieron procesar las alertas de contratos',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private run() {
    return this.runOnce();
  }
}

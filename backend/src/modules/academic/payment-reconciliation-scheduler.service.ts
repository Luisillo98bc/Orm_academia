import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './application/services/payments.service';
import { SchedulerLockService } from '../../shared/infrastructure/scheduler/scheduler-lock.service';

/** Busca cargos Culqi que quedaron inciertos después de un timeout de red. */
@Injectable()
export class PaymentReconciliationSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(
    PaymentReconciliationSchedulerService.name,
  );
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
    private readonly lock: SchedulerLockService,
  ) {}

  onModuleInit() {
    if (
      this.config.get('NODE_ENV', 'development') === 'test' ||
      this.config.get('ENABLE_SCHEDULED_JOBS', 'true') === 'false' ||
      ['worker', 'disabled'].includes(
        this.config.get('SCHEDULED_JOBS_MODE', 'inline'),
      )
    )
      return;

    const configured = Number(
      this.config.get('PAYMENT_RECONCILIATION_INTERVAL_MS', 300_000),
    );
    const intervalMs = Number.isFinite(configured)
      ? Math.max(60_000, configured)
      : 300_000;
    void this.run();
    this.timer = setInterval(() => void this.run(), intervalMs);
    this.timer.unref();
    this.logger.log(`Conciliación de pagos cada ${intervalMs} ms`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(): Promise<void> {
    if (
      this.config.get<string>('PAYMENTS_MODE', 'cash').toLowerCase() !==
      'online'
    )
      return;
    const lockName = 'academia:scheduled:payment-reconciliation';
    const acquired = await this.lock.runExclusive(lockName, async () => {
      const result = await this.payments.reconcilePendingCulqiPayments();
      if (result.inspected > 0)
        this.logger.log(`Pagos Culqi: ${JSON.stringify(result)}`);
    });
    if (!acquired) this.lock.logSkipped(lockName);
  }

  private run() {
    return this.runOnce().catch((error: unknown) => {
      this.logger.error(
        'No se pudieron conciliar pagos Culqi',
        error instanceof Error ? error.stack : String(error),
      );
    });
  }
}

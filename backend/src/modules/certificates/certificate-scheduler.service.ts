import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CertificateService } from './application/services/certificate.service';
import { SchedulerLockService } from '../../shared/infrastructure/scheduler/scheduler-lock.service';

/** Emite certificados de finalización elegibles sin intervención manual. */
@Injectable()
export class CertificateSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(CertificateSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly certificateService: CertificateService,
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
      this.logger.log('Emisión automática de certificados deshabilitada');
      return;
    }

    const configuredInterval = Number(
      this.configService.get('CERTIFICATE_AUTO_INTERVAL_MS', 86_400_000),
    );
    const intervalMs = Number.isFinite(configuredInterval)
      ? Math.max(60_000, configuredInterval)
      : 86_400_000;
    void this.run();
    this.timer = setInterval(() => void this.run(), intervalMs);
    this.timer.unref();
    this.logger.log(
      `Certificados automáticos programados cada ${intervalMs} ms`,
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(): Promise<void> {
    try {
      const lockName = 'academia:scheduled:automatic-certificates';
      const acquired = await this.schedulerLock.runExclusive(
        lockName,
        async () => {
          let afterId: string | undefined;
          let emitted = 0;
          let failed = 0;
          while (true) {
            const pending =
              await this.certificateService.getCompletedEnrollmentsWithoutCertificate(
                afterId,
                100,
              );
            // Cinco emisiones a la vez dejan conexiones disponibles para otros trabajos.
            for (let offset = 0; offset < pending.length; offset += 5) {
              const results = await Promise.allSettled(
                pending
                  .slice(offset, offset + 5)
                  .map((enrollment) =>
                    this.certificateService.generateAutoCertificate(
                      enrollment.id,
                    ),
                  ),
              );
              emitted += results.filter(
                (result) => result.status === 'fulfilled',
              ).length;
              failed += results.filter(
                (result) => result.status === 'rejected',
              ).length;
            }
            if (pending.length < 100) break;
            afterId = pending[pending.length - 1].id;
          }
          if (emitted + failed > 0) {
            this.logger.log(
              `Certificados automáticos: ${emitted} emitidos, ${failed} omitidos`,
            );
          }
        },
      );
      if (!acquired) this.schedulerLock.logSkipped(lockName);
    } catch (error) {
      this.logger.error(
        'No se pudieron procesar los certificados automáticos',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private run() {
    return this.runOnce();
  }
}

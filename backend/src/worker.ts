import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RrhhSchedulerService } from './modules/rrhh/rrhh-scheduler.service';
import { CertificateSchedulerService } from './modules/certificates/certificate-scheduler.service';
import { AcademicReminderSchedulerService } from './modules/academic/academic-reminder-scheduler.service';
import { ConfigService } from '@nestjs/config';
import { PaymentReconciliationSchedulerService } from './modules/academic/payment-reconciliation-scheduler.service';
import { AutomationService } from './modules/automation/automation.service';

/** Proceso persistente para tareas programadas. Ejecutar como servicio separado. */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const configService = app.get(ConfigService);
  const rrhhScheduler = app.get(RrhhSchedulerService);
  const certificateScheduler = app.get(CertificateSchedulerService);
  const academicReminderScheduler = app.get(AcademicReminderSchedulerService);
  const paymentReconciliationScheduler = app.get(
    PaymentReconciliationSchedulerService,
  );
  const automations = app.get(AutomationService);

  const interval = (name: string, fallback: number) => {
    const configured = Number(configService.get(name, fallback));
    return Number.isFinite(configured)
      ? Math.max(60_000, Math.floor(configured))
      : fallback;
  };

  const contractIntervalMs = interval('CONTRACT_ALERT_INTERVAL_MS', 86_400_000);
  const certificateIntervalMs = interval(
    'CERTIFICATE_AUTO_INTERVAL_MS',
    86_400_000,
  );
  const academicReminderIntervalMs = interval(
    'ACADEMIC_REMINDER_INTERVAL_MS',
    3_600_000,
  );
  const paymentReconciliationIntervalMs = interval(
    'PAYMENT_RECONCILIATION_INTERVAL_MS',
    300_000,
  );
  let shuttingDown = false;
  const jobs: Array<{
    name: string;
    interval: number;
    run: () => Promise<unknown>;
  }> = [
    {
      name: 'contratos',
      interval: contractIntervalMs,
      run: () => rrhhScheduler.runOnce(),
    },
    {
      name: 'certificados',
      interval: certificateIntervalMs,
      run: () => certificateScheduler.runOnce(),
    },
    {
      name: 'recordatorios',
      interval: academicReminderIntervalMs,
      run: () => academicReminderScheduler.runOnce(),
    },
    {
      name: 'pagos',
      interval: paymentReconciliationIntervalMs,
      run: () => paymentReconciliationScheduler.runOnce(),
    },
    {
      name: 'automatizaciones',
      interval: interval('AUTOMATION_INTERVAL_MS', 3_600_000),
      run: () => automations.runOnce(),
    },
  ];
  const running = new Map<string, Promise<void>>();
  const runJob = (job: (typeof jobs)[number]): Promise<void> => {
    if (shuttingDown || running.has(job.name)) return Promise.resolve();
    const execution = Promise.resolve()
      .then(job.run)
      .then(() => undefined)
      .finally(() => {
        running.delete(job.name);
      });
    running.set(job.name, execution);
    return execution;
  };
  const timers = jobs.map((job) =>
    setInterval(() => {
      void runJob(job).catch((error: unknown) => {
        console.error(`Fallo en tarea programada: ${job.name}`, error);
      });
    }, job.interval),
  );

  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    timers.forEach(clearInterval);
    await Promise.allSettled(running.values());
    await app.close();
  };

  process.once('SIGTERM', () => void shutdown());
  process.once('SIGINT', () => void shutdown());

  try {
    await Promise.all(jobs.map(runJob));
    console.log(
      `Worker activo: alertas cada ${contractIntervalMs} ms; certificados cada ${certificateIntervalMs} ms; recordatorios académicos cada ${academicReminderIntervalMs} ms`,
    );
  } catch (error) {
    await shutdown();
    throw error;
  }
}

void bootstrap().catch((error: unknown) => {
  console.error('Worker de procesos programados detenido', error);
  process.exitCode = 1;
});

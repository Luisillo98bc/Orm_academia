import { AcademicModule } from './modules/academic/academic.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { AutomationModule } from './modules/automation/automation.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { CommunicationModule } from './modules/communication/communication.module';
import { EvaluationModule } from './modules/evaluation/evaluation.module';
import { HealthModule } from './modules/health/health.module';
import { ProspectsModule } from './modules/prospects/prospects.module';
import { RrhhModule } from './modules/rrhh/rrhh.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SupportModule } from './modules/support/support.module';
import { MailModule } from './shared/infrastructure/mail/mail.module';
import {
  materialMulterConfig,
  multerConfig,
  voucherMulterConfig,
} from './shared/infrastructure/multer/multer.config';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module';
import { StorageModule } from './shared/infrastructure/storage/storage.module';
import { AppModule } from './app.module';
import './shared/infrastructure';
import './modules/auth/application';
import './modules/auth/application/dtos';
import './modules/auth/application/use-cases';
import './modules/auth/domain';
import './modules/auth/infrastructure';
import './modules/auth/presentation';
import './modules/academic/domain';
import './modules/academic/domain/entities';
import './modules/academic/domain/repositories';
import './modules/academic/infrastructure';
import './modules/academic/infrastructure/repositories';
import './modules/evaluation/application';
import './modules/evaluation/application/dtos';
import './modules/evaluation/application/use-cases';
import './modules/evaluation/domain';
import './modules/evaluation/domain/entities';
import './modules/evaluation/domain/repositories';
import './modules/evaluation/infrastructure';
import './modules/evaluation/presentation';

describe('Nest module wiring', () => {
  it('loads every feature module and configures the root middleware', () => {
    const modules = [
      AppModule,
      AcademicModule,
      AuditModule,
      AuthModule,
      AutomationModule,
      CertificatesModule,
      CommunicationModule,
      EvaluationModule,
      HealthModule,
      ProspectsModule,
      RrhhModule,
      SettingsModule,
      SupportModule,
      MailModule,
      PrismaModule,
      StorageModule,
    ];
    expect(modules.every((module) => typeof module === 'function')).toBe(true);

    const consumer = {
      apply: jest.fn().mockReturnThis(),
      forRoutes: jest.fn(),
    };
    new AppModule().configure(consumer);
    expect(consumer.apply).toHaveBeenCalled();
    expect(consumer.forRoutes).toHaveBeenCalledWith('*');
  });

  it('validates the configured multer file types', () => {
    for (const config of [
      multerConfig,
      materialMulterConfig,
      voucherMulterConfig,
    ]) {
      expect(config).toEqual(
        expect.objectContaining({
          limits: expect.any(Object) as jest.AsymmetricMatcher,
          fileFilter: expect.any(Function) as jest.AsymmetricMatcher,
        }),
      );
    }
    const accept = jest.fn();
    multerConfig.fileFilter(
      {} as never,
      { originalname: 'avatar.png', mimetype: 'image/png' } as never,
      accept,
    );
    expect(accept).toHaveBeenCalledWith(null, true);
    const reject = jest.fn();
    materialMulterConfig.fileFilter(
      {} as never,
      {
        originalname: 'script.exe',
        mimetype: 'application/x-msdownload',
      } as never,
      reject,
    );
    expect(reject).toHaveBeenCalledWith(expect.any(Error));
  });
});

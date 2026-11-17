// ============================================================================
// AppModule — Módulo raíz del monolito modular
// ============================================================================

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/env.validation';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { AcademicModule } from './modules/academic/academic.module';
import { EvaluationModule } from './modules/evaluation/evaluation.module';
import { RrhhModule } from './modules/rrhh/rrhh.module';
import { CommunicationModule } from './modules/communication/communication.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { SettingsModule } from './modules/settings/settings.module';
import { MailModule } from './shared/infrastructure/mail/mail.module';
import { StorageModule } from './shared/infrastructure/storage/storage.module';
import { HealthModule } from './modules/health/health.module';
import { DecimalSerializationInterceptor } from './shared/infrastructure/interceptors/decimal-serialization.interceptor';
import { ProspectsModule } from './modules/prospects/prospects.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { CsrfOriginMiddleware } from './shared/infrastructure/security/csrf-origin.middleware';
import { SupportModule } from './modules/support/support.module';
import { AutomationModule } from './modules/automation/automation.module';

@Module({
  imports: [
    // ── Configuración global desde .env ──
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnvironment,
    }),

    // ── Rate Limiting ──
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minuto
        limit: 120, // Máximo 120 peticiones por minuto por IP
      },
    ]),

    // ── Infraestructura compartida ──
    PrismaModule,
    MailModule,
    StorageModule,
    HealthModule,

    // ── Módulos de negocio ──
    AuthModule,
    AcademicModule,
    EvaluationModule,
    RrhhModule,
    CommunicationModule,
    CertificatesModule,
    SettingsModule,
    ProspectsModule,
    AuditModule,
    SupportModule,
    AutomationModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: DecimalSerializationInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CsrfOriginMiddleware).forRoutes('*');
  }
}

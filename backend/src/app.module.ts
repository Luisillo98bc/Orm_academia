// ============================================================================
// AppModule — Módulo raíz del monolito modular
// ============================================================================

import { Module } from '@nestjs/common';
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
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { StorageModule } from './shared/infrastructure/storage/storage.module';
import { HealthModule } from './modules/health/health.module';
import { DecimalSerializationInterceptor } from './shared/infrastructure/interceptors/decimal-serialization.interceptor';

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

    // ── Archivos Estáticos ──

    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),

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
  ],
})
export class AppModule {}

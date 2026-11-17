// ============================================================================
// PrismaModule — Módulo global de Prisma
// ============================================================================

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  createSchedulerLockDatabase,
  SCHEDULER_LOCK_DATABASE,
  SchedulerLockService,
} from '../scheduler/scheduler-lock.service';

/**
 * Módulo global que exporta PrismaService para que esté
 * disponible en todos los módulos sin necesidad de importarlo.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    PrismaService,
    {
      provide: SCHEDULER_LOCK_DATABASE,
      inject: [ConfigService],
      useFactory: createSchedulerLockDatabase,
    },
    SchedulerLockService,
  ],
  exports: [PrismaService, SchedulerLockService],
})
export class PrismaModule {}

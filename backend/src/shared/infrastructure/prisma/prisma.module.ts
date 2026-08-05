// ============================================================================
// PrismaModule — Módulo global de Prisma
// ============================================================================

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Módulo global que exporta PrismaService para que esté
 * disponible en todos los módulos sin necesidad de importarlo.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

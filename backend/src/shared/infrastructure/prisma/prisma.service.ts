// ============================================================================
// PrismaService — Servicio global de conexión a la base de datos
//
// Singleton reutilizable por todos los módulos del monolito.
// ============================================================================

import {
  Injectable,
  OnModuleInit,
  OnApplicationShutdown,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Wrapper de NestJS sobre PrismaClient que gestiona el ciclo
 * de vida de la conexión a PostgreSQL.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnApplicationShutdown
{
  constructor() {
    const logQueries = process.env.PRISMA_LOG_QUERIES === 'true';
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? logQueries
            ? ['query', 'info', 'warn', 'error']
            : ['info', 'warn', 'error']
          : ['warn', 'error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}

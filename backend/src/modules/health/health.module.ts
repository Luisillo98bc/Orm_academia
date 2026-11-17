import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { RequestMetricsService } from './request-metrics.service';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [HealthService, RequestMetricsService],
  exports: [RequestMetricsService],
})
export class HealthModule {}

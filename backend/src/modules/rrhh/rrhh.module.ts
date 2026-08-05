import { Module } from '@nestjs/common';
import { RrhhService } from './rrhh.service';
import { RrhhController } from './rrhh.controller';
import { PrismaWorkerRepository } from './infrastructure/repositories/prisma-worker.repository';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RrhhController],
  providers: [RrhhService, PrismaWorkerRepository],
})
export class RrhhModule {}

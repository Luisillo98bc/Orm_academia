import { Module } from '@nestjs/common';
import { RrhhService } from './rrhh.service';
import { RrhhController } from './rrhh.controller';
import { PrismaWorkerRepository } from './infrastructure/repositories/prisma-worker.repository';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { CommunicationModule } from '../communication/communication.module';
import { RrhhContractController } from './rrhh-contract.controller';
import { RrhhMyPayrollController } from './rrhh-my-payroll.controller';
import { RrhhSchedulerService } from './rrhh-scheduler.service';

@Module({
  imports: [PrismaModule, CommunicationModule],
  controllers: [
    RrhhController,
    RrhhContractController,
    RrhhMyPayrollController,
  ],
  providers: [RrhhService, PrismaWorkerRepository, RrhhSchedulerService],
})
export class RrhhModule {}

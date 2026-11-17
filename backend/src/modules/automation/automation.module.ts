import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { CommunicationModule } from '../communication/communication.module';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';

@Module({
  imports: [PrismaModule, CommunicationModule],
  controllers: [AutomationController],
  providers: [AutomationService],
})
export class AutomationModule {}

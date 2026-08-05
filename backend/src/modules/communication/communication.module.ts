import { Module } from '@nestjs/common';
import { CommunicationService } from './communication.service';
import { CommunicationController } from './communication.controller';
import { DirectMessagesService } from './direct-messages.service';
import { DirectMessagesController } from './direct-messages.controller';
import { ChatGateway } from './chat.gateway';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    CommunicationController,
    DirectMessagesController,
    NotificationsController,
  ],
  providers: [
    CommunicationService,
    DirectMessagesService,
    ChatGateway,
    NotificationsGateway,
    NotificationsService,
  ],
  exports: [NotificationsService],
})
export class CommunicationModule {}

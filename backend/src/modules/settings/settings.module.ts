import { Module } from '@nestjs/common';
import { SettingsController } from './presentation/settings.controller';
import { SettingsService } from './application/settings.service';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}

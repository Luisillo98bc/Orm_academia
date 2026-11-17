import { Module } from '@nestjs/common';
import { CertificateController } from './presentation/controllers/certificate.controller';
import { CertificateService } from './application/services/certificate.service';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { CertificateSchedulerService } from './certificate-scheduler.service';

@Module({
  imports: [PrismaModule, SettingsModule],
  controllers: [CertificateController],
  providers: [CertificateService, CertificateSchedulerService],
  exports: [CertificateService],
})
export class CertificatesModule {}

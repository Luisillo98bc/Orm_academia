import { Module } from '@nestjs/common';
import { CertificateController } from './presentation/controllers/certificate.controller';
import { CertificateService } from './application/services/certificate.service';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CertificateController],
  providers: [CertificateService],
  exports: [CertificateService],
})
export class CertificatesModule {}

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import {
  LegacyUploadController,
  StorageController,
} from './storage.controller';
import { AuthModule } from '../../../modules/auth/auth.module';

@Global()
@Module({
  imports: [ConfigModule, AuthModule],
  providers: [StorageService],
  controllers: [StorageController, LegacyUploadController],
  exports: [StorageService],
})
export class StorageModule {}

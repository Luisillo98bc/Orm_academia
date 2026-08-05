import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { PlatformSettingsEntity } from '../domain/platform-settings.entity';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<PlatformSettingsEntity> {
    const settings = await this.prisma.platformSettings.findFirst();
    if (!settings) {
      // Return default if empty
      const newSettings = await this.prisma.platformSettings.create({
        data: {
          whatsappNumber: '51999999999',
          supportEmail: 'soporte@academia.com',
        },
      });
      return newSettings as any;
    }
    return settings as any;
  }

  async updateSettings(data: {
    logoUrl?: string;
    whatsappNumber?: string;
    supportEmail?: string;
    facebookUrl?: string;
    instagramUrl?: string;
  }): Promise<PlatformSettingsEntity> {
    const settings = await this.getSettings();
    return this.prisma.platformSettings.update({
      where: { id: settings.id },
      data,
    }) as any;
  }
}

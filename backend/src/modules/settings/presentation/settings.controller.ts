import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from '../application/settings.service';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/infrastructure/guards/roles.guard';
import { Roles } from '../../auth/infrastructure/guards/roles.decorator';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateSettings(
    @Body()
    body: {
      logoUrl?: string;
      whatsappNumber?: string;
      supportEmail?: string;
      facebookUrl?: string;
      instagramUrl?: string;
    },
  ) {
    return this.settingsService.updateSettings(body);
  }
}

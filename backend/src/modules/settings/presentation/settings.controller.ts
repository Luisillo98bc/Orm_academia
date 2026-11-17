import { Controller, Get, Patch, Body, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SettingsService } from '../application/settings.service';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/infrastructure/guards/roles.guard';
import { Roles } from '../../auth/infrastructure/guards/roles.decorator';
import { Permissions } from '../../auth/infrastructure/guards/permissions.decorator';
import { PermissionsGuard } from '../../auth/infrastructure/guards/permissions.guard';
import { AuditService } from '../../audit/audit.service';
import { UpdateSettingsDto } from '../application/dtos/update-settings.dto';

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly audit: AuditService,
  ) {}

  @Get('public')
  async getPublicSettings() {
    return this.settingsService.getPublicSettings();
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('ADMIN')
  @Permissions('settings:update')
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('ADMIN')
  @Permissions('settings:update')
  async updateSettings(
    @Body() body: UpdateSettingsDto,
    @Req() request: Request & { user: { id: string } },
  ) {
    const previous = await this.settingsService.getSettings();
    const updated = await this.settingsService.updateSettings(body);
    await this.audit.log(
      {
        userId: request.user.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      },
      'UPDATE_SETTINGS',
      'PlatformSettings',
      updated.id,
      previous,
      updated,
    );
    return updated;
  }
}

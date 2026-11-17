import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  Post,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../auth/infrastructure/strategies/current-user.decorator';
import type { AuthenticatedUser } from '../auth/infrastructure/strategies/authenticated-user.type';
import { Roles } from '../auth/infrastructure/guards/roles.decorator';
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('communication/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('unread')
  @ApiOperation({
    summary: 'Obtener notificaciones no leídas del usuario actual',
  })
  getUnread(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getUnreadNotifications(user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener todas las notificaciones del usuario actual',
  })
  getAll(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getAllNotifications(user.id);
  }

  @Get('page')
  @ApiOperation({ summary: 'Listar notificaciones paginadas' })
  getPage(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationsService.getNotificationPage(user.id, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Obtener preferencias de notificaciones' })
  getPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getPreferences(user.id);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Actualizar preferencias de notificaciones' })
  updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: Partial<{
      emailEnabled: boolean;
      whatsappEnabled: boolean;
      pushEnabled: boolean;
      contractAlerts: boolean;
      academicAlerts: boolean;
      paymentAlerts: boolean;
    }>,
  ) {
    const allowedKeys = [
      'emailEnabled',
      'whatsappEnabled',
      'pushEnabled',
      'contractAlerts',
      'academicAlerts',
      'paymentAlerts',
    ] as const;
    const safeData = Object.fromEntries(
      allowedKeys
        .filter((key) => typeof body[key] === 'boolean')
        .map((key) => [key, body[key]]),
    );
    return this.notificationsService.updatePreferences(user.id, safeData);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar una notificación específica como leída' })
  markAsRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAsRead(id, user.id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Marcar todas las notificaciones como leídas' })
  markAllAsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Get('admin/deliveries')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Consultar trazabilidad de envíos por canal' })
  listDeliveries(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('channel') channel?: string,
    @Query('status') status?: string,
  ) {
    return this.notificationsService.listDeliveries({
      page: Number(page) || 1,
      limit: Number(limit) || 25,
      channel,
      status,
    });
  }

  @Post('admin/deliveries/retry')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Reintentar entregas externas fallidas' })
  retryDeliveries(@Query('limit') limit?: string) {
    return this.notificationsService.retryFailedDeliveries(Number(limit) || 25);
  }
}

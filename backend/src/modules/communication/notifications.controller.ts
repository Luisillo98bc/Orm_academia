import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('unread')
  @ApiOperation({
    summary: 'Obtener notificaciones no leídas del usuario actual',
  })
  getUnread(@Request() req: any) {
    return this.notificationsService.getUnreadNotifications(req.user.userId);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener todas las notificaciones del usuario actual',
  })
  getAll(@Request() req: any) {
    return this.notificationsService.getAllNotifications(req.user.userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar una notificación específica como leída' })
  markAsRead(@Param('id') id: string, @Request() req: any) {
    return this.notificationsService.markAsRead(id, req.user.userId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Marcar todas las notificaciones como leídas' })
  markAllAsRead(@Request() req: any) {
    return this.notificationsService.markAllAsRead(req.user.userId);
  }
}

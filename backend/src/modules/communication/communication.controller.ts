import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { CommunicationService } from './communication.service';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard';
import { Roles } from '../auth/infrastructure/guards/roles.decorator';
import { CurrentUser } from '../auth/infrastructure/strategies/current-user.decorator';
import { Public } from '../auth/infrastructure/decorators/public.decorator';

@Controller('communication')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommunicationController {
  constructor(private readonly communicationService: CommunicationService) {}

  // ── ANUNCIOS ──
  @Get('announcements/public')
  @Public()
  getLandingAnnouncements() {
    return this.communicationService.getLandingAnnouncements();
  }

  @Get('announcements')
  getAnnouncements(@CurrentUser() user: any) {
    let target = 'ALL';
    const role = user.roles?.[0];
    if (role === 'DOCENTE') target = 'TEACHERS';
    if (role === 'ESTUDIANTE') target = 'STUDENTS';
    // Admin y RRHH ven TODO
    if (role === 'ADMIN' || role === 'RRHH') target = 'ALL';

    return this.communicationService.getAnnouncements(target as any);
  }

  @Post('announcements')
  @Roles('ADMIN')
  createAnnouncement(@CurrentUser() user: any, @Body() body: any) {
    return this.communicationService.createAnnouncement(user.id, body);
  }

  @Patch('announcements/:id')
  @Roles('ADMIN')
  updateAnnouncement(@Param('id') id: string, @Body() body: any) {
    return this.communicationService.updateAnnouncement(id, body);
  }

  @Delete('announcements/:id')
  @Roles('ADMIN')
  async deleteAnnouncement(@Param('id') id: string) {
    await this.communicationService.deleteAnnouncement(id);
    return { statusCode: HttpStatus.OK, message: 'Anuncio eliminado' };
  }

  // ── FOROS ──
  @Get('cohorts/:id/forums')
  getForums(@Param('id') cohortId: string) {
    return this.communicationService.getForums(cohortId);
  }

  @Post('cohorts/:id/forums')
  createForum(
    @Param('id') cohortId: string,
    @Body() body: { title: string; description?: string },
    @CurrentUser() user: any,
  ) {
    return this.communicationService.createForum(
      cohortId,
      body.title,
      body.description,
      user.id,
    );
  }

  @Get('forums/:id/messages')
  getForumMessages(@Param('id') forumId: string) {
    return this.communicationService.getForumMessages(forumId);
  }

  @Post('forums/:id/messages')
  createMessage(
    @CurrentUser() user: any,
    @Param('id') forumId: string,
    @Body() body: { content: string; parentId?: string },
  ) {
    return this.communicationService.createMessage(
      forumId,
      user.id,
      body.content,
      body.parentId,
    );
  }

  @Get('forums/:id/detail')
  getForumDetail(@Param('id') forumId: string) {
    return this.communicationService.getForumDetail(forumId);
  }

  @Delete('forums/messages/:id')
  async deleteForumMessage(
    @Param('id') messageId: string,
    @CurrentUser() user: any,
  ) {
    try {
      await this.communicationService.deleteForumMessage(messageId, user.id);
      return { statusCode: HttpStatus.OK, message: 'Mensaje eliminado' };
    } catch {
      throw new ForbiddenException('No autorizado para eliminar este mensaje');
    }
  }

  // ── NOTIFICATIONS ──
  @Get('notifications')
  getNotifications(@CurrentUser() user: any) {
    return this.communicationService.getUserNotifications(user.id);
  }

  @Patch('notifications/read-all')
  markAllAsRead(@CurrentUser() user: any) {
    return this.communicationService.markAllNotificationsAsRead(user.id);
  }

  @Patch('notifications/:id/read')
  markAsRead(@Param('id') id: string, @CurrentUser() user: any) {
    return this.communicationService.markNotificationAsRead(id, user.id);
  }
}

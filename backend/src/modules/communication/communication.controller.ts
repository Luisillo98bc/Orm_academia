import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { CommunicationService } from './communication.service';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard';
import { Roles } from '../auth/infrastructure/guards/roles.decorator';
import { CurrentUser } from '../auth/infrastructure/strategies/current-user.decorator';
import { Public } from '../auth/infrastructure/decorators/public.decorator';
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from './dtos/announcement.dto';
import { CreateForumMessageDto, UpsertForumDto } from './dtos/forum.dto';
import { PermissionsGuard } from '../auth/infrastructure/guards/permissions.guard';
import { Permissions } from '../auth/infrastructure/guards/permissions.decorator';
import type { AuthenticatedUser } from '../auth/infrastructure/strategies/authenticated-user.type';

@Controller('communication')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class CommunicationController {
  constructor(private readonly communicationService: CommunicationService) {}

  // ── ANUNCIOS ──
  @Get('announcements/public')
  @Public()
  getLandingAnnouncements() {
    return this.communicationService.getLandingAnnouncements();
  }

  @Get('announcements')
  getAnnouncements(@CurrentUser() user: AuthenticatedUser) {
    let target: 'ALL' | 'TEACHERS' | 'STUDENTS' = 'ALL';
    const role = user.roles?.[0];
    if (role === 'DOCENTE') target = 'TEACHERS';
    if (role === 'ESTUDIANTE') target = 'STUDENTS';
    // Admin y RRHH ven TODO
    if (role === 'ADMIN' || role === 'RRHH') target = 'ALL';

    return this.communicationService.getAnnouncements(target);
  }

  @Get('announcements/manage')
  @Roles('ADMIN')
  getAnnouncementManagement() {
    return this.communicationService.getAnnouncementManagement();
  }

  @Post('announcements')
  @Roles('ADMIN')
  @Permissions('communications:update')
  createAnnouncement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateAnnouncementDto,
  ) {
    return this.communicationService.createAnnouncement(user.id, body);
  }

  @Patch('announcements/:id')
  @Roles('ADMIN')
  @Permissions('communications:update')
  updateAnnouncement(
    @Param('id') id: string,
    @Body() body: UpdateAnnouncementDto,
  ) {
    return this.communicationService.updateAnnouncement(id, body);
  }

  @Delete('announcements/:id')
  @Roles('ADMIN')
  @Permissions('communications:update')
  async deleteAnnouncement(@Param('id') id: string) {
    await this.communicationService.deleteAnnouncement(id);
    return { statusCode: HttpStatus.OK, message: 'Anuncio eliminado' };
  }

  // ── FOROS ──
  @Get('cohorts/:id/forums')
  @Roles('ADMIN', 'DOCENTE', 'ESTUDIANTE')
  getForums(
    @Param('id') cohortId: string,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.communicationService.getForums(cohortId, user);
  }

  @Post('cohorts/:id/forums')
  @Roles('ADMIN', 'DOCENTE')
  createForum(
    @Param('id') cohortId: string,
    @Body() body: UpsertForumDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.communicationService.createForum(
      cohortId,
      body.title,
      user.id,
      body.description,
      user,
    );
  }

  @Patch('forums/:id')
  @Roles('ADMIN', 'DOCENTE')
  updateForum(
    @Param('id') forumId: string,
    @Body() body: UpsertForumDto,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.communicationService.updateForum(
      forumId,
      body.title,
      body.description,
      user,
    );
  }

  @Delete('forums/:id')
  @Roles('ADMIN', 'DOCENTE')
  async deleteForum(
    @Param('id') forumId: string,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    await this.communicationService.deleteForum(forumId, user);
    return { statusCode: HttpStatus.OK, message: 'Foro eliminado' };
  }

  @Get('forums/:id/messages')
  @Roles('ADMIN', 'DOCENTE', 'ESTUDIANTE')
  getForumMessages(
    @Param('id') forumId: string,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.communicationService.getForumMessages(forumId, user);
  }

  @Post('forums/:id/messages')
  @Roles('ADMIN', 'DOCENTE', 'ESTUDIANTE')
  createMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') forumId: string,
    @Body() body: CreateForumMessageDto,
  ) {
    return this.communicationService.createMessage(
      forumId,
      user.id,
      body.content,
      body.parentId,
      user,
    );
  }

  @Get('forums/:id/detail')
  @Roles('ADMIN', 'DOCENTE', 'ESTUDIANTE')
  getForumDetail(
    @Param('id') forumId: string,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.communicationService.getForumDetail(forumId, user);
  }

  @Delete('forums/messages/:id')
  async deleteForumMessage(
    @Param('id') messageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    try {
      await this.communicationService.deleteForumMessage(messageId, user);
      return { statusCode: HttpStatus.OK, message: 'Mensaje eliminado' };
    } catch {
      throw new ForbiddenException('No autorizado para eliminar este mensaje');
    }
  }
}

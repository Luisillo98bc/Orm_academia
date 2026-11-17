import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard';
import { CurrentUser } from '../auth/infrastructure/strategies/current-user.decorator';
import { DirectMessagesService } from './direct-messages.service';
import type { AuthenticatedUser } from '../auth/infrastructure/strategies/authenticated-user.type';
import { SendDirectMessageDto } from './dtos/forum.dto';

@ApiTags('Direct Messages')
@ApiBearerAuth()
@Controller('communication/direct-messages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DirectMessagesController {
  constructor(private readonly dmService: DirectMessagesService) {}

  @Get('contacts')
  @ApiOperation({ summary: 'Obtener contactos disponibles para chat' })
  async getContacts(@CurrentUser() user: AuthenticatedUser) {
    return this.dmService.getContacts(user.id, user.roles?.[0] || 'ESTUDIANTE');
  }

  @Get('unread')
  @ApiOperation({ summary: 'Obtener conteo de mensajes no leídos' })
  async getUnread(@CurrentUser() user: AuthenticatedUser) {
    const count = await this.dmService.getUnreadCount(user.id);
    return { unread: count };
  }

  @Get('unread-by-contact')
  async getUnreadByContact(@CurrentUser() user: AuthenticatedUser) {
    return this.dmService.getUnreadByContact(user.id);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Obtener historial de conversación con un usuario' })
  async getConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') otherUserId: string,
    @Query('before', new ParseUUIDPipe({ optional: true })) before?: string,
  ) {
    return this.dmService.getConversation(user.id, otherUserId, before);
  }

  @Post()
  @ApiOperation({ summary: 'Enviar mensaje directo' })
  async sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SendDirectMessageDto,
  ) {
    return this.dmService.sendMessage(user.id, body.receiverId, body.content);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar mensaje como leído' })
  async markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') messageId: string,
  ) {
    return this.dmService.markAsRead(messageId, user.id);
  }
}

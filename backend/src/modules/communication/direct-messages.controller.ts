import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard';
import { CurrentUser } from '../auth/infrastructure/strategies/current-user.decorator';
import { DirectMessagesService } from './direct-messages.service';

@ApiTags('Direct Messages')
@ApiBearerAuth()
@Controller('communication/direct-messages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DirectMessagesController {
  constructor(private readonly dmService: DirectMessagesService) {}

  @Get('contacts')
  @ApiOperation({ summary: 'Obtener contactos disponibles para chat' })
  async getContacts(@CurrentUser() user: any) {
    return this.dmService.getContacts(user.id, user.roles?.[0] || 'ESTUDIANTE');
  }

  @Get('unread')
  @ApiOperation({ summary: 'Obtener conteo de mensajes no leídos' })
  async getUnread(@CurrentUser() user: any) {
    const count = await this.dmService.getUnreadCount(user.id);
    return { unread: count };
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Obtener historial de conversación con un usuario' })
  async getConversation(
    @CurrentUser() user: any,
    @Param('userId') otherUserId: string,
  ) {
    return this.dmService.getConversation(user.id, otherUserId);
  }

  @Post()
  @ApiOperation({ summary: 'Enviar mensaje directo' })
  async sendMessage(
    @CurrentUser() user: any,
    @Body() body: { receiverId: string; content: string },
  ) {
    return this.dmService.sendMessage(user.id, body.receiverId, body.content);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar mensaje como leído' })
  async markAsRead(@CurrentUser() user: any, @Param('id') messageId: string) {
    return this.dmService.markAsRead(messageId, user.id);
  }
}

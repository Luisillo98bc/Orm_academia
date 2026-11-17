import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard';
import { Roles } from '../auth/infrastructure/guards/roles.decorator';
import { CurrentUser } from '../auth/infrastructure/strategies/current-user.decorator';
import { SupportService } from './support.service';
import {
  AddSupportMessageDto,
  CreateSupportTicketDto,
  SupportTicketQueryDto,
  UpdateSupportTicketDto,
} from './support.dto';

@ApiTags('Support')
@ApiBearerAuth()
@Controller('support/tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'RRHH', 'DOCENTE', 'ESTUDIANTE')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get()
  @ApiOperation({ summary: 'Listar tickets visibles para el usuario' })
  list(
    @CurrentUser() user: { id: string; roles: string[] },
    @Query() query: SupportTicketQueryDto,
  ) {
    return this.support.list(user, query);
  }

  @Post()
  @ApiOperation({ summary: 'Crear ticket de soporte' })
  create(
    @CurrentUser() user: { id: string; roles: string[] },
    @Body() body: CreateSupportTicketDto,
  ) {
    return this.support.create(user, body);
  }

  @Get(':id')
  get(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.support.get(id, user);
  }

  @Post(':id/messages')
  addMessage(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; roles: string[] },
    @Body() body: AddSupportMessageDto,
  ) {
    return this.support.addMessage(id, user, body.body, body.internalNote);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; roles: string[] },
    @Body() body: UpdateSupportTicketDto,
  ) {
    return this.support.update(id, user, body);
  }
}

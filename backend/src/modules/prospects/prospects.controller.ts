import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/infrastructure/decorators/public.decorator';
import { CurrentUser } from '../auth/infrastructure/strategies/current-user.decorator';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { Roles } from '../auth/infrastructure/guards/roles.decorator';
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard';
import { Permissions } from '../auth/infrastructure/guards/permissions.decorator';
import { PermissionsGuard } from '../auth/infrastructure/guards/permissions.guard';
import { AuditService } from '../audit/audit.service';
import { ProspectsService } from './prospects.service';
import type { AuthenticatedUser } from '../auth/infrastructure/strategies/authenticated-user.type';
import { PaginationQueryDto } from '../../shared/pagination/pagination-query.dto';
import { CreateProspectDto } from './dto/create-prospect.dto';
import { AddProspectNoteDto } from './dto/add-prospect-note.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Prospects')
@ApiBearerAuth()
@Controller('prospects')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ProspectsController {
  constructor(
    private readonly prospects: ProspectsService,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Registrar una solicitud comercial pública' })
  create(@Body() body: CreateProspectDto) {
    return this.prospects.create(body);
  }

  @Get()
  @Roles('ADMIN', 'RRHH')
  @Permissions('prospects:read')
  list(
    @Query()
    query: PaginationQueryDto & {
      status?: string;
      search?: string;
      assignedToId?: string;
      cohortId?: string;
    },
  ) {
    return this.prospects.list(query);
  }

  @Post('admin')
  @Roles('ADMIN', 'RRHH')
  @Permissions('prospects:update')
  @ApiOperation({
    summary: 'Registrar un prospecto manualmente desde el panel',
  })
  async createManual(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Body()
    body: {
      name: string;
      email?: string;
      phone?: string;
      message?: string;
      cohortId?: string;
      source?: string;
      status?: any;
      assignedToId?: string;
      nextFollowUpAt?: string;
    },
  ) {
    const created = await this.prospects.createManual(body);
    await this.audit.log(
      {
        userId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
      'CREATE_PROSPECT_MANUAL',
      'Prospect',
      created.id,
      undefined,
      created,
    );
    return created;
  }

  @Get('stats')
  @Roles('ADMIN', 'RRHH')
  @Permissions('prospects:read')
  stats() {
    return this.prospects.stats();
  }

  @Patch(':id')
  @Roles('ADMIN', 'RRHH')
  @Permissions('prospects:update')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Body() body: Record<string, unknown>,
  ) {
    const previous = await this.prospects.findOne(id);
    const updated = await this.prospects.update(id, body);
    await this.audit.log(
      {
        userId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
      'UPDATE_PROSPECT',
      'Prospect',
      id,
      previous,
      updated,
    );
    return updated;
  }

  @Post(':id/notes')
  @Roles('ADMIN', 'RRHH')
  @Permissions('prospects:update')
  async addNote(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Body() body: AddProspectNoteDto,
  ) {
    const note = await this.prospects.addNote(id, user.id, body.content);
    await this.audit.log(
      {
        userId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
      'ADD_PROSPECT_NOTE',
      'Prospect',
      id,
      undefined,
      { noteId: note.id },
    );
    return note;
  }
}

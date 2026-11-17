import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/infrastructure/guards/roles.guard';
import { Roles } from '../../../auth/infrastructure/guards/roles.decorator';
import { CurrentUser } from '../../../auth/infrastructure/strategies/current-user.decorator';
import type { AuthenticatedUser } from '../../../auth/infrastructure/strategies/authenticated-user.type';
import { AuditService } from '../../../audit/audit.service';
import { EnrollmentManagementService } from '../../application/services/enrollment-management.service';
import {
  EnrollmentCandidatesQueryDto,
  EnrollmentManagementQueryDto,
  UpdateEnrollmentStatusDto,
} from '../../application/dtos/enrollment-management.dto';

@Controller('academic/enrollment-management')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'RRHH')
export class EnrollmentManagementController {
  constructor(
    private readonly management: EnrollmentManagementService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Query() query: EnrollmentManagementQueryDto) {
    return this.management.list(query);
  }

  @Get('candidates')
  candidates(@Query() query: EnrollmentCandidatesQueryDto) {
    return this.management.candidates(query);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="matriculas.csv"')
  export(@Query() query: EnrollmentManagementQueryDto) {
    return this.management.export(query);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateEnrollmentStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const result = await this.management.updateStatus(id, body);
    await this.audit.log(
      {
        userId: user.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      },
      'UPDATE_ENROLLMENT_STATUS',
      'Enrollment',
      id,
      { status: result.previousStatus },
      { status: body.status, reason: body.reason?.trim() || null },
    );
    return result.enrollment;
  }
}

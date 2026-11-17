import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { Roles } from '../auth/infrastructure/guards/roles.decorator';
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard';
import { Permissions } from '../auth/infrastructure/guards/permissions.decorator';
import { PermissionsGuard } from '../auth/infrastructure/guards/permissions.guard';
import { AuditService } from './audit.service';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('ADMIN')
@Permissions('audit_logs:read')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('search') search?: string,
  ) {
    return this.audit.list(
      Number(page) || 1,
      Number(limit) || 25,
      action,
      entity,
      fromDate,
      toDate,
      search,
    );
  }

  @Get('security-summary')
  getSecuritySummary(@Query('days') days?: string) {
    return this.audit.getSecuritySummary(Number(days) || 30);
  }
}

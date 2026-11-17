import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard';
import { Roles } from '../auth/infrastructure/guards/roles.decorator';
import { AutomationService } from './automation.service';

@ApiTags('Automation')
@ApiBearerAuth()
@Controller('automation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AutomationController {
  constructor(private readonly automation: AutomationService) {}
  @Get('status')
  @ApiOperation({ summary: 'Estado de las campañas automáticas' })
  status() {
    return this.automation.status();
  }
  @Post('run')
  @ApiOperation({ summary: 'Ejecutar campañas de seguimiento ahora' })
  run() {
    return this.automation.runOnce();
  }
}

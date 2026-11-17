import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../auth/infrastructure/decorators/public.decorator';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { Roles } from '../../../auth/infrastructure/guards/roles.decorator';
import { RolesGuard } from '../../../auth/infrastructure/guards/roles.guard';
import { ConversionAnalyticsService } from '../../application/services/conversion-analytics.service';
import { TrackConversionDto } from '../../application/dtos/track-conversion.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Conversion analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConversionAnalyticsController {
  constructor(private readonly analytics: ConversionAnalyticsService) {}

  @Public()
  @Post('events')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Registrar un evento anónimo del embudo comercial' })
  track(@Body() body: TrackConversionDto) {
    return this.analytics.track(body);
  }

  @Get('conversion')
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ver el embudo de conversión comercial' })
  getConversion(@Query('days') days?: string) {
    return this.analytics.getFunnel(Number(days || 30));
  }

  @Get('conversion-by-program')
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ver conversión agrupada por programa' })
  getConversionByProgram(@Query('days') days?: string) {
    return this.analytics.getConversionByProgram(Number(days || 30));
  }

  @Get('retention')
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ver retención, avance y riesgo por cohorte' })
  getRetention(@Query('days') days?: string) {
    return this.analytics.getRetention(Number(days || 180));
  }

  @Get('operational-overview')
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Ver indicadores operativos y entregas de notificaciones',
  })
  getOperationalOverview(@Query('days') days?: string) {
    return this.analytics.getOperationalOverview(Number(days || 30));
  }
}

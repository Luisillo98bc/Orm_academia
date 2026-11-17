import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/infrastructure/decorators/public.decorator';
import { HealthService } from './health.service';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard';
import { Roles } from '../auth/infrastructure/guards/roles.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Comprobar la API y la conexión con PostgreSQL' })
  check() {
    return this.healthService.check();
  }

  @Public()
  @Get('ready')
  @ApiOperation({
    summary: 'Comprobar si la API está lista para recibir tráfico',
  })
  readiness() {
    return this.healthService.readiness();
  }

  @Public()
  @Get('metrics/prometheus')
  @Header('Content-Type', 'text/plain; version=0.0.4')
  @ApiOperation({ summary: 'Exponer métricas HTTP para Prometheus' })
  prometheus() {
    return this.healthService.prometheus();
  }

  @Get('details')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Ver el estado técnico y las integraciones' })
  details() {
    return this.healthService.details();
  }

  @Get('metrics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Métricas operativas de las últimas 24 horas' })
  metrics() {
    return this.healthService.metrics();
  }
}

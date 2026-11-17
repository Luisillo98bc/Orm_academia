import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { SearchService } from '../../application/services/search.service';
import { CurrentUser } from '../../../auth/infrastructure/strategies/current-user.decorator';

@ApiTags('Search')
@ApiBearerAuth()
@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Búsqueda global multi-entidad' })
  @ApiQuery({ name: 'q', required: true, description: 'Término de búsqueda' })
  async globalSearch(
    @Query('q') query: string,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.searchService.globalSearch(query, user);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
  Query,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { RrhhService } from './rrhh.service';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard';
import { Roles } from '../auth/infrastructure/guards/roles.decorator';
import { PermissionsGuard } from '../auth/infrastructure/guards/permissions.guard';
import { Permissions } from '../auth/infrastructure/guards/permissions.decorator';
import { SignContractDto } from './dtos/sign-contract.dto';
import { RejectContractDto } from './dtos/reject-contract.dto';
import { ContractsQueryDto } from '../../shared/pagination/contracts-query.dto';

type ContractRequest = Request & {
  user: { id: string; roles?: string[] };
};

@Controller('rrhh/contracts')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class RrhhContractController {
  constructor(private readonly rrhhService: RrhhService) {}

  @Get()
  @Roles('ADMIN', 'RRHH')
  @Permissions('rrhh:read')
  findAll(@Query() query: ContractsQueryDto) {
    return this.rrhhService.findAllContracts(
      query.page,
      query.limit,
      query.status,
      query.search,
    );
  }

  @Get('me')
  @Roles('ADMIN', 'RRHH', 'DOCENTE')
  findMine(
    @Req() req: ContractRequest,
    @Query() pagination: ContractsQueryDto,
  ) {
    return this.rrhhService.findMyContracts(
      req.user.id,
      pagination.page,
      pagination.limit,
    );
  }

  @Post(':id/send')
  @Roles('ADMIN', 'RRHH')
  @Permissions('rrhh:update')
  send(@Param('id') id: string, @Req() req: ContractRequest) {
    return this.rrhhService.sendContract(id, req.user.id);
  }

  @Patch(':id/sign')
  @Roles('ADMIN', 'RRHH', 'DOCENTE')
  sign(
    @Param('id') id: string,
    @Body() dto: SignContractDto,
    @Req() req: ContractRequest,
  ) {
    return this.rrhhService.signContract(id, req.user.id, dto.signatureName);
  }

  @Patch(':id/reject')
  @Roles('ADMIN', 'RRHH', 'DOCENTE')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectContractDto,
    @Req() req: ContractRequest,
  ) {
    return this.rrhhService.rejectContract(id, req.user.id, dto.reason);
  }

  @Post(':id/approve')
  @Roles('ADMIN', 'RRHH')
  @Permissions('rrhh:update')
  approve(@Param('id') id: string, @Req() req: ContractRequest) {
    return this.rrhhService.approveContract(id, req.user.id);
  }

  @Get(':id/pdf')
  @Roles('ADMIN', 'RRHH', 'DOCENTE')
  async pdf(
    @Param('id') id: string,
    @Req() req: ContractRequest,
    @Res() res: Response,
  ) {
    const buffer = await this.rrhhService.generateContractPdf(
      id,
      req.user.id,
      req.user.roles || [],
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="contrato-${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}

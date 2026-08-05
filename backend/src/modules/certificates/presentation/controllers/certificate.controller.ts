import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CertificateService } from '../../application/services/certificate.service';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/infrastructure/guards/roles.guard';
import { Roles } from '../../../auth/infrastructure/guards/roles.decorator';
import type { Response } from 'express';

@Controller('certificates')
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) {}

  /**
   * Listar TODOS los certificados — solo ADMIN / RRHH
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'RRHH')
  async getAll() {
    const result = await this.certificateService.getAllCertificates();
    return {
      statusCode: HttpStatus.OK,
      message: 'Certificados obtenidos',
      data: result,
    };
  }

  /**
   * Matrículas completadas SIN certificado — para emisión manual
   */
  @Get('pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'RRHH')
  async getPending() {
    const result =
      await this.certificateService.getCompletedEnrollmentsWithoutCertificate();
    return {
      statusCode: HttpStatus.OK,
      message: 'Matrículas pendientes de certificado',
      data: result,
    };
  }

  /**
   * Emisión manual por Administrador o RRHH
   */
  @Post('manual')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'RRHH')
  @HttpCode(HttpStatus.CREATED)
  async issueManualCertificate(
    @Body('enrollmentId') enrollmentId: string,
    @Req() req: any,
  ) {
    const result = await this.certificateService.generateManualCertificate(
      enrollmentId,
      req.user.id,
    );
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Certificado emitido manualmente',
      data: result,
    };
  }

  /**
   * Emisión automática solicitada por el alumno
   */
  @Post('auto')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ESTUDIANTE')
  @HttpCode(HttpStatus.CREATED)
  async issueAutoCertificate(@Body('enrollmentId') enrollmentId: string) {
    const result =
      await this.certificateService.generateAutoCertificate(enrollmentId);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Certificado emitido exitosamente',
      data: result,
    };
  }

  /**
   * Obtener todos los certificados del estudiante logueado
   */
  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ESTUDIANTE')
  async getMyCertificates(@Req() req: any) {
    const result = await this.certificateService.getMyCertificates(req.user.id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Certificados obtenidos',
      data: result,
    };
  }

  /**
   * Descargar el certificado como PDF
   */
  @Get(':code/pdf')
  @UseGuards(JwtAuthGuard)
  async downloadPdf(@Param('code') code: string, @Res() res: Response) {
    const pdfBuffer =
      await this.certificateService.generateCertificatePdf(code);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="certificado-${code}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  /**
   * Ruta PÚBLICA para verificar la validez de un certificado
   */
  @Get('verify/:code')
  async verifyCertificate(@Param('code') code: string) {
    const result = await this.certificateService.verifyCertificate(code);
    return {
      statusCode: HttpStatus.OK,
      message: 'Certificado verificado como válido',
      data: result,
    };
  }
}

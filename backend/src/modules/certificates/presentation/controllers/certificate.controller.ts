import {
  Controller,
  Post,
  Get,
  Body,
  BadRequestException,
  Param,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CertificateService } from '../../application/services/certificate.service';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/infrastructure/guards/roles.guard';
import { Roles } from '../../../auth/infrastructure/guards/roles.decorator';
import type { Response } from 'express';
import { CurrentUser } from '../../../auth/infrastructure/strategies/current-user.decorator';
import type { AuthenticatedUser } from '../../../auth/infrastructure/strategies/authenticated-user.type';

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

  @Get('templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'RRHH', 'DOCENTE')
  async getTemplates() {
    return {
      statusCode: HttpStatus.OK,
      message: 'Plantillas disponibles',
      data: await this.certificateService.getCertificateTemplates(),
    };
  }

  /**
   * Emisión manual por Administrador o RRHH
   */
  @Post('manual')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'RRHH', 'DOCENTE')
  @HttpCode(HttpStatus.CREATED)
  async issueManualCertificate(
    @Body('enrollmentId') enrollmentId: string,
    @Body('certificateType')
    certificateType: 'COMPLETION' | 'GRADES' = 'COMPLETION',
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!['COMPLETION', 'GRADES'].includes(certificateType)) {
      throw new BadRequestException('Tipo de certificado no válido');
    }
    const result = await this.certificateService.generateManualCertificate(
      enrollmentId,
      user.id,
      certificateType,
      user.roles,
    );
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Certificado emitido manualmente',
      data: result,
    };
  }

  @Post('cohort/:cohortId/student/:studentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCENTE')
  @HttpCode(HttpStatus.CREATED)
  async issueForStudent(
    @Param('cohortId') cohortId: string,
    @Param('studentId') studentId: string,
    @Body('certificateType')
    certificateType: 'COMPLETION' | 'GRADES' = 'GRADES',
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!['COMPLETION', 'GRADES'].includes(certificateType)) {
      throw new BadRequestException('Tipo de certificado no válido');
    }
    const result = await this.certificateService.generateForStudent(
      cohortId,
      studentId,
      user.id,
      certificateType,
      user.roles,
    );
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Certificado emitido',
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
  async getMyCertificates(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.certificateService.getMyCertificates(user.id);
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

  @Get('verify/:code/qr')
  async verifyCertificateQr(@Param('code') code: string, @Res() res: Response) {
    const qr = await this.certificateService.generateVerificationQr(code);
    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=300',
    });
    res.end(qr);
  }
}

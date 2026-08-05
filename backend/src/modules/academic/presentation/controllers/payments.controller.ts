import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/infrastructure/guards/roles.guard';
import { Roles } from '../../../auth/infrastructure/guards/roles.decorator';
import { CurrentUser } from '../../../auth/infrastructure/strategies/current-user.decorator';
import { Public } from '../../../auth/infrastructure/decorators/public.decorator';
import { PaymentsService } from '../../application/services/payments.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from '../../../../shared/infrastructure/multer/multer.config';

import { StorageService } from '../../../../shared/infrastructure/storage/storage.service';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly storageService: StorageService,
  ) {}

  // ─── 1. Checkout: crear enrollment + payment ────────────────────────────
  @Post('checkout')
  @Roles('ESTUDIANTE')
  @ApiOperation({ summary: 'Crear matrícula y registro de pago (Estudiante)' })
  async checkout(
    @CurrentUser() user: any,
    @Body() body: { cohortId: string; method: string },
  ) {
    if (!['TARJETA', 'YAPE', 'PLIN', 'EFECTIVO'].includes(body.method)) {
      throw new BadRequestException('Método de pago inválido');
    }
    return this.paymentsService.checkout(user.id, body.cohortId, body.method);
  }

  // ─── 2. Crear Orden en Culqi (para Yape, PagoEfectivo, etc.) ───────────
  @Post('create-order')
  @Roles('ESTUDIANTE')
  @ApiOperation({
    summary: 'Crear orden de pago en Culqi (necesario para PagoEfectivo/Yape)',
  })
  async createOrder(
    @CurrentUser() user: any,
    @Body() body: { paymentId: string; phone?: string },
  ) {
    if (!body.paymentId) {
      throw new BadRequestException('paymentId es requerido');
    }
    return this.paymentsService.createCulqiOrder(
      body.paymentId,
      user.id,
      user.email,
      user.firstName || 'Estudiante',
      user.lastName || '',
      body.phone || '',
    );
  }

  // ─── 3. Procesar cargo con Token de Culqi (tarjeta/Yape) ───────────────
  @Post('charge')
  @Roles('ESTUDIANTE')
  @ApiOperation({
    summary: 'Procesar cargo con token de Culqi Checkout (Tarjeta/Yape)',
  })
  async processCharge(
    @CurrentUser() user: any,
    @Body() body: { paymentId: string; tokenId: string },
  ) {
    if (!body.paymentId || !body.tokenId) {
      throw new BadRequestException('paymentId y tokenId son requeridos');
    }
    return this.paymentsService.processChargeWithToken(
      body.paymentId,
      body.tokenId,
      user.email,
    );
  }

  // ─── 4. Subir comprobante (voucher manual para Yape/Plin/Efectivo) ─────
  @Post(':id/voucher')
  @Roles('ESTUDIANTE')
  @ApiOperation({ summary: 'Subir comprobante de pago (Voucher)' })
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async uploadVoucher(
    @Param('id') paymentId: string,
    @UploadedFile() file: any,
  ) {
    if (!file) throw new BadRequestException('Archivo no subido');
    const voucherUrl = await this.storageService.uploadFile(file, 'vouchers');
    return this.paymentsService.uploadVoucher(paymentId, voucherUrl);
  }

  // ─── 5. Aprobar pago manual (Admin/RRHH) ───────────────────────────────
  @Patch(':id/approve')
  @Roles('ADMIN', 'RRHH')
  @ApiOperation({ summary: 'Aprobar pago manualmente (Admin/RRHH)' })
  async approvePayment(@Param('id') paymentId: string) {
    return this.paymentsService.approvePayment(paymentId);
  }

  // ─── 6. Mis pagos (Estudiante) ─────────────────────────────────────────
  @Get('my-payments')
  @Roles('ESTUDIANTE')
  @ApiOperation({ summary: 'Ver mis pagos' })
  async getMyPayments(@CurrentUser() user: any) {
    return this.paymentsService.getMyPayments(user.id);
  }

  // ─── 7. Pagos pendientes (Admin) ───────────────────────────────────────
  @Get('pending')
  @Roles('ADMIN', 'RRHH')
  @ApiOperation({ summary: 'Listar todos los pagos pendientes de validación' })
  async getAllPendingPayments() {
    return this.paymentsService.getAllPendingPayments();
  }

  // ─── 8. Webhook de Culqi (público, sin auth) ──────────────────────────
  @Public()
  @Post('webhook/culqi')
  @ApiOperation({
    summary: 'Webhook de Culqi para pagos asíncronos (PagoEfectivo)',
  })
  async culqiWebhook(@Body() body: any) {
    return this.paymentsService.handleCulqiWebhook(body);
  }
}

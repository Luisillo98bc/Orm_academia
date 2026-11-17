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
  Req,
  Query,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/infrastructure/guards/roles.guard';
import { Roles } from '../../../auth/infrastructure/guards/roles.decorator';
import { CurrentUser } from '../../../auth/infrastructure/strategies/current-user.decorator';
import { Public } from '../../../auth/infrastructure/decorators/public.decorator';
import { PaymentsService } from '../../application/services/payments.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { voucherMulterConfig } from '../../../../shared/infrastructure/multer/multer.config';

import { StorageService } from '../../../../shared/infrastructure/storage/storage.service';
import { Permissions } from '../../../auth/infrastructure/guards/permissions.decorator';
import { PermissionsGuard } from '../../../auth/infrastructure/guards/permissions.guard';
import { AuditService } from '../../../audit/audit.service';
import type { AuthenticatedUser } from '../../../auth/infrastructure/strategies/authenticated-user.type';
import { PaginationQueryDto } from '../../../../shared/pagination/pagination-query.dto';
import { CheckoutDto } from '../../application/dtos/checkout.dto';
import {
  ChargeTokenDto,
  CreateCulqiOrderDto,
  NextInstallmentDto,
  RejectPaymentDto,
} from '../../application/dtos/payments-operations.dto';
import { PaymentsQueryDto } from '../../application/dtos/payments-query.dto';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly storageService: StorageService,
    private readonly audit: AuditService,
  ) {}

  // ─── 1. Checkout: crear enrollment + payment ────────────────────────────
  @Post('checkout')
  @Roles('ESTUDIANTE', 'ADMIN')
  @ApiOperation({ summary: 'Crear matrícula y registro de pago' })
  async checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CheckoutDto,
  ) {
    const onlineMode = process.env.PAYMENTS_MODE?.toLowerCase() === 'online';
    const allowedMethods = onlineMode
      ? ['TARJETA', 'YAPE', 'PLIN', 'EFECTIVO']
      : ['EFECTIVO', 'YAPE', 'PLIN'];
    if (!allowedMethods.includes(body.method)) {
      throw new BadRequestException(
        onlineMode
          ? 'El método de pago online no está disponible'
          : 'Actualmente el pago con tarjeta en línea está deshabilitado; elige Efectivo, Yape o Plin',
      );
    }
    return this.paymentsService.checkout(
      user.id,
      body.cohortId,
      body.method,
      body.analyticsSessionId,
      body.idempotencyKey,
    );
  }

  // ─── 2. Crear Orden en Culqi (para Yape, PagoEfectivo, etc.) ───────────
  @Post('create-order')
  @Roles('ESTUDIANTE', 'ADMIN')
  @ApiOperation({
    summary: 'Crear orden de pago en Culqi (necesario para PagoEfectivo/Yape)',
  })
  async createOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCulqiOrderDto,
  ) {
    if (!body.paymentId) {
      throw new BadRequestException('paymentId es requerido');
    }
    return this.paymentsService.createCulqiOrder(
      body.paymentId,
      user.id,
      user.email,
      'Estudiante',
      '',
      body.phone || '',
    );
  }

  // ─── 3. Procesar cargo con Token de Culqi (tarjeta/Yape) ───────────────
  @Post('charge')
  @Roles('ESTUDIANTE', 'ADMIN')
  @ApiOperation({
    summary: 'Procesar cargo con token de Culqi Checkout (Tarjeta/Yape)',
  })
  async processCharge(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ChargeTokenDto,
  ) {
    if (!body.paymentId || !body.tokenId) {
      throw new BadRequestException('paymentId y tokenId son requeridos');
    }
    return this.paymentsService.processChargeWithToken(
      body.paymentId,
      body.tokenId,
      user.email,
      user.id,
    );
  }

  // ─── 4. Subir comprobante (voucher manual para Yape/Plin/Efectivo) ─────
  @Post(':id/voucher')
  @Roles('ESTUDIANTE', 'ADMIN')
  @ApiOperation({ summary: 'Subir comprobante de pago (Voucher)' })
  @UseInterceptors(FileInterceptor('file', voucherMulterConfig))
  async uploadVoucher(
    @Param('id') paymentId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('Archivo no subido');
    const previous = await this.paymentsService.assertVoucherUploadAllowed(
      paymentId,
      user.id,
    );
    const voucherUrl = await this.storageService.uploadFile(file, 'vouchers');
    let payment;
    try {
      payment = await this.paymentsService.uploadVoucher(
        paymentId,
        voucherUrl,
        user.id,
      );
    } catch (error) {
      await this.storageService
        .deleteFile(voucherUrl)
        .catch((cleanupError) =>
          this.logger.error(
            'No se pudo retirar el comprobante rechazado',
            cleanupError,
          ),
        );
      throw error;
    }
    if (
      previous.voucherUrl?.startsWith('storage://') &&
      previous.voucherUrl !== voucherUrl
    ) {
      await this.storageService
        .deleteFile(previous.voucherUrl)
        .catch((cleanupError) =>
          this.logger.error(
            'No se pudo retirar el comprobante reemplazado',
            cleanupError,
          ),
        );
    }
    return payment;
  }

  // ─── 4b. Habilitar siguiente cuota / mensualidad ───────────────────────
  @Post(':id/next-installment')
  @Roles('ESTUDIANTE', 'ADMIN')
  @ApiOperation({
    summary:
      'Habilitar el pago de la siguiente mensualidad o cambiar método de la cuota pendiente',
  })
  async startNextInstallment(
    @Param('id') paymentId: string,
    @Body() body: NextInstallmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.startNextInstallment(
      paymentId,
      user.id,
      body?.method,
    );
  }

  // ─── 5. Aprobar pago manual (Admin/RRHH) ───────────────────────────────
  @Patch(':id/approve')
  @Roles('ADMIN', 'RRHH')
  @Permissions('payments:update')
  @ApiOperation({ summary: 'Aprobar pago manualmente (Admin/RRHH)' })
  async approvePayment(
    @Param('id') paymentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const payment = await this.paymentsService.approvePayment(paymentId);
    await this.audit.log(
      {
        userId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
      'APPROVE_PAYMENT',
      'Payment',
      paymentId,
      undefined,
      payment,
    );
    return payment;
  }

  @Patch(':id/reject')
  @Roles('ADMIN', 'RRHH')
  @Permissions('payments:update')
  @ApiOperation({ summary: 'Rechazar un pago pendiente indicando el motivo' })
  async rejectPayment(
    @Param('id') paymentId: string,
    @Body() body: RejectPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const payment = await this.paymentsService.rejectPayment(
      paymentId,
      body.reason,
    );
    await this.audit.log(
      {
        userId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
      'REJECT_PAYMENT',
      'Payment',
      paymentId,
      undefined,
      { status: payment.status, reason: payment.rejectionReason },
    );
    return payment;
  }

  // ─── 6. Mis pagos (Estudiante) ─────────────────────────────────────────
  @Get('my-payments')
  @Roles('ESTUDIANTE')
  @ApiOperation({ summary: 'Ver mis pagos' })
  async getMyPayments(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.paymentsService.getMyPayments(
      user.id,
      pagination.page,
      pagination.limit,
    );
  }

  // ─── 7. Pagos pendientes (Admin) ───────────────────────────────────────
  @Get('pending')
  @Roles('ADMIN', 'RRHH')
  @Permissions('payments:read')
  @ApiOperation({ summary: 'Listar todos los pagos pendientes de validación' })
  async getAllPendingPayments(@Query() pagination: PaymentsQueryDto) {
    if (pagination.search || pagination.method)
      return this.paymentsService.getAllPendingPayments(
        pagination.page,
        pagination.limit,
        false,
        { search: pagination.search, method: pagination.method },
      );
    return this.paymentsService.getAllPendingPayments(
      pagination.page,
      pagination.limit,
    );
  }

  @Get('history')
  @Roles('ADMIN', 'RRHH')
  @Permissions('payments:read')
  @ApiOperation({ summary: 'Historial de pagos aprobados y rechazados' })
  async getPaymentHistory(@Query() pagination: PaymentsQueryDto) {
    return this.paymentsService.getAllPendingPayments(
      pagination.page,
      pagination.limit,
      true,
      ...(pagination.search || pagination.method
        ? [{ search: pagination.search, method: pagination.method }]
        : []),
    );
  }

  // ─── 8. Webhook de Culqi (público, sin auth) ──────────────────────────
  @Public()
  @Post('webhook/culqi')
  @ApiOperation({
    summary: 'Webhook de Culqi para pagos asíncronos (PagoEfectivo)',
  })
  async culqiWebhook(@Body() body: Record<string, unknown>) {
    return this.paymentsService.handleCulqiWebhook(body);
  }
}

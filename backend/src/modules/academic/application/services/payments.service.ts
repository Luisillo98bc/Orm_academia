import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { COHORT_REPOSITORY } from '../../domain/repositories/cohort.repository.interface';
import type { ICohortRepository } from '../../domain/repositories/cohort.repository.interface';
import { MailService } from '../../../../shared/infrastructure/mail/mail.service';
import axios from 'axios';
import { moneyToMinorUnits, toMoney } from '../../../../shared/utils/money';

// ─── Culqi API Base URL ─────────────────────────────────────────────────────
const CULQI_API = 'https://api.culqi.com/v2';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly culqiSecretKey: string;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(COHORT_REPOSITORY)
    private readonly cohortRepository: ICohortRepository,
    private readonly mailService: MailService,
  ) {
    this.culqiSecretKey = process.env.CULQI_SECRET_KEY || '';
  }

  // ─── Helpers para llamadas a Culqi ──────────────────────────────────────
  private culqiHeaders() {
    if (!this.culqiSecretKey || this.culqiSecretKey.includes('xxxxxxxx')) {
      throw new ServiceUnavailableException(
        'La integración con Culqi no está configurada',
      );
    }

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.culqiSecretKey}`,
    };
  }

  // ─── 1. Checkout: Crear enrollment + payment (para todos los métodos) ───
  async checkout(userId: string, cohortId: string, method: string) {
    const cohort = await this.cohortRepository.findById(cohortId);
    if (!cohort) throw new NotFoundException('Cohorte no encontrada');

    // Validar capacidad
    if (!cohort.hasCapacity) {
      throw new BadRequestException('La cohorte ya no tiene cupos disponibles');
    }

    const price = toMoney(cohort.price);

    return this.prisma.$transaction(async (tx) => {
      // 1. Crear el Enrollment en PENDING_PAYMENT si hay precio, si no ACTIVE
      const status = price.greaterThan(0) ? 'PENDING_PAYMENT' : 'ACTIVE';

      const enrollment = await tx.enrollment.create({
        data: {
          userId,
          cohortId,
          status,
        },
      });

      // 2. Si cuesta 0, no hay pago que registrar
      if (price.isZero()) {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (user) {
          this.mailService
            .sendEnrollmentConfirmation(
              user.email,
              user.firstName,
              cohort.courseName || 'Curso',
              cohort.name,
            )
            .catch((e) => console.error(e));
        }
        return { message: 'Matrícula exitosa gratuita', enrollment };
      }

      // 3. Crear el registro de Pago en estado PENDING
      const payment = await tx.payment.create({
        data: {
          enrollmentId: enrollment.id,
          amount: price,
          method: method as any,
          status: 'PENDING',
          validatedAt: null,
        },
      });

      return {
        message: 'Enrollment y pago creados. Proceda con el pago.',
        enrollment,
        payment,
      };
    });
  }

  // ─── 2. Crear Orden en Culqi (necesario para Yape, PagoEfectivo, etc.) ──
  async createCulqiOrder(
    paymentId: string,
    userId: string,
    userEmail: string,
    userFirstName: string,
    userLastName: string,
    userPhone: string,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        enrollment: { include: { cohort: { include: { course: true } } } },
      },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');

    const cohortName = payment.enrollment?.cohort?.name || 'Matrícula';
    const courseName = payment.enrollment?.cohort?.course?.name || 'Curso';

    // Monto en céntimos (Culqi usa la unidad mínima de la moneda)
    const amountInCents = moneyToMinorUnits(payment.amount);

    try {
      const { data } = await axios.post(
        `${CULQI_API}/orders`,
        {
          amount: amountInCents,
          currency_code: 'PEN',
          description: `Matrícula: ${cohortName} - ${courseName}`,
          order_number: `ORD-${paymentId.slice(0, 8)}`,
          client_details: {
            first_name: userFirstName,
            last_name: userLastName,
            email: userEmail,
            phone_number: userPhone || '+51999999999',
          },
          expiration_date: Math.floor(Date.now() / 1000) + 86400, // 24 horas
          metadata: {
            paymentId: payment.id,
            enrollmentId: payment.enrollmentId,
            userId: userId,
          },
        },
        { headers: this.culqiHeaders() },
      );

      this.logger.log(`Culqi Order creada: ${data.id}`);

      return {
        orderId: data.id,
        amount: amountInCents,
        currency: 'PEN',
        paymentId: payment.id,
        enrollmentId: payment.enrollmentId,
      };
    } catch (err: any) {
      this.logger.error(
        'Error creando orden Culqi',
        err.response?.data || err.message,
      );
      throw new BadRequestException(
        err.response?.data?.user_message ||
          err.response?.data?.merchant_message ||
          'Error al crear orden en Culqi',
      );
    }
  }

  // ─── 3. Procesar Cargo con Token (tarjeta o Yape vía Checkout) ──────────
  async processChargeWithToken(
    paymentId: string,
    tokenId: string,
    email: string,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        enrollment: { include: { cohort: { include: { course: true } } } },
      },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    if (payment.status === 'COMPLETED') {
      throw new BadRequestException('Este pago ya fue procesado');
    }

    const amountInCents = moneyToMinorUnits(payment.amount);
    const cohortName = payment.enrollment?.cohort?.name || 'Matrícula';
    const courseName = payment.enrollment?.cohort?.course?.name || 'Curso';

    try {
      const { data } = await axios.post(
        `${CULQI_API}/charges`,
        {
          amount: amountInCents,
          currency_code: 'PEN',
          email,
          source_id: tokenId,
          description: `Matrícula: ${cohortName} - ${courseName}`,
          metadata: {
            paymentId: payment.id,
            enrollmentId: payment.enrollmentId,
          },
        },
        { headers: this.culqiHeaders() },
      );

      this.logger.log(
        `✅ Cargo Culqi exitoso: ${data.id} — Estado: ${data.outcome?.type}`,
      );

      // Si el cargo fue exitoso, activar matrícula
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: paymentId },
          data: { status: 'COMPLETED', validatedAt: new Date() },
        });

        await tx.enrollment.update({
          where: { id: payment.enrollmentId },
          data: { status: 'ACTIVE' },
        });
      });

      // Enviar emails de confirmación
      const user = await this.prisma.user.findUnique({
        where: { id: payment.enrollment?.userId },
      });
      if (user) {
        this.mailService
          .sendPaymentApproved(user.email, user.firstName, payment.amount)
          .catch((e) => console.error(e));
        this.mailService
          .sendEnrollmentConfirmation(
            user.email,
            user.firstName,
            courseName,
            cohortName,
          )
          .catch((e) => console.error(e));
      }

      return {
        message: '¡Pago procesado exitosamente!',
        chargeId: data.id,
        status: 'COMPLETED',
      };
    } catch (err: any) {
      this.logger.error(
        'Error procesando cargo Culqi',
        err.response?.data || err.message,
      );
      throw new BadRequestException(
        err.response?.data?.user_message ||
          err.response?.data?.merchant_message ||
          'Error al procesar el pago con Culqi',
      );
    }
  }

  // ─── 4. Webhook de Culqi (para PagoEfectivo y órdenes asíncronas) ──────
  private async verifyCulqiEvent(eventId: string) {
    if (!/^evt_(test|live)_[A-Za-z0-9]+$/.test(eventId)) {
      throw new BadRequestException('Identificador de evento Culqi inválido');
    }

    try {
      const { data } = await axios.get(
        `${CULQI_API}/events/${encodeURIComponent(eventId)}`,
        { headers: this.culqiHeaders() },
      );
      return data;
    } catch (error: any) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.warn(`No se pudo verificar el evento Culqi ${eventId}`);
      throw new BadRequestException('El evento Culqi no pudo ser verificado');
    }
  }

  async handleCulqiWebhook(body: any) {
    const eventId = String(body?.id || '');
    const event = await this.verifyCulqiEvent(eventId);
    const eventType = event?.type;
    this.logger.log(`Webhook Culqi recibido: ${eventType}`);

    // Culqi envía eventos como "order.status.changed"
    if (eventType === 'order.status.changed' || eventType === 'order') {
      const orderData = event?.data;
      const orderId = orderData?.id;
      const orderState = orderData?.state || orderData?.status;
      const metadata = orderData?.metadata;

      this.logger.log(`Orden ${orderId} — Estado: ${orderState}`);

      if (orderState === 'paid' || orderState === 'completed') {
        const paymentId = metadata?.paymentId;
        const enrollmentId = metadata?.enrollmentId;

        if (paymentId && enrollmentId) {
          const result = await this.prisma.$transaction(async (tx) => {
            const payment = await tx.payment.findUnique({
              where: { id: paymentId },
            });

            if (!payment || payment.enrollmentId !== enrollmentId) {
              throw new BadRequestException(
                'El evento no corresponde a un pago registrado',
              );
            }

            if (payment.status === 'COMPLETED') {
              return { processed: false, user: null, enrollmentData: null };
            }

            await tx.payment.update({
              where: { id: paymentId },
              data: { status: 'COMPLETED', validatedAt: new Date() },
            });

            await tx.enrollment.update({
              where: { id: enrollmentId },
              data: { status: 'ACTIVE' },
            });

            const user = await tx.user.findUnique({
              where: { id: metadata?.userId },
            });
            const enrollmentData = await tx.enrollment.findUnique({
              where: { id: enrollmentId },
              include: { cohort: { include: { course: true } } },
            });

            return { processed: true, user, enrollmentData };
          });

          if (!result.processed) {
            return { received: true, duplicate: true };
          }

          if (result.user && result.enrollmentData) {
            await this.mailService.sendPaymentApproved(
              result.user.email,
              result.user.firstName,
              toMoney(orderData?.amount || 0).div(100),
            );
            await this.mailService.sendEnrollmentConfirmation(
              result.user.email,
              result.user.firstName,
              result.enrollmentData.cohort.course?.name || 'Curso',
              result.enrollmentData.cohort.name,
            );
          }

          this.logger.log(
            `✅ Pago de Culqi (PagoEfectivo) validado. Matrícula ${enrollmentId} activada.`,
          );
        }
      }
    }

    return { received: true };
  }

  // ─── 5. Subir voucher (Yape/Plin manual) ────────────────────────────────
  async uploadVoucher(paymentId: string, voucherUrl: string) {
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { voucherUrl },
    });
  }

  // ─── 6. Aprobar pago manualmente (Admin valida voucher) ─────────────────
  async approvePayment(paymentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { enrollment: true },
      });
      if (!payment) throw new NotFoundException('Pago no encontrado');

      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'COMPLETED',
          validatedAt: new Date(),
        },
      });

      await tx.enrollment.update({
        where: { id: payment.enrollmentId },
        data: { status: 'ACTIVE' },
      });

      // Enviar emails de confirmación
      const user = await tx.user.findUnique({
        where: { id: payment.enrollment?.userId },
      });
      const enrollmentData = await tx.enrollment.findUnique({
        where: { id: payment.enrollmentId },
        include: { cohort: { include: { course: true } } },
      });

      if (user && enrollmentData) {
        this.mailService
          .sendPaymentApproved(user.email, user.firstName, payment.amount)
          .catch((e) => console.error(e));
        this.mailService
          .sendEnrollmentConfirmation(
            user.email,
            user.firstName,
            enrollmentData.cohort.course?.name || 'Curso',
            enrollmentData.cohort.name,
          )
          .catch((e) => console.error(e));
      }

      return payment;
    });
  }

  // ─── 7. Mis pagos (Estudiante) ──────────────────────────────────────────
  async getMyPayments(userId: string) {
    return this.prisma.payment.findMany({
      where: { enrollment: { userId } },
      include: { enrollment: { include: { cohort: true } } },
    });
  }

  // ─── 8. Pagos pendientes (Admin) ────────────────────────────────────────
  async getAllPendingPayments() {
    return this.prisma.payment.findMany({
      where: { status: 'PENDING' },
      include: { enrollment: { include: { cohort: true, user: true } } },
    });
  }
}

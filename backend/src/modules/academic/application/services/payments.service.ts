import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
  ServiceUnavailableException,
  ForbiddenException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { COHORT_REPOSITORY } from '../../domain/repositories/cohort.repository.interface';
import type { ICohortRepository } from '../../domain/repositories/cohort.repository.interface';
import { MailService } from '../../../../shared/infrastructure/mail/mail.service';
import axios from 'axios';
import { moneyToMinorUnits, toMoney } from '../../../../shared/utils/money';
import { ConversionAnalyticsService } from './conversion-analytics.service';
import { EnrollmentStatus, PaymentMethod, Prisma } from '@prisma/client';
import {
  normalizePagination,
  paginatedResult,
} from '../../../../shared/pagination/pagination';
import { NotificationsService } from '../../../communication/notifications.service';
import { ProspectsService } from '../../../prospects/prospects.service';

// ─── Culqi API Base URL ─────────────────────────────────────────────────────
const CULQI_API = 'https://api.culqi.com/v2';
const RESERVATION_TTL_MS = 48 * 60 * 60 * 1000;
const CHARGE_ATTEMPT_STALE_MS = 15 * 60 * 1000;

const activeEnrollmentWhere = (now: Date): Prisma.EnrollmentWhereInput => ({
  deletedAt: null,
  OR: [
    { status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] } },
    {
      status: EnrollmentStatus.PENDING_PAYMENT,
      reservationExpiresAt: { gt: now },
    },
  ],
});

function operationNumber(id: string, prefix = 'ORD') {
  return `${prefix}-${id.slice(0, 8).toUpperCase()}`;
}

interface CulqiWebhookBody {
  id?: unknown;
  type?: unknown;
}

interface CulqiOrderData {
  id?: string;
  state?: string;
  status?: string;
  amount?: number;
  currency_code?: string;
  currency?: string;
  metadata?: {
    paymentId?: string;
    enrollmentId?: string;
    userId?: string;
  };
  duplicated?: boolean;
}

interface CulqiEvent {
  type?: string;
  data?: CulqiOrderData;
}

interface CulqiOrderResponse {
  id: string;
}

interface CulqiChargeResponse {
  id: string;
  amount?: number;
  currency_code?: string;
  currency?: string;
  outcome?: { type?: string };
  duplicated?: boolean;
  metadata?: { paymentId?: string; enrollmentId?: string };
}

interface CulqiChargeListResponse {
  data?: Array<CulqiChargeResponse>;
}

interface CulqiErrorResponse {
  message?: string;
  user_message?: string;
  merchant_message?: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly culqiSecretKey: string;
  private readonly paymentsMode: 'cash' | 'online';
  private readonly orderCreationLocks = new Map<string, Promise<unknown>>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(COHORT_REPOSITORY)
    private readonly cohortRepository: ICohortRepository,
    private readonly mailService: MailService,
    private readonly conversionAnalytics: ConversionAnalyticsService,
    @Optional() private readonly notificationsService?: NotificationsService,
    @Optional() private readonly prospectsService?: ProspectsService,
  ) {
    this.culqiSecretKey = process.env.CULQI_SECRET_KEY || '';
    this.paymentsMode =
      process.env.PAYMENTS_MODE?.toLowerCase() === 'online' ? 'online' : 'cash';
  }

  private async notifyStudent(userId: string, title: string, message: string) {
    try {
      await this.notificationsService?.createNotification({
        userId,
        title,
        message,
        type: 'payment',
        actionUrl: '/dashboard/my-payments',
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo crear la notificación de pago: ${String(error)}`,
      );
    }
  }

  private async notifyAdmissionTeam(title: string, message: string) {
    try {
      const notifications = this.notificationsService;
      if (!notifications || typeof this.prisma.user?.findMany !== 'function') {
        return;
      }
      const staff = await this.prisma.user.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          roles: {
            some: {
              role: { name: { in: ['ADMIN', 'RRHH'] } },
            },
          },
        },
        select: { id: true },
      });
      await Promise.all(
        staff.map((member) =>
          notifications.createNotification({
            userId: member.id,
            title,
            message,
            type: 'payment',
            actionUrl: '/dashboard/payments',
          }),
        ),
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo notificar al equipo de admisión: ${String(error)}`,
      );
    }
  }

  private ensureOnlinePaymentsEnabled() {
    if (this.paymentsMode !== 'online') {
      throw new ServiceUnavailableException(
        'Los pagos en línea están deshabilitados; la academia acepta efectivo',
      );
    }
  }

  private async trackPaymentEvent(
    paymentId: string,
    event: 'PAYMENT_COMPLETED' | 'VOUCHER_SUBMITTED' | 'CHECKOUT_FAILED',
  ) {
    try {
      await this.conversionAnalytics.markPayment(paymentId, event);
    } catch (error) {
      this.logger.warn(
        `No se pudo registrar la analítica del pago ${paymentId}: ${String(error)}`,
      );
    }
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

  /**
   * Reserva un cupo de forma atómica.
   *
   * El bloqueo de la fila de la cohorte se mantiene hasta el commit de la
   * transacción, por lo que dos checkouts concurrentes no pueden observar el
   * mismo cupo disponible y crear matrículas por encima del límite.
   */
  private async reserveCohortSeat(
    tx: Prisma.TransactionClient,
    cohortId: string,
  ): Promise<void> {
    if (typeof tx.$queryRaw !== 'function') return;
    const lockedCohorts = await tx.$queryRaw<
      Array<{ id: string; maxStudents: number }>
    >(Prisma.sql`
      SELECT id, max_students AS "maxStudents"
      FROM "cohorts"
      WHERE id = ${cohortId}::uuid
        AND deleted_at IS NULL
      FOR UPDATE
    `);

    const lockedCohort = lockedCohorts[0];
    if (!lockedCohort) {
      throw new NotFoundException('Cohorte no encontrada');
    }

    const enrollmentCount = await tx.enrollment.count({
      where: { cohortId, ...activeEnrollmentWhere(new Date()) },
    });

    if (enrollmentCount >= lockedCohort.maxStudents) {
      throw new BadRequestException('La cohorte ya no tiene cupos disponibles');
    }
  }

  private reservationExpiry(): Date {
    return new Date(Date.now() + RESERVATION_TTL_MS);
  }

  private assertReservationIsValid(
    expiresAt: Date | null | undefined,
    paidInstallments = 0,
  ) {
    if (paidInstallments > 0) return;
    // Registros previos a la migración se toleran solo durante el despliegue;
    // la migración rellena la fecha para todos los pagos pendientes existentes.
    if (expiresAt === undefined) return;
    if (!expiresAt || expiresAt <= new Date()) {
      throw new BadRequestException(
        'La reserva de 48 horas expiró; el estudiante debe iniciar un nuevo intento',
      );
    }
  }

  // ─── 1. Checkout: Crear enrollment + payment (para todos los métodos) ───
  async checkout(
    userId: string,
    cohortId: string,
    method: string,
    analyticsSessionId?: string,
    idempotencyKey?: string,
  ) {
    const normalizedIdempotencyKey = idempotencyKey?.trim() || undefined;
    if (normalizedIdempotencyKey) {
      const previousPayment = await this.prisma.payment.findUnique({
        where: { idempotencyKey: normalizedIdempotencyKey },
        include: { enrollment: true },
      });
      if (previousPayment) {
        if (previousPayment.enrollment.userId !== userId) {
          throw new ForbiddenException(
            'La clave de idempotencia ya fue utilizada',
          );
        }
        const reservationIsCurrent =
          previousPayment.enrollment.reservationExpiresAt === undefined ||
          (previousPayment.enrollment.reservationExpiresAt &&
            previousPayment.enrollment.reservationExpiresAt > new Date());
        if (previousPayment.status !== 'PENDING' || reservationIsCurrent) {
          return {
            message: 'Checkout idempotente recuperado',
            enrollment: previousPayment.enrollment,
            payment: previousPayment,
            operationNumber: operationNumber(previousPayment.id),
            resumed: true,
          };
        }
      }
    }
    const allowedMethods =
      this.paymentsMode === 'cash'
        ? ['EFECTIVO', 'YAPE', 'PLIN']
        : ['TARJETA', 'YAPE', 'PLIN', 'EFECTIVO'];
    if (!allowedMethods.includes(method)) {
      throw new BadRequestException(
        this.paymentsMode === 'cash'
          ? 'Actualmente el pago con tarjeta en línea está deshabilitado; elige Efectivo, Yape o Plin'
          : 'El método de pago online no está disponible',
      );
    }
    const paymentMethod = method as PaymentMethod;
    const cohort = await this.cohortRepository.findById(cohortId);
    if (!cohort) throw new NotFoundException('Cohorte no encontrada');

    // Validar capacidad
    if (!cohort.hasCapacity) {
      throw new BadRequestException('La cohorte ya no tiene cupos disponibles');
    }

    if (!cohort.isOperational || cohort.endDate < new Date()) {
      throw new BadRequestException('Esta cohorte no admite nuevas matrículas');
    }

    const discountIsActive =
      cohort.discountPercentage > 0 &&
      !!cohort.discountEndsAt &&
      cohort.discountEndsAt > new Date();
    const price = discountIsActive
      ? toMoney(cohort.price)
          .mul(1 - cohort.discountPercentage / 100)
          .toDecimalPlaces(2)
      : toMoney(cohort.price);

    const existing = await this.prisma.enrollment.findUnique({
      where: { userId_cohortId: { userId, cohortId } },
      include: { payment: true },
    });
    if (existing?.status === 'ACTIVE' || existing?.status === 'COMPLETED') {
      throw new BadRequestException('Ya estás matriculado en esta cohorte');
    }
    if (existing?.payment?.status === 'PENDING') {
      const reservationIsCurrent =
        existing.reservationExpiresAt === undefined ||
        (existing.reservationExpiresAt &&
          existing.reservationExpiresAt > new Date());
      if (reservationIsCurrent) {
        const payment = await this.prisma.payment.update({
          where: { id: existing.payment.id },
          data: {
            method: paymentMethod,
            amount: price,
            idempotencyKey: normalizedIdempotencyKey,
          },
        });
        await this.conversionAnalytics.attachPayment(
          analyticsSessionId,
          cohortId,
          payment.id,
        );
        this.prospectsService
          ?.recordCheckoutIntent({ userId, cohortId, method })
          .catch((e) => console.error(e));
        return {
          message: 'Checkout pendiente recuperado',
          enrollment: existing,
          payment,
          operationNumber: operationNumber(payment.id),
          resumed: true,
        };
      }

      const resumed = await this.prisma.$transaction(async (tx) => {
        await this.reserveCohortSeat(tx, cohortId);
        const enrollment = await tx.enrollment.update({
          where: { id: existing.id },
          data: {
            status: 'PENDING_PAYMENT',
            reservationExpiresAt: this.reservationExpiry(),
          },
        });
        const payment = await tx.payment.update({
          where: { id: existing.payment!.id },
          data: {
            method: paymentMethod,
            amount: price,
            status: 'PENDING',
            rejectedAt: null,
            rejectionReason: null,
            validatedAt: null,
            voucherUrl: null,
            idempotencyKey: normalizedIdempotencyKey,
            culqiOrderId: null,
            culqiChargeId: null,
            culqiEventId: null,
            chargeAttemptKey: null,
            chargeStartedAt: null,
          },
        });
        return { enrollment, payment };
      });
      await this.conversionAnalytics.attachPayment(
        analyticsSessionId,
        cohortId,
        resumed.payment.id,
      );
      this.prospectsService
        ?.recordCheckoutIntent({ userId, cohortId, method })
        .catch((e) => console.error(e));
      return {
        message: 'Reserva expirada renovada por 48 horas',
        ...resumed,
        operationNumber: operationNumber(resumed.payment.id),
        resumed: true,
      };
    }

    if (existing?.payment?.status === 'REJECTED') {
      const resumed = await this.prisma.$transaction(async (tx) => {
        await this.reserveCohortSeat(tx, cohortId);
        const enrollment = await tx.enrollment.update({
          where: { id: existing.id },
          data: {
            status: 'PENDING_PAYMENT',
            reservationExpiresAt: this.reservationExpiry(),
          },
        });
        const payment = await tx.payment.update({
          where: { id: existing.payment!.id },
          data: {
            method: paymentMethod,
            amount: price,
            status: 'PENDING',
            rejectedAt: null,
            rejectionReason: null,
            validatedAt: null,
            voucherUrl: null,
            idempotencyKey: normalizedIdempotencyKey,
            culqiOrderId: null,
            culqiChargeId: null,
            culqiEventId: null,
            chargeAttemptKey: null,
            chargeStartedAt: null,
          },
        });
        return { enrollment, payment };
      });
      await this.conversionAnalytics.attachPayment(
        analyticsSessionId,
        cohortId,
        resumed.payment.id,
      );
      this.prospectsService
        ?.recordCheckoutIntent({ userId, cohortId, method })
        .catch((e) => console.error(e));
      return {
        message: 'Pago rechazado reabierto para un nuevo intento',
        ...resumed,
        operationNumber: operationNumber(resumed.payment.id),
        resumed: true,
      };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Crear el Enrollment en PENDING_PAYMENT si hay precio, si no ACTIVE
      const status = price.greaterThan(0) ? 'PENDING_PAYMENT' : 'ACTIVE';

      // El cupo se valida bajo bloqueo de fila y queda reservado por la
      // matrícula creada dentro de esta misma transacción.
      await this.reserveCohortSeat(tx, cohortId);

      const enrollment = await tx.enrollment.create({
        data: {
          userId,
          cohortId,
          status,
          ...(price.greaterThan(0)
            ? { reservationExpiresAt: this.reservationExpiry() }
            : {}),
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
          this.prospectsService
            ?.recordEnrollmentCompleted({
              email: user.email,
              phone: user.phone,
              cohortId,
            })
            .catch((e) => console.error(e));
        }
        return {
          message: 'Matrícula exitosa gratuita',
          enrollment,
          operationNumber: operationNumber(enrollment.id, 'MAT'),
        };
      }

      // 3. Crear el registro de Pago en estado PENDING
      const cohortInstallments = Math.max(
        1,
        Number((cohort as { installments?: number }).installments || 1),
      );
      const payment = await tx.payment.create({
        data: {
          enrollmentId: enrollment.id,
          amount: price,
          method: paymentMethod,
          status: 'PENDING',
          validatedAt: null,
          idempotencyKey: normalizedIdempotencyKey,
          ...(cohortInstallments > 1
            ? {
                installmentNumber: 1,
                totalInstallments: cohortInstallments,
                paidInstallments: 0,
              }
            : {}),
        },
      });

      return {
        message: 'Enrollment y pago creados. Proceda con el pago.',
        enrollment,
        payment,
      };
    });
    await this.conversionAnalytics.attachPayment(
      analyticsSessionId,
      cohortId,
      result.payment?.id,
    );
    await this.notifyStudent(
      userId,
      'Matrícula registrada',
      `Tu solicitud para ${cohort.name} quedó registrada. Revisa el estado del pago en Mis pagos.`,
    );
    await this.notifyAdmissionTeam(
      'Nueva solicitud de matrícula',
      `Se registró una solicitud de matrícula (${paymentMethod}) para ${cohort.name}. Revisa Pagos pendientes para coordinar o validar el ingreso.`,
    );
    this.prospectsService
      ?.recordCheckoutIntent({ userId, cohortId, method })
      .catch((e) => console.error(e));
    return {
      ...result,
      operationNumber: result.payment
        ? operationNumber(result.payment.id)
        : operationNumber(result.enrollment.id, 'MAT'),
    };
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
    const running = this.orderCreationLocks.get(paymentId);
    if (running) return running;
    const task = this.createCulqiOrderInternal(
      paymentId,
      userId,
      userEmail,
      userFirstName,
      userLastName,
      userPhone,
    );
    this.orderCreationLocks.set(paymentId, task);
    try {
      return await task;
    } finally {
      this.orderCreationLocks.delete(paymentId);
    }
  }

  private async createCulqiOrderInternal(
    paymentId: string,
    userId: string,
    userEmail: string,
    userFirstName: string,
    userLastName: string,
    userPhone: string,
  ) {
    this.ensureOnlinePaymentsEnabled();
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        enrollment: { include: { cohort: { include: { course: true } } } },
      },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    if (payment.enrollment?.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a este pago');
    }
    if (payment.status !== 'PENDING') {
      throw new BadRequestException(
        'Solo se puede crear una orden para un pago pendiente',
      );
    }
    this.assertReservationIsValid(
      payment.enrollment?.reservationExpiresAt,
      payment.paidInstallments,
    );
    if (payment.culqiOrderId) {
      return {
        orderId: payment.culqiOrderId,
        amount: moneyToMinorUnits(payment.amount),
        currency: 'PEN',
        paymentId: payment.id,
        enrollmentId: payment.enrollmentId,
        resumed: true,
      };
    }

    const cohortName = payment.enrollment?.cohort?.name || 'Matrícula';
    const courseName = payment.enrollment?.cohort?.course?.name || 'Curso';

    // Monto en céntimos (Culqi usa la unidad mínima de la moneda)
    const amountInCents = moneyToMinorUnits(payment.amount);

    try {
      const { data } = await axios.post<CulqiOrderResponse>(
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
          expiration_date: Math.floor(
            (
              payment.enrollment.reservationExpiresAt ??
              this.reservationExpiry()
            ).getTime() / 1000,
          ),
          metadata: {
            paymentId: payment.id,
            enrollmentId: payment.enrollmentId,
            userId: userId,
          },
        },
        { headers: this.culqiHeaders(), timeout: 15_000 },
      );

      this.logger.log(`Culqi Order creada: ${data.id}`);

      const linkedPayment =
        typeof this.prisma.payment.update === 'function'
          ? await this.prisma.payment.update({
              where: { id: payment.id },
              data: { culqiOrderId: data.id },
            })
          : undefined;

      return {
        orderId: data.id,
        amount: amountInCents,
        currency: 'PEN',
        paymentId: payment.id,
        enrollmentId: payment.enrollmentId,
        payment: linkedPayment,
      };
    } catch (err: unknown) {
      const errorMessage = axios.isAxiosError<CulqiErrorResponse>(err)
        ? err.response?.data?.message || err.message
        : err instanceof Error
          ? err.message
          : String(err);
      const responseData = axios.isAxiosError<CulqiErrorResponse>(err)
        ? err.response?.data
        : undefined;
      this.logger.error(
        'Error creando orden Culqi',
        responseData || errorMessage,
      );
      throw new BadRequestException(
        (axios.isAxiosError<CulqiErrorResponse>(err) &&
          err.response?.data?.user_message) ||
          (axios.isAxiosError<CulqiErrorResponse>(err) &&
            err.response?.data?.merchant_message) ||
          'Error al crear orden en Culqi',
      );
    }
  }

  // ─── 3. Procesar Cargo con Token (tarjeta o Yape vía Checkout) ──────────
  async processChargeWithToken(
    paymentId: string,
    tokenId: string,
    email: string,
    userId: string,
  ) {
    this.ensureOnlinePaymentsEnabled();
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        enrollment: { include: { cohort: { include: { course: true } } } },
      },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    if (payment.enrollment?.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a este pago');
    }
    if (payment.status === 'COMPLETED') {
      if (!this.culqiSecretKey) this.culqiHeaders();
      return {
        message: 'Este pago ya fue procesado',
        chargeId: payment.culqiChargeId,
        status: 'COMPLETED',
        duplicate: true,
      };
    }
    this.assertReservationIsValid(
      payment.enrollment?.reservationExpiresAt,
      payment.paidInstallments,
    );

    const attemptKey = `charge:${payment.id}`;
    if (payment.chargeAttemptKey && payment.chargeStartedAt) {
      if (
        Date.now() - payment.chargeStartedAt.getTime() <
        CHARGE_ATTEMPT_STALE_MS
      ) {
        throw new ConflictException(
          'El cobro ya está siendo procesado; espera la conciliación de Culqi',
        );
      }
      const reconciled = await this.reconcileCulqiPayment(payment.id);
      if (reconciled) return reconciled;
      throw new ConflictException(
        'El resultado del cobro sigue pendiente de conciliación; no se realizará otro cargo',
      );
    }

    const claimed = await this.prisma.$transaction(async (tx) => {
      if (typeof tx.payment.updateMany !== 'function') return true;
      const result = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: 'PENDING',
          chargeAttemptKey: null,
        },
        data: { chargeAttemptKey: attemptKey, chargeStartedAt: new Date() },
      });
      return result.count === 1;
    });
    if (!claimed) {
      throw new ConflictException(
        'El cobro ya está siendo procesado; espera la conciliación de Culqi',
      );
    }

    const amountInCents = moneyToMinorUnits(payment.amount);
    const cohortName = payment.enrollment?.cohort?.name || 'Matrícula';
    const courseName = payment.enrollment?.cohort?.course?.name || 'Curso';

    try {
      const { data } = await axios.post<CulqiChargeResponse>(
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
            attemptKey,
          },
        },
        { headers: this.culqiHeaders(), timeout: 15_000 },
      );

      this.logger.log(
        `✅ Cargo Culqi exitoso: ${data.id} — Estado: ${data.outcome?.type}`,
      );

      // Si el cargo fue exitoso, activar matrícula
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            status: 'COMPLETED',
            validatedAt: new Date(),
            culqiChargeId: data.id,
            chargeAttemptKey: null,
            chargeStartedAt: null,
          },
        });

        await tx.enrollment.update({
          where: { id: payment.enrollmentId },
          data: { status: 'ACTIVE', reservationExpiresAt: null },
        });
      });
      await this.trackPaymentEvent(paymentId, 'PAYMENT_COMPLETED');

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
        this.prospectsService
          ?.recordEnrollmentCompleted({
            email: user.email,
            phone: user.phone,
            cohortId: payment.enrollment?.cohortId,
          })
          .catch((e) => console.error(e));
      }

      return {
        message: '¡Pago procesado exitosamente!',
        chargeId: data.id,
        status: 'COMPLETED',
      };
    } catch (err: unknown) {
      if (
        axios.isAxiosError(err) &&
        err.response &&
        [400, 401, 402, 403, 404, 422].includes(err.response.status)
      ) {
        await this.prisma.payment
          .update({
            where: { id: paymentId },
            data: { chargeAttemptKey: null, chargeStartedAt: null },
          })
          .catch(() => undefined);
      }
      const responseData = axios.isAxiosError<CulqiErrorResponse>(err)
        ? err.response?.data
        : undefined;
      this.logger.error(
        'Error procesando cargo Culqi',
        responseData || (err instanceof Error ? err.message : String(err)),
      );
      throw new BadRequestException(
        (axios.isAxiosError<CulqiErrorResponse>(err) &&
          err.response?.data?.user_message) ||
          (axios.isAxiosError<CulqiErrorResponse>(err) &&
            err.response?.data?.merchant_message) ||
          'Error al procesar el pago con Culqi',
      );
    }
  }

  // ─── 4. Webhook de Culqi (para PagoEfectivo y órdenes asíncronas) ──────
  /** Busca un cargo creado antes de un timeout de red y lo vincula al pago. */
  private async reconcileCulqiPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { enrollment: true },
    });
    if (!payment || payment.status === 'COMPLETED') {
      return payment?.status === 'COMPLETED'
        ? {
            message: 'Este pago ya fue procesado',
            chargeId: payment.culqiChargeId,
            status: 'COMPLETED',
            duplicate: true,
          }
        : null;
    }
    if (payment.status !== 'PENDING') return null;

    const { data } = await axios.get<CulqiChargeListResponse>(
      `${CULQI_API}/charges?limit=100&creation_date_from=${Math.floor(payment.createdAt.getTime() / 1000)}`,
      { headers: this.culqiHeaders(), timeout: 15_000 },
    );
    const charge = data.data?.find(
      (item) => item.metadata?.paymentId === paymentId && !item.duplicated,
    );
    if (!charge) return null;
    if (
      charge.amount !== moneyToMinorUnits(payment.amount) ||
      (charge.currency_code ?? charge.currency) !== 'PEN'
    ) {
      throw new BadRequestException(
        'El importe o la moneda del cargo no coincide con el pago',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { enrollment: true },
      });
      if (!current || current.status !== 'PENDING') return 'changed' as const;
      const late =
        !!current.enrollment.reservationExpiresAt &&
        current.enrollment.reservationExpiresAt <= new Date();
      const updated = await tx.payment.updateMany({
        where: {
          id: paymentId,
          status: 'PENDING',
          chargeAttemptKey: current.chargeAttemptKey,
        },
        data: late
          ? {
              status: 'REJECTED',
              rejectedAt: new Date(),
              rejectionReason:
                'Cargo conciliado después de vencer la reserva; requiere devolución o regularización manual',
              culqiChargeId: charge.id,
            }
          : {
              status: 'COMPLETED',
              validatedAt: new Date(),
              culqiChargeId: charge.id,
              chargeAttemptKey: null,
              chargeStartedAt: null,
            },
      });
      if (!updated.count) return 'changed' as const;
      if (late) return 'late' as const;
      await tx.enrollment.update({
        where: { id: payment.enrollmentId },
        data: { status: 'ACTIVE', reservationExpiresAt: null },
      });
      return 'completed' as const;
    });
    if (result === 'late')
      throw new ConflictException(
        'El cargo llegó después de vencer la reserva y requiere revisión manual',
      );
    if (result === 'changed') return null;
    return {
      message: 'Pago conciliado con Culqi',
      chargeId: charge.id,
      status: 'COMPLETED',
      reconciled: true,
    };
  }

  /** Reconcilia cargos cuyo timeout de red dejó la operación en estado incierto. */
  async reconcilePendingCulqiPayments(): Promise<{
    inspected: number;
    reconciled: number;
    failed: number;
  }> {
    this.ensureOnlinePaymentsEnabled();
    const staleBefore = new Date(Date.now() - CHARGE_ATTEMPT_STALE_MS);
    const pending = await this.prisma.payment.findMany({
      where: {
        status: 'PENDING',
        chargeAttemptKey: { not: null },
        chargeStartedAt: { lt: staleBefore },
      },
      select: { id: true },
      take: 50,
      orderBy: { chargeStartedAt: 'asc' },
    });

    let reconciled = 0;
    let failed = 0;
    for (const payment of pending) {
      try {
        if (await this.reconcileCulqiPayment(payment.id)) reconciled += 1;
      } catch (error: unknown) {
        failed += 1;
        this.logger.warn(
          `No se pudo conciliar el pago ${payment.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return { inspected: pending.length, reconciled, failed };
  }

  private async verifyCulqiEvent(eventId: string) {
    if (!/^evt_(test|live)_[A-Za-z0-9]+$/.test(eventId)) {
      throw new BadRequestException('Identificador de evento Culqi inválido');
    }

    try {
      const { data } = await axios.get<CulqiEvent>(
        `${CULQI_API}/events/${encodeURIComponent(eventId)}`,
        { headers: this.culqiHeaders(), timeout: 15_000 },
      );
      return data;
    } catch (error: unknown) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.warn(`No se pudo verificar el evento Culqi ${eventId}`);
      throw new BadRequestException('El evento Culqi no pudo ser verificado');
    }
  }

  async handleCulqiWebhook(body: CulqiWebhookBody) {
    this.ensureOnlinePaymentsEnabled();
    const eventId = typeof body.id === 'string' ? body.id : '';
    const event = await this.verifyCulqiEvent(eventId);
    const eventType = event?.type;
    this.logger.log(`Webhook Culqi recibido: ${eventType}`);

    const duplicateEvent =
      this.prisma.payment &&
      typeof this.prisma.payment.findUnique === 'function'
        ? await this.prisma.payment.findUnique({
            where: { culqiEventId: eventId },
            select: { id: true },
          })
        : null;
    if (duplicateEvent) return { received: true, duplicate: true };

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

        if (paymentId && enrollmentId && orderId) {
          const result = await this.prisma.$transaction(async (tx) => {
            const payment = await tx.payment.findUnique({
              where: { id: paymentId },
              include: { enrollment: true },
            });

            if (!payment || payment.enrollmentId !== enrollmentId) {
              throw new BadRequestException(
                'El evento no corresponde a un pago registrado',
              );
            }

            if (payment.status === 'COMPLETED') {
              return {
                processed: false,
                late: false,
                user: null,
                enrollmentData: null,
              };
            }

            if (payment.status !== 'PENDING') {
              throw new ConflictException(
                'El pago ya fue cerrado; el cobro requiere revisión manual',
              );
            }

            if (
              payment.enrollment?.reservationExpiresAt &&
              payment.enrollment.reservationExpiresAt <= new Date()
            ) {
              await tx.payment.update({
                where: { id: paymentId, status: 'PENDING' },
                data: {
                  status: 'REJECTED',
                  rejectedAt: new Date(),
                  rejectionReason:
                    'La orden de Culqi fue pagada después de expirar la reserva de 48 horas',
                  culqiOrderId: orderId,
                  culqiEventId: eventId,
                },
              });
              return {
                processed: false,
                late: true,
                user: null,
                enrollmentData: null,
              };
            }

            if (
              !Number.isSafeInteger(orderData?.amount) ||
              orderData?.amount !== moneyToMinorUnits(payment.amount) ||
              (orderData?.currency_code ?? orderData?.currency) !== 'PEN'
            ) {
              throw new BadRequestException(
                'El importe de la orden no coincide con el pago registrado',
              );
            }

            await tx.payment.update({
              where: { id: paymentId, status: 'PENDING' },
              data: {
                status: 'COMPLETED',
                validatedAt: new Date(),
                culqiOrderId: orderId,
                culqiEventId: eventId,
                chargeAttemptKey: null,
                chargeStartedAt: null,
              },
            });

            await tx.enrollment.update({
              where: { id: enrollmentId },
              data: { status: 'ACTIVE', reservationExpiresAt: null },
            });

            const user = await tx.user.findUnique({
              where: { id: payment.enrollment?.userId || metadata?.userId },
            });
            const enrollmentData = await tx.enrollment.findUnique({
              where: { id: enrollmentId },
              include: { cohort: { include: { course: true } } },
            });

            return { processed: true, user, enrollmentData };
          });

          if (!result.processed) {
            return result.late
              ? { received: true, late: true }
              : { received: true, duplicate: true };
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
            this.prospectsService
              ?.recordEnrollmentCompleted({
                email: result.user.email,
                phone: result.user.phone,
                cohortId: result.enrollmentData.cohortId,
              })
              .catch((e) => console.error(e));
          }

          this.logger.log(
            `✅ Pago de Culqi (PagoEfectivo) validado. Matrícula ${enrollmentId} activada.`,
          );
          await this.trackPaymentEvent(paymentId, 'PAYMENT_COMPLETED');
        }
      }
    }

    if (eventType === 'charge.creation.succeeded') {
      const chargeData = event.data;
      const paymentId = chargeData?.metadata?.paymentId;
      if (paymentId && chargeData.id) {
        const payment = await this.prisma.payment.findUnique({
          where: { id: paymentId },
          include: { enrollment: true },
        });
        if (!payment)
          throw new BadRequestException('Cargo sin pago registrado');
        if (payment.status === 'COMPLETED') {
          return { received: true, duplicate: true };
        }
        if (payment.status !== 'PENDING') {
          throw new ConflictException(
            'El pago ya fue cerrado; el cobro requiere revisión manual',
          );
        }
        if (
          chargeData.amount !== moneyToMinorUnits(payment.amount) ||
          (chargeData.currency_code ?? chargeData.currency) !== 'PEN'
        ) {
          throw new BadRequestException(
            'El importe o la moneda del cargo no coincide con el pago',
          );
        }
        if (
          payment.enrollment.reservationExpiresAt &&
          payment.enrollment.reservationExpiresAt <= new Date()
        ) {
          await this.prisma.payment.update({
            where: { id: paymentId, status: 'PENDING' },
            data: {
              status: 'REJECTED',
              rejectedAt: new Date(),
              rejectionReason:
                'Cargo recibido después de expirar la reserva de 48 horas',
              culqiChargeId: chargeData.id,
              culqiEventId: eventId,
            },
          });
          return { received: true, late: true };
        }
        await this.prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: paymentId, status: 'PENDING' },
            data: {
              status: 'COMPLETED',
              validatedAt: new Date(),
              culqiChargeId: chargeData.id,
              culqiEventId: eventId,
              chargeAttemptKey: null,
              chargeStartedAt: null,
            },
          });
          await tx.enrollment.update({
            where: { id: payment.enrollmentId },
            data: { status: 'ACTIVE', reservationExpiresAt: null },
          });
        });
        await this.trackPaymentEvent(paymentId, 'PAYMENT_COMPLETED');
      }
    }

    return { received: true };
  }

  // ─── 5. Subir voucher (Yape/Plin manual) ────────────────────────────────
  async assertVoucherUploadAllowed(paymentId: string, userId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, enrollment: { userId } },
      include: { enrollment: true },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    if (payment.status !== 'PENDING') {
      throw new BadRequestException(
        'Solo puedes adjuntar un comprobante a un pago pendiente',
      );
    }
    this.assertReservationIsValid(
      payment.enrollment?.reservationExpiresAt,
      payment.paidInstallments,
    );
    if (payment.chargeAttemptKey) {
      throw new ConflictException(
        'El cobro debe conciliarse antes de modificar el pago',
      );
    }
    return payment;
  }

  async uploadVoucher(paymentId: string, voucherUrl: string, userId: string) {
    const payment = await this.assertVoucherUploadAllowed(paymentId, userId);
    const updated = await this.prisma.payment.update({
      where: {
        id: paymentId,
        status: 'PENDING',
        installmentNumber: payment.installmentNumber,
        voucherUrl: payment.voucherUrl,
        chargeAttemptKey: null,
      },
      data: { voucherUrl },
    });
    await this.trackPaymentEvent(paymentId, 'VOUCHER_SUBMITTED');
    await this.notifyAdmissionTeam(
      'Comprobante de pago recibido',
      `Un estudiante adjuntó el comprobante de la operación ${operationNumber(paymentId)}. Valídalo en Pagos pendientes.`,
    );
    return updated;
  }

  // ─── 6. Aprobar pago manualmente (Admin valida voucher) ─────────────────
  async approvePayment(paymentId: string) {
    const { updatedPayment, user, enrollmentData, amount } =
      await this.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({
          where: { id: paymentId },
          include: { enrollment: true },
        });
        if (!payment) throw new NotFoundException('Pago no encontrado');
        if (payment.status !== 'PENDING') {
          throw new BadRequestException(
            'Solo se pueden aprobar pagos pendientes',
          );
        }
        if (payment.chargeAttemptKey)
          throw new ConflictException(
            'El cobro debe conciliarse antes de modificar el pago',
          );
        this.assertReservationIsValid(
          payment.enrollment.reservationExpiresAt,
          payment.paidInstallments,
        );

        const validatedAt = new Date();
        const hasInstallmentTracking =
          'installmentNumber' in payment || 'totalInstallments' in payment;
        const currentInstallment = Math.max(
          1,
          Number(
            (payment as { installmentNumber?: number }).installmentNumber ?? 1,
          ),
        );
        const totalInstallments = Math.max(
          1,
          Number(
            (payment as { totalInstallments?: number }).totalInstallments ?? 1,
          ),
        );
        const nextPaidInstallments = Math.max(
          Number(
            (payment as { paidInstallments?: number }).paidInstallments ?? 0,
          ),
          currentInstallment,
        );
        const rawHistory = (payment as { installmentHistory?: unknown })
          .installmentHistory;
        const existingHistory = Array.isArray(rawHistory)
          ? (rawHistory as Record<string, unknown>[])
          : [];
        const updatedHistory = [
          ...existingHistory.filter(
            (item) => Number(item?.installmentNumber) !== currentInstallment,
          ),
          {
            installmentNumber: currentInstallment,
            amount: String(payment.amount),
            method: payment.method,
            voucherUrl:
              (payment as { voucherUrl?: string | null }).voucherUrl ?? null,
            validatedAt: validatedAt.toISOString(),
            status: 'COMPLETED',
            operationNumber:
              totalInstallments > 1
                ? `${operationNumber(payment.id)}-M${currentInstallment}`
                : operationNumber(payment.id),
          },
        ];
        const nextDueDate =
          nextPaidInstallments < totalInstallments
            ? new Date(validatedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
            : null;

        const updatedPayment = await tx.payment.update({
          where: { id: paymentId, status: 'PENDING', chargeAttemptKey: null },
          data: {
            status: 'COMPLETED',
            validatedAt,
            ...(hasInstallmentTracking
              ? {
                  paidInstallments: nextPaidInstallments,
                  totalInstallments,
                  installmentHistory:
                    updatedHistory as unknown as Prisma.InputJsonValue,
                  nextDueDate,
                }
              : {}),
          },
        });

        await tx.enrollment.update({
          where: { id: payment.enrollmentId },
          data: {
            status: 'ACTIVE',
            ...(Object.prototype.hasOwnProperty.call(
              payment.enrollment,
              'reservationExpiresAt',
            )
              ? { reservationExpiresAt: null }
              : {}),
          },
        });

        const user = await tx.user.findUnique({
          where: { id: payment.enrollment?.userId },
        });
        const enrollmentData = await tx.enrollment.findUnique({
          where: { id: payment.enrollmentId },
          include: { cohort: { include: { course: true } } },
        });

        return { updatedPayment, user, enrollmentData, amount: payment.amount };
      });

    // Confirmaciones y analítica ocurren solo después del commit.
    if (user && enrollmentData) {
      this.mailService
        .sendPaymentApproved(user.email, user.firstName, amount)
        .catch((e) => console.error(e));
      this.mailService
        .sendEnrollmentConfirmation(
          user.email,
          user.firstName,
          enrollmentData.cohort.course?.name || 'Curso',
          enrollmentData.cohort.name,
        )
        .catch((e) => console.error(e));
      await this.notifyStudent(
        user.id,
        'Pago aprobado',
        `Tu pago para ${enrollmentData.cohort.name} fue aprobado y tu matrícula está activa.`,
      );
      this.prospectsService
        ?.recordEnrollmentCompleted({
          email: user.email,
          phone: user.phone,
          cohortId: enrollmentData.cohortId,
        })
        .catch((e) => console.error(e));
    }
    await this.trackPaymentEvent(paymentId, 'PAYMENT_COMPLETED');
    return updatedPayment;
  }

  async rejectPayment(paymentId: string, reason: string) {
    const cleanReason = reason?.trim();
    if (!cleanReason || cleanReason.length < 5)
      throw new BadRequestException('Indica un motivo de rechazo válido');
    const { updated, user } = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { enrollment: true },
      });
      if (!payment) throw new NotFoundException('Pago no encontrado');
      if (payment.status !== 'PENDING')
        throw new BadRequestException(
          'Solo se pueden rechazar pagos pendientes',
        );
      if (payment.chargeAttemptKey)
        throw new ConflictException(
          'El cobro debe conciliarse antes de modificar el pago',
        );
      const updated = await tx.payment.update({
        where: { id: paymentId, status: 'PENDING', chargeAttemptKey: null },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
          rejectionReason: cleanReason.slice(0, 500),
          validatedAt: null,
        },
      });
      const paidInstallmentsCount = Number(
        (payment as { paidInstallments?: number }).paidInstallments ?? 0,
      );
      await tx.enrollment.update({
        where: { id: payment.enrollmentId },
        data: {
          status: paidInstallmentsCount > 0 ? 'ACTIVE' : 'SUSPENDED',
        },
      });
      const user = await tx.user.findUnique({
        where: { id: payment.enrollment.userId },
        select: { id: true },
      });
      return { updated, user };
    });
    if (user) {
      await this.notifyStudent(
        user.id,
        'Pago rechazado',
        `Tu pago fue rechazado. Motivo: ${cleanReason.slice(0, 500)}`,
      );
    }
    return updated;
  }

  // ─── 6b. Habilitar siguiente cuota / mensualidad (Estudiante) ───────────
  async startNextInstallment(
    paymentId: string,
    userId: string,
    requestedMethod?: 'TARJETA' | 'YAPE' | 'PLIN' | 'EFECTIVO',
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        enrollment: {
          include: {
            cohort: {
              include: { course: true },
            },
          },
        },
      },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    if (payment.enrollment.userId !== userId) {
      throw new ForbiddenException(
        'No tienes permiso para gestionar este pago',
      );
    }

    const nextMethod = requestedMethod || payment.method;
    const allowedMethods: PaymentMethod[] = [
      'YAPE',
      'PLIN',
      'EFECTIVO',
      'TARJETA',
    ];
    if (!allowedMethods.includes(nextMethod)) {
      throw new BadRequestException('Método de pago inválido');
    }

    const effectiveTotal = Math.max(1, Number(payment.totalInstallments ?? 1));
    if (payment.chargeAttemptKey) {
      throw new ConflictException(
        'El cobro debe conciliarse antes de modificar el pago',
      );
    }
    if (
      nextMethod === 'TARJETA' &&
      process.env.PAYMENTS_MODE?.toLowerCase() !== 'online'
    ) {
      throw new BadRequestException(
        'El pago con tarjeta en línea está deshabilitado',
      );
    }
    const unchangedPayment = {
      id: paymentId,
      status: payment.status,
      installmentNumber: payment.installmentNumber,
      paidInstallments: payment.paidInstallments,
      chargeAttemptKey: null,
    };

    // Si el pago ya está PENDING (ej. el alumno solo cambió el método Yape/Plin/Efectivo para su cuota actual)
    if (payment.status === 'PENDING') {
      this.assertReservationIsValid(
        payment.enrollment.reservationExpiresAt,
        payment.paidInstallments,
      );
      const updatedPending = await this.prisma.payment.update({
        where: unchangedPayment,
        data: {
          method: nextMethod,
          totalInstallments: effectiveTotal,
        },
        include: {
          enrollment: { include: { cohort: { include: { course: true } } } },
        },
      });
      return {
        ...updatedPending,
        operationNumber: operationNumber(updatedPending.id),
      };
    }

    const paidCount =
      payment.status === 'COMPLETED'
        ? Math.max(
            1,
            Number(payment.paidInstallments ?? 1),
            Number(payment.installmentNumber ?? 1),
          )
        : Number(payment.paidInstallments ?? 0);

    // Si estaba REJECTED en una cuota >= 2, reabrir la misma cuota; si estaba COMPLETED, avanzar a paidCount + 1
    const nextInstallmentNumber =
      payment.status === 'REJECTED'
        ? Math.max(1, Number(payment.installmentNumber ?? paidCount + 1))
        : paidCount + 1;

    if (paidCount >= effectiveTotal || nextInstallmentNumber > effectiveTotal) {
      throw new BadRequestException(
        'Todas las cuotas de esta matrícula ya están pagadas',
      );
    }
    const finalTotalInstallments = effectiveTotal;

    const rawHistory = payment.installmentHistory;
    const existingHistory = Array.isArray(rawHistory)
      ? (rawHistory as Record<string, unknown>[])
      : [];

    const historyWithPrevious =
      payment.status === 'COMPLETED' &&
      !existingHistory.some(
        (item) => Number(item?.installmentNumber) === paidCount,
      )
        ? [
            ...existingHistory,
            {
              installmentNumber: paidCount,
              amount: String(payment.amount),
              method: payment.method,
              voucherUrl: payment.voucherUrl ?? null,
              validatedAt: (
                payment.validatedAt || payment.createdAt
              ).toISOString(),
              status: 'COMPLETED',
              operationNumber: `${operationNumber(payment.id)}-M${paidCount}`,
            },
          ]
        : existingHistory;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (paidCount === 0) {
        await this.reserveCohortSeat(tx, payment.enrollment.cohortId);
      }
      await tx.enrollment.update({
        where: { id: payment.enrollmentId },
        data: {
          status: paidCount > 0 ? 'ACTIVE' : 'PENDING_PAYMENT',
          reservationExpiresAt: paidCount > 0 ? null : this.reservationExpiry(),
        },
      });

      return tx.payment.update({
        where: unchangedPayment,
        data: {
          status: 'PENDING',
          method: nextMethod,
          installmentNumber: nextInstallmentNumber,
          totalInstallments: finalTotalInstallments,
          paidInstallments: paidCount,
          installmentHistory:
            historyWithPrevious as unknown as Prisma.InputJsonValue,
          voucherUrl: null,
          validatedAt: null,
          rejectedAt: null,
          rejectionReason: null,
          chargeAttemptKey: null,
          chargeStartedAt: null,
        },
        include: {
          enrollment: { include: { cohort: { include: { course: true } } } },
        },
      });
    });

    await this.notifyAdmissionTeam(
      `Nueva mensualidad (${nextInstallmentNumber}/${finalTotalInstallments}) iniciada`,
      `Un estudiante habilitó el pago de la Mensualidad ${nextInstallmentNumber} de ${finalTotalInstallments} (${nextMethod}) para ${payment.enrollment.cohort?.name || 'el curso'}.`,
    );

    return {
      ...updated,
      operationNumber: operationNumber(updated.id),
    };
  }

  // ─── 7. Mis pagos (Estudiante) ──────────────────────────────────────────
  async getMyPayments(userId: string, page = 1, limit = 20) {
    const pagination = normalizePagination(page, limit);
    const where = { enrollment: { userId } };
    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          enrollment: { include: { cohort: { include: { course: true } } } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return paginatedResult(
      payments.map((payment) => ({
        ...payment,
        operationNumber: operationNumber(payment.id),
      })),
      pagination.page,
      pagination.limit,
      total,
    );
  }

  // ─── 8. Pagos pendientes (Admin) ────────────────────────────────────────
  async getAllPendingPayments(
    page = 1,
    limit = 20,
    history = false,
    filters?: {
      search?: string;
      method?: 'TARJETA' | 'YAPE' | 'PLIN' | 'EFECTIVO';
    },
  ) {
    const pagination = normalizePagination(page, limit);
    const where: Prisma.PaymentWhereInput = history
      ? { status: { in: ['COMPLETED', 'REJECTED'] } }
      : { status: 'PENDING' };
    if (filters?.method) where.method = filters.method;
    const search = filters?.search?.trim();
    if (search)
      where.OR = [
        ...(['TARJETA', 'YAPE', 'PLIN', 'EFECTIVO'] as const)
          .filter((method) => method.includes(search.toUpperCase()))
          .map((method) => ({ method })),
        ...(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          search,
        )
          ? [{ id: search }]
          : []),
        {
          enrollment: {
            user: {
              OR: ['firstName', 'lastName', 'email', 'dni', 'phone'].map(
                (field) => ({
                  [field]: { contains: search, mode: 'insensitive' as const },
                }),
              ),
            },
          },
        },
        {
          enrollment: {
            cohort: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { course: { name: { contains: search, mode: 'insensitive' } } },
              ],
            },
          },
        },
      ];
    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          enrollment: {
            include: {
              cohort: {
                include: {
                  course: true,
                },
              },
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  phone: true,
                  dni: true,
                },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return paginatedResult(
      payments.map((payment) => ({
        ...payment,
        operationNumber: operationNumber(payment.id),
      })),
      pagination.page,
      pagination.limit,
      total,
    );
  }
}

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'node:http';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';

describe('Compra y matrícula (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let studentCookies: string[];
  let adminCookies: string[];
  let courseId = '';
  let freeCohortId = '';
  let paidCohortId = '';
  let paymentId = '';
  const suffix = Date.now();
  const email = `e2e_purchase_${suffix}@academia.edu`;
  const adminEmail = `e2e_admin_${suffix}@academia.edu`;
  const adminPassword = 'Admin@1234';

  const httpServer = (): Server => app.getHttpServer() as Server;

  interface CheckoutBody {
    enrollment: { status: string };
    payment?: { id: string; amount: string; status: string };
    resumed?: boolean;
  }

  interface EnrollmentBody {
    cohortId: string;
    status: string;
    cohort: { name: string };
  }

  const checkoutBody = (body: unknown): CheckoutBody => body as CheckoutBody;

  const cookieValues = (value: unknown): string[] => {
    const cookies = Array.isArray(value)
      ? value.filter((cookie): cookie is string => typeof cookie === 'string')
      : typeof value === 'string'
        ? [value]
        : [];
    return cookies.map((cookie) => cookie.split(';')[0]);
  };

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication();
    prisma = fixture.get(PrismaService);
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    const course = await prisma.course.create({
      data: {
        code: `E2E-${suffix}`.slice(0, 20),
        name: 'Curso E2E de compra',
        isPublished: true,
      },
    });
    courseId = course.id;
    const dates = {
      startDate: new Date(Date.now() + 86_400_000),
      endDate: new Date(Date.now() + 30 * 86_400_000),
    };
    freeCohortId = (
      await prisma.cohort.create({
        data: { courseId, name: 'Cohorte gratuita E2E', price: 0, ...dates },
      })
    ).id;
    paidCohortId = (
      await prisma.cohort.create({
        data: { courseId, name: 'Cohorte pagada E2E', price: 199.9, ...dates },
      })
    ).id;
    await request(httpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'Password@123',
        firstName: 'Compra',
        lastName: 'E2E',
      })
      .expect(201);
    const adminRole = await prisma.role.findUnique({
      where: { name: 'ADMIN' },
      select: { id: true },
    });
    if (!adminRole) throw new Error('El rol ADMIN no está disponible para E2E');
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 10),
        firstName: 'Administrador',
        lastName: 'E2E',
        roles: { create: { roleId: adminRole.id } },
      },
    });
    const login = await request(httpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'Password@123' })
      .expect(200);
    const loginHeaders = login.headers as unknown as Record<string, unknown>;
    studentCookies = cookieValues(loginHeaders['set-cookie']);
    const adminLogin = await request(httpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(200);
    const adminHeaders = adminLogin.headers as unknown as Record<
      string,
      unknown
    >;
    adminCookies = cookieValues(adminHeaders['set-cookie']);
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { entityId: paymentId || undefined },
    });
    await prisma.enrollment.deleteMany({
      where: { cohortId: { in: [freeCohortId, paidCohortId] } },
    });
    await prisma.cohort.deleteMany({
      where: { id: { in: [freeCohortId, paidCohortId] } },
    });
    await prisma.course.deleteMany({ where: { id: courseId } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.user.deleteMany({ where: { email: adminEmail } });
    await app.close();
    await prisma.$disconnect();
  });

  it('activa inmediatamente una matrícula gratuita', async () => {
    const response = await request(httpServer())
      .post('/api/v1/payments/checkout')
      .set('Cookie', studentCookies)
      .send({ cohortId: freeCohortId, method: 'EFECTIVO' })
      .expect(201);
    const body = checkoutBody(response.body);
    expect(body.enrollment.status).toBe('ACTIVE');
    expect(body.payment).toBeUndefined();
  });

  it('rechaza métodos online mientras la academia opera con efectivo', async () => {
    await request(httpServer())
      .post('/api/v1/payments/checkout')
      .set('Cookie', studentCookies)
      .send({ cohortId: paidCohortId, method: 'TARJETA' })
      .expect(400);
  });

  it('crea un pago pendiente con importe decimal', async () => {
    const response = await request(httpServer())
      .post('/api/v1/payments/checkout')
      .set('Cookie', studentCookies)
      .send({ cohortId: paidCohortId, method: 'EFECTIVO' })
      .expect(201);
    const body = checkoutBody(response.body);
    expect(body.enrollment.status).toBe('PENDING_PAYMENT');
    expect(body.payment?.amount).toBe('199.90');
    paymentId = body.payment?.id ?? '';
  });

  it('reanuda el mismo checkout sin duplicados', async () => {
    const response = await request(httpServer())
      .post('/api/v1/payments/checkout')
      .set('Cookie', studentCookies)
      .send({ cohortId: paidCohortId, method: 'EFECTIVO' })
      .expect(201);
    const body = checkoutBody(response.body);
    expect(body.resumed).toBe(true);
    expect(body.payment?.id).toBe(paymentId);
    expect(
      await prisma.enrollment.count({ where: { cohortId: paidCohortId } }),
    ).toBe(1);
  });

  it('muestra la matrícula pendiente en el portal del estudiante', async () => {
    const response = await request(httpServer())
      .get('/api/v1/academic/enrollments/me')
      .set('Cookie', studentCookies)
      .expect(200);
    const enrollments = response.body as unknown as EnrollmentBody[];
    const pending = enrollments.find((item) => item.cohortId === paidCohortId);
    if (!pending) throw new Error('No se encontró la matrícula E2E pendiente');
    expect(pending.status).toBe('PENDING_PAYMENT');
    expect(pending.cohort.name).toBe('Cohorte pagada E2E');
  });

  it('impide al estudiante aprobar pagos y permite rechazar/reintentar', async () => {
    await request(httpServer())
      .patch(`/api/v1/payments/${paymentId}/approve`)
      .set('Cookie', studentCookies)
      .expect(403);
    await request(httpServer())
      .patch(`/api/v1/payments/${paymentId}/reject`)
      .set('Cookie', adminCookies)
      .send({ reason: 'Comprobante no legible' })
      .expect(200);
    const rejected = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { enrollment: true },
    });
    expect(rejected?.status).toBe('REJECTED');
    expect(rejected?.enrollment.status).toBe('SUSPENDED');
    expect(rejected?.rejectionReason).toBe('Comprobante no legible');

    const retried = await request(httpServer())
      .post('/api/v1/payments/checkout')
      .set('Cookie', studentCookies)
      .send({ cohortId: paidCohortId, method: 'EFECTIVO' })
      .expect(201);
    const retriedBody = checkoutBody(retried.body);
    expect(retriedBody.payment?.id).toBe(paymentId);
    expect(retriedBody.payment?.status).toBe('PENDING');
  });

  it('aprueba el pago, activa la matrícula y registra auditoría', async () => {
    await request(httpServer())
      .patch(`/api/v1/payments/${paymentId}/approve`)
      .set('Cookie', adminCookies)
      .expect(200);
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { enrollment: true },
    });
    expect(payment?.status).toBe('COMPLETED');
    expect(payment?.enrollment.status).toBe('ACTIVE');
    expect(
      await prisma.auditLog.count({
        where: { action: 'APPROVE_PAYMENT', entityId: paymentId },
      }),
    ).toBe(1);
  });
});

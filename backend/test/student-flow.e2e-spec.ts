import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/shared/infrastructure/filters/http-exception.filter';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';
import { createHash, randomUUID } from 'node:crypto';

describe('Flujo Completo de Estudiante (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sessionCookies: string[] = [];
  let firstRefreshCookie = '';
  let fixtureCourseId = '';
  const testEmail = `e2e_student_${Date.now()}@academia.edu`;
  const testPassword = 'Password@123';

  const httpServer = (): Server => app.getHttpServer() as Server;

  interface UserBody {
    email: string;
    firstName: string;
    dni?: string;
    phone?: string;
    profileComplete?: boolean;
    data?: UserBody;
  }

  interface ErrorBody {
    statusCode: number;
    message: string;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get(PrismaService);
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    const course = await prisma.course.create({
      data: {
        code: `E2E-${Date.now()}`,
        name: 'Curso para verificar precios E2E',
        isPublished: true,
        cohorts: {
          create: {
            name: 'Cohorte para verificar decimales',
            price: 199.9,
            startDate: new Date(Date.now() + 86_400_000),
            endDate: new Date(Date.now() + 30 * 86_400_000),
          },
        },
      },
    });
    fixtureCourseId = course.id;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({ where: { email: testEmail } });
      if (fixtureCourseId) {
        await prisma.cohort.deleteMany({
          where: { courseId: fixtureCourseId },
        });
        await prisma.course.delete({ where: { id: fixtureCourseId } });
      }
    }
    if (app) {
      await app.close();
    }
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('1. POST /api/v1/auth/register — Debe registrar un nuevo estudiante', async () => {
    const res = await request(httpServer())
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        firstName: 'Estudiante',
        lastName: 'E2E',
      })
      .expect(201);

    const body = res.body as unknown as { user: UserBody };
    expect(body).toHaveProperty('user');
    expect(body.user.email).toBe(testEmail);
    expect(body.user.firstName).toBe('Estudiante');
  });

  it('2. POST /api/v1/auth/login — Debe iniciar sesión con cookies HttpOnly', async () => {
    const res = await request(httpServer())
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      })
      .expect(200);

    const body = res.body as unknown as { user: UserBody };
    expect(body).not.toHaveProperty('accessToken');
    expect(body).toHaveProperty('user');
    const setCookies = res.headers['set-cookie'] as unknown as string[];
    expect(setCookies).toEqual(
      expect.arrayContaining([
        expect.stringContaining('av_access='),
        expect.stringContaining('av_refresh='),
      ]),
    );
    expect(setCookies.every((cookie) => cookie.includes('HttpOnly'))).toBe(
      true,
    );
    sessionCookies = setCookies.map((cookie) => cookie.split(';')[0]);
    firstRefreshCookie = sessionCookies.find((cookie) =>
      cookie.startsWith('av_refresh='),
    )!;
  });

  it('3. GET /api/v1/users/me — Debe autenticar usando la cookie', async () => {
    const res = await request(httpServer())
      .get('/api/v1/users/me')
      .set('Cookie', sessionCookies)
      .expect(200);

    const responseBody = res.body as unknown as UserBody;
    const userObj = responseBody.data ?? responseBody;
    expect(userObj.email).toBe(testEmail);
    expect(userObj.firstName).toBe('Estudiante');
  });

  it('3b. PATCH /api/v1/users/me — Debe completar la ficha personal peruana', async () => {
    const dni = String(Date.now()).slice(-8);
    const updated = await request(httpServer())
      .patch('/api/v1/users/me')
      .set('Cookie', sessionCookies)
      .send({
        dni,
        phone: '+51987654321',
        address: 'Av. Prueba 123',
        district: 'Miraflores',
        province: 'Lima',
        department: 'Lima',
      })
      .expect(200);

    const updatedBody = updated.body as unknown as UserBody;
    expect(updatedBody.dni).toBe(dni);
    expect(updatedBody.phone).toBe('+51987654321');
    expect(updatedBody.profileComplete).toBe(true);
  });

  it('4. POST /api/v1/auth/refresh — Debe rotar ambas cookies', async () => {
    const res = await request(httpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', sessionCookies)
      .expect(200);

    const setCookies = res.headers['set-cookie'] as unknown as string[];
    sessionCookies = setCookies.map((cookie) => cookie.split(';')[0]);
    const nextRefreshCookie = sessionCookies.find((cookie) =>
      cookie.startsWith('av_refresh='),
    );
    expect(nextRefreshCookie).toBeDefined();
    expect(nextRefreshCookie).not.toBe(firstRefreshCookie);

    await request(httpServer())
      .get('/api/v1/users/me')
      .set('Cookie', sessionCookies)
      .expect(200);
  });

  it('5. POST /api/v1/auth/logout — Debe revocar y limpiar las cookies', async () => {
    const res = await request(httpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', sessionCookies)
      .expect(204);

    const setCookies = res.headers['set-cookie'] as unknown as string[];
    expect(setCookies).toEqual(
      expect.arrayContaining([
        expect.stringContaining('av_access=;'),
        expect.stringContaining('av_refresh=;'),
      ]),
    );

    await request(httpServer()).get('/api/v1/users/me').expect(401);
    await request(httpServer())
      .get('/api/v1/users/me')
      .set('Cookie', sessionCookies)
      .expect(401);
  });

  it('6. POST /api/v1/auth/refresh — Debe rechazar un refresh token rotado', async () => {
    await request(httpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [firstRefreshCookie])
      .expect(401);
  });

  it('6b. Reutilizar un refresh token revoca otras sesiones después del commit', async () => {
    const login = () =>
      request(httpServer())
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: testPassword })
        .expect(200);
    const first = await login();
    const second = await login();
    const cookies = (response: { headers: Record<string, unknown> }) =>
      (response.headers['set-cookie'] as string[]).map(
        (value) => value.split(';')[0],
      );
    const firstCookies = cookies(first);
    const secondCookies = cookies(second);
    await request(httpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', firstCookies)
      .expect(200);
    await request(httpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', firstCookies)
      .expect(401);
    await request(httpServer())
      .get('/api/v1/users/me')
      .set('Cookie', secondCookies)
      .expect(401);
  });

  it('6c. Consume una sola vez el token de recuperación concurrente y revoca el acceso anterior', async () => {
    const login = await request(httpServer())
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(200);
    const cookies = (login.headers['set-cookie'] as unknown as string[]).map(
      (value) => value.split(';')[0],
    );
    const token = randomUUID();
    await prisma.user.update({
      where: { email: testEmail },
      data: {
        resetToken: createHash('sha256').update(token).digest('hex'),
        resetTokenExpires: new Date(Date.now() + 60_000),
      },
    });
    const responses = await Promise.all(
      ['NewPassword@123', 'OtherPassword@123'].map((newPassword) =>
        request(httpServer())
          .post('/api/v1/auth/reset-password')
          .send({ token, newPassword }),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 400,
    ]);
    await request(httpServer())
      .get('/api/v1/users/me')
      .set('Cookie', cookies)
      .expect(401);
  });

  it('7. GET /api/v1/settings — Debe obtener la configuración pública de la plataforma', async () => {
    const res = await request(httpServer())
      .get('/api/v1/settings/public')
      .expect(200);

    expect(res.body as unknown as { academyName: string }).toHaveProperty(
      'academyName',
    );
  });

  it('8. GET /api/v1/academic/cohorts — Debe serializar precios como decimales fijos', async () => {
    const res = await request(httpServer())
      .get('/api/v1/academic/public/cohorts')
      .expect(200);

    const cohorts = res.body as unknown as Array<{ price: string }>;
    expect(cohorts.length).toBeGreaterThan(0);
    expect(cohorts[0].price).toMatch(/^\d+\.\d{2}$/);
  });

  it('9. GET /api/v1/certificates/verify/:code — Debe retornar 404 para un código de certificado inexistente', async () => {
    const res = await request(httpServer())
      .get('/api/v1/certificates/verify/CERT-INVALID-999')
      .expect(404);

    const errorBody = res.body as unknown as ErrorBody;
    expect(errorBody.statusCode).toBe(404);
    expect(errorBody.message).toContain('no encontrado');
  });
});

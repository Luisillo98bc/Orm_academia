import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/shared/infrastructure/filters/http-exception.filter';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';

describe('Flujo Completo de Estudiante (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sessionCookies: string[] = [];
  let firstRefreshCookie = '';
  const testEmail = `e2e_student_${Date.now()}@academia.edu`;
  const testPassword = 'Password@123';

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
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({ where: { email: testEmail } });
    }
    if (app) {
      await app.close();
    }
  });

  it('1. POST /api/v1/auth/register — Debe registrar un nuevo estudiante', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        firstName: 'Estudiante',
        lastName: 'E2E',
      })
      .expect(201);

    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.user.firstName).toBe('Estudiante');
  });

  it('2. POST /api/v1/auth/login — Debe iniciar sesión con cookies HttpOnly', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      })
      .expect(200);

    expect(res.body).not.toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('user');
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
    const res = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Cookie', sessionCookies)
      .expect(200);

    const userObj = res.body.data || res.body;
    expect(userObj.email).toBe(testEmail);
    expect(userObj.firstName).toBe('Estudiante');
  });

  it('4. POST /api/v1/auth/refresh — Debe rotar ambas cookies', async () => {
    const res = await request(app.getHttpServer())
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

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Cookie', sessionCookies)
      .expect(200);
  });

  it('5. POST /api/v1/auth/logout — Debe revocar y limpiar las cookies', async () => {
    const res = await request(app.getHttpServer())
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

    await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
  });

  it('6. POST /api/v1/auth/refresh — Debe rechazar un refresh token rotado', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [firstRefreshCookie])
      .expect(401);
  });

  it('7. GET /api/v1/settings — Debe obtener la configuración pública de la plataforma', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/settings')
      .expect(200);

    expect(res.body).toHaveProperty('id');
  });

  it('8. GET /api/v1/academic/cohorts — Debe serializar precios como decimales fijos', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/academic/cohorts')
      .expect(200);

    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].price).toMatch(/^\d+\.\d{2}$/);
  });

  it('9. GET /api/v1/certificates/verify/:code — Debe retornar 404 para un código de certificado inexistente', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/certificates/verify/CERT-INVALID-999')
      .expect(404);

    expect(res.body.statusCode).toBe(404);
    expect(res.body.message).toContain('no encontrado');
  });
});

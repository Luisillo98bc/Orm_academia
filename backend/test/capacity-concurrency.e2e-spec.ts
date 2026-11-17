import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'node:http';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';

describe('Reserva atómica de cupos (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cohortId = '';
  let courseId = '';
  const suffix = Date.now();
  const users = [
    {
      email: `e2e_capacity_a_${suffix}@academia.edu`,
      firstName: 'Cupo A',
    },
    {
      email: `e2e_capacity_b_${suffix}@academia.edu`,
      firstName: 'Cupo B',
    },
  ];
  const password = 'Password@123';

  const httpServer = (): Server => app.getHttpServer() as Server;

  const cookiesFrom = (value: unknown): string[] => {
    const cookies = Array.isArray(value)
      ? value.filter((cookie): cookie is string => typeof cookie === 'string')
      : [];
    return cookies.map((cookie) => cookie.split(';')[0]);
  };

  beforeAll(async () => {
    const fixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = fixture.createNestApplication();
    prisma = fixture.get(PrismaService);
    app.setGlobalPrefix('api/v1');
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
        code: `CAP-${suffix}`.slice(0, 20),
        name: 'Curso E2E de capacidad',
        isPublished: true,
      },
    });
    courseId = course.id;

    const cohort = await prisma.cohort.create({
      data: {
        courseId,
        name: 'Cohorte E2E de un cupo',
        price: 100,
        maxStudents: 1,
        startDate: new Date(Date.now() + 86_400_000),
        endDate: new Date(Date.now() + 30 * 86_400_000),
        isActive: true,
      },
    });
    cohortId = cohort.id;

    for (const user of users) {
      await request(httpServer())
        .post('/api/v1/auth/register')
        .send({
          email: user.email,
          password,
          firstName: user.firstName,
          lastName: 'E2E',
        })
        .expect(201);
    }
  }, 30_000);

  afterAll(async () => {
    try {
      if (cohortId) {
        await prisma.enrollment.deleteMany({ where: { cohortId } });
        await prisma.cohort.delete({ where: { id: cohortId } });
      }
      if (courseId) {
        await prisma.course.delete({ where: { id: courseId } });
      }
      await prisma.user.deleteMany({
        where: { email: { in: users.map((user) => user.email) } },
      });
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 30_000);

  it('permite como máximo una reserva cuando dos usuarios compran simultáneamente', async () => {
    const loggedIn = await Promise.all(
      users.map((user) =>
        request(httpServer())
          .post('/api/v1/auth/login')
          .send({ email: user.email, password })
          .expect(200),
      ),
    );
    const userCookies = loggedIn.map((response) =>
      cookiesFrom(response.headers['set-cookie']),
    );

    const responses = await Promise.all(
      userCookies.map((cookies) =>
        request(httpServer())
          .post('/api/v1/payments/checkout')
          .set('Cookie', cookies)
          .send({ cohortId, method: 'EFECTIVO' }),
      ),
    );

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 400,
    ]);
    expect(
      await prisma.enrollment.count({
        where: { cohortId, deletedAt: null },
      }),
    ).toBe(1);
  }, 30_000);
});

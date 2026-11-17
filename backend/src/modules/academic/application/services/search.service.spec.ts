import { SearchService } from './search.service';
import type { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

describe('SearchService', () => {
  let service: SearchService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  beforeEach(() => {
    prisma = {
      course: { findMany: jest.fn().mockResolvedValue([{ id: 'course-1' }]) },
      user: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'user-1', roles: [{ role: { name: 'DOCENTE' } }] },
          ]),
      },
      cohort: { findMany: jest.fn().mockResolvedValue([{ id: 'cohort-1' }]) },
      prospect: {
        findMany: jest.fn().mockResolvedValue([{ id: 'prospect-1' }]),
      },
      payment: { findMany: jest.fn().mockResolvedValue([{ id: 'payment-1' }]) },
      supportTicket: {
        findMany: jest.fn().mockResolvedValue([{ id: 'ticket-1' }]),
      },
    };
    service = new SearchService(prisma as unknown as PrismaService);
  });

  it('returns empty buckets for short queries', async () => {
    await expect(service.globalSearch(' a ')).resolves.toEqual({
      courses: [],
      users: [],
      cohorts: [],
      prospects: [],
      payments: [],
      supportTickets: [],
    });
  });

  it('searches all staff resources and flattens user roles', async () => {
    const result = await service.globalSearch('  algebra  ', {
      id: 'admin-1',
      roles: ['ADMIN'],
    });

    expect(result).toMatchObject({
      courses: [{ id: 'course-1' }],
      users: [{ id: 'user-1', roles: ['DOCENTE'] }],
      cohorts: [{ id: 'cohort-1' }],
      prospects: [{ id: 'prospect-1' }],
      payments: [{ id: 'payment-1' }],
      supportTickets: [{ id: 'ticket-1' }],
    });
    expect(prisma.user.findMany).toHaveBeenCalled();
    expect(prisma.prospect.findMany).toHaveBeenCalled();
    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          enrollment: expect.anything() as jest.AsymmetricMatcher,
        }) as jest.AsymmetricMatcher,
      }),
    );
  });

  it('restricts non-staff users to their own payments and tickets', async () => {
    const result = await service.globalSearch('algebra', {
      id: 'student-1',
      roles: ['ESTUDIANTE'],
    });

    expect(result.users).toEqual([]);
    expect(result.prospects).toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.prospect.findMany).not.toHaveBeenCalled();
    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          enrollment: expect.objectContaining({
            userId: 'student-1',
          }) as jest.AsymmetricMatcher,
        }) as jest.AsymmetricMatcher,
      }),
    );
    expect(prisma.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isPublished: true,
        }) as jest.AsymmetricMatcher,
      }),
    );
    expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          requesterId: 'student-1',
        }) as jest.AsymmetricMatcher,
      }),
    );
  });

  it('scopes teacher cohort search to assigned cohorts', async () => {
    await service.globalSearch('programacion', {
      id: 'teacher-1',
      roles: ['DOCENTE'],
    });

    expect(prisma.cohort.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          teachers: { some: { id: 'teacher-1' } },
        }) as jest.AsymmetricMatcher,
      }),
    );
  });
});

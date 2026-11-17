import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProspectsService } from './prospects.service';

describe('ProspectsService', () => {
  const prisma = {
    prospect: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    cohort: { count: jest.fn() },
    user: { findUnique: jest.fn(), count: jest.fn() },
    prospectNote: { create: jest.fn() },
  };
  let service: ProspectsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProspectsService(prisma as never);
  });

  it('valida datos públicos antes de guardar un prospecto', async () => {
    await expect(
      service.create({
        name: 'A',
        email: 'ana@test.com',
        privacyConsent: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({ name: 'Ana', privacyConsent: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({
        name: 'Ana',
        email: 'invalid',
        privacyConsent: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({
        name: 'Ana',
        phone: '123',
        privacyConsent: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({
        name: 'Ana',
        email: 'ana@test.com',
        privacyConsent: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('crea prospectos normalizados y valida la cohorte', async () => {
    prisma.cohort.count.mockResolvedValue(1);
    prisma.prospect.findFirst.mockResolvedValue(null);
    prisma.prospect.create.mockResolvedValue({ id: 'prospect-1' });

    await expect(
      service.create({
        name: '  Ana Prueba  ',
        email: ' ANA@TEST.COM ',
        phone: '+51 (999) 111-222',
        message: '  Quiero información  ',
        cohortId: 'cohort-1',
        source: 'landing form!',
        privacyConsent: true,
      }),
    ).resolves.toEqual({ received: true, duplicate: false });
    expect(prisma.prospect.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Ana Prueba',
        email: 'ana@test.com',
        phone: '+51999111222',
        message: 'Quiero información',
        source: 'landingform',
      }) as jest.AsymmetricMatcher,
    });

    prisma.cohort.count.mockResolvedValue(0);
    await expect(
      service.create({
        name: 'Ana',
        email: 'ana@test.com',
        cohortId: 'missing',
        privacyConsent: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('actualiza un duplicado reciente en lugar de crear otro', async () => {
    prisma.prospect.findFirst.mockResolvedValue({
      id: 'prospect-existing',
      message: 'Anterior',
    });
    await expect(
      service.create({
        name: 'Ana',
        email: 'ana@test.com',
        message: 'Nuevo mensaje',
        privacyConsent: true,
      }),
    ).resolves.toEqual({ received: true, duplicate: true });
    expect(prisma.prospect.update).toHaveBeenCalledWith({
      where: { id: 'prospect-existing' },
      data: { message: 'Nuevo mensaje' },
    });
    expect(prisma.prospect.create).not.toHaveBeenCalled();
  });

  it('lista prospectos, calcula estadísticas y obtiene uno por id', async () => {
    prisma.prospect.findMany.mockResolvedValue([{ id: 'prospect-1' }]);
    prisma.prospect.count.mockResolvedValueOnce(7).mockResolvedValueOnce(2);
    await expect(
      service.list({ page: 2, limit: 5, status: 'CONTACTED', search: 'ana' }),
    ).resolves.toEqual({
      data: [{ id: 'prospect-1' }],
      pagination: { page: 2, limit: 5, total: 7, totalPages: 2 },
    });

    prisma.prospect.groupBy.mockResolvedValue([
      { status: 'NEW', _count: { _all: 4 } },
      { status: 'CONTACTED', _count: { _all: 3 } },
    ]);
    await expect(service.stats()).resolves.toEqual({
      byStatus: { NEW: 4, CONTACTED: 3 },
      overdue: 2,
    });

    prisma.prospect.findUnique.mockResolvedValue({ id: 'prospect-1' });
    await expect(service.findOne('prospect-1')).resolves.toEqual({
      id: 'prospect-1',
    });
    prisma.prospect.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('actualiza estado, asignación y seguimiento', async () => {
    prisma.prospect.count.mockResolvedValue(1);
    prisma.prospect.update.mockResolvedValue({
      id: 'prospect-1',
      status: 'INTERESTED',
    });
    await expect(
      service.update('prospect-1', {
        status: 'INTERESTED',
        assignedToId: '',
        nextFollowUpAt: '2026-08-30',
        markContacted: true,
      }),
    ).resolves.toEqual({ id: 'prospect-1', status: 'INTERESTED' });
    expect(prisma.prospect.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'prospect-1' },
        data: expect.objectContaining({
          status: 'INTERESTED',
          assignedToId: null,
        }) as jest.AsymmetricMatcher,
      }),
    );

    prisma.prospect.count.mockResolvedValue(0);
    await expect(service.update('missing', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('añade notas y protege contenido vacío o prospectos inexistentes', async () => {
    prisma.prospect.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    prisma.prospectNote.create.mockResolvedValue({ id: 'note-1' });
    await expect(
      service.addNote('prospect-1', 'admin-1', '  Llamar mañana  '),
    ).resolves.toEqual({ id: 'note-1' });
    expect(prisma.prospectNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          prospectId: 'prospect-1',
          authorId: 'admin-1',
          content: 'Llamar mañana',
        },
      }),
    );
    await expect(
      service.addNote('prospect-1', 'admin-1', ' '),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.addNote('missing', 'admin-1', 'Nota válida'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('permite registrar prospectos manuales desde el panel con validaciones', async () => {
    prisma.cohort.count.mockResolvedValue(1);
    prisma.user.count.mockResolvedValue(1);
    prisma.prospect.create.mockResolvedValue({ id: 'manual-prospect-1' });

    await expect(
      service.createManual({
        name: 'Carlos Ventas',
        email: 'carlos@ventas.pe',
        phone: '+51 987654321',
        message: 'Llamó preguntando por horarios',
        cohortId: 'cohort-1',
        assignedToId: 'seller-1',
      }),
    ).resolves.toEqual({ id: 'manual-prospect-1' });

    expect(prisma.prospect.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Carlos Ventas',
          email: 'carlos@ventas.pe',
          phone: '+51987654321',
          source: 'MANUAL',
        }) as jest.AsymmetricMatcher,
      }),
    );
  });

  it('sincroniza intenciones de checkout y conversiones a matriculado', async () => {
    // Checkout intent para usuario
    prisma.user.findUnique.mockResolvedValue({
      firstName: 'Maria',
      lastName: 'Paz',
      email: 'maria@test.com',
      phone: '999888777',
    });
    prisma.prospect.findFirst.mockResolvedValue(null);
    prisma.prospect.create.mockResolvedValue({ id: 'p-checkout' });

    await service.recordCheckoutIntent({
      userId: 'user-1',
      cohortId: 'cohort-1',
      method: 'EFECTIVO',
    });

    expect(prisma.prospect.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Maria Paz',
          email: 'maria@test.com',
          source: 'CHECKOUT_EFECTIVO',
          status: 'INTERESTED',
        }) as jest.AsymmetricMatcher,
      }),
    );

    // Auto-conversión a matriculado
    prisma.prospect.findMany.mockResolvedValue([{ id: 'p-checkout' }]);
    prisma.prospect.updateMany.mockResolvedValue({ count: 1 });

    await service.recordEnrollmentCompleted({
      email: 'maria@test.com',
      cohortId: 'cohort-1',
    });

    expect(prisma.prospect.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['p-checkout'] } },
      data: { status: 'ENROLLED' },
    });
  });
});

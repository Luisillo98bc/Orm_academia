import { ContentVersionService } from './content-version.service';
import type { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

describe('ContentVersionService', () => {
  let service: ContentVersionService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  beforeEach(() => {
    prisma = {
      contentVersion: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'version-1' }),
      },
      syllabusModule: {
        update: jest.fn().mockResolvedValue({ id: 'module-1' }),
      },
      material: { update: jest.fn().mockResolvedValue({ id: 'material-1' }) },
      classSession: {
        update: jest.fn().mockResolvedValue({ id: 'session-1' }),
      },
    };
    service = new ContentVersionService(prisma as unknown as PrismaService);
  });

  it('records the next version after the latest snapshot', async () => {
    prisma.contentVersion.findFirst.mockResolvedValue({ version: 4 });

    await service.record('MODULE', 'module-1', 'teacher-1', {
      title: 'Week 1',
    });

    expect(prisma.contentVersion.create).toHaveBeenCalledWith({
      data: {
        entityType: 'MODULE',
        entityId: 'module-1',
        createdById: 'teacher-1',
        version: 5,
        snapshot: { title: 'Week 1' },
      },
    });
  });

  it('starts at version one and lists newest versions first', async () => {
    prisma.contentVersion.findFirst.mockResolvedValue(null);

    await service.record('MATERIAL', 'material-1', 'teacher-1', {
      title: 'PDF',
    });
    await service.list('MATERIAL', 'material-1');

    expect(prisma.contentVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: 1 }) as jest.AsymmetricMatcher,
      }),
    );
    expect(prisma.contentVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50, orderBy: { version: 'desc' } }),
    );
  });

  it.each([
    [
      'MODULE',
      'module-1',
      'syllabusModule',
      { title: 'Restored', description: '', order: 2 },
    ],
    [
      'MATERIAL',
      'material-1',
      'material',
      { title: 'Restored PDF', type: 'PDF', fileUrl: 'file.pdf' },
    ],
    [
      'SESSION',
      'session-1',
      'classSession',
      { title: 'Live', date: '2026-03-01', meetLink: '' },
    ],
  ])(
    'restores a %s snapshot and records the restoration',
    async (type, id, model, snapshot) => {
      prisma.contentVersion.findFirst.mockResolvedValue({
        entityType: type,
        snapshot,
      });
      const update = prisma[model].update;

      await service.restore(type.toLowerCase(), id, 2, 'admin-1');

      expect(update).toHaveBeenCalled();
      expect(prisma.contentVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: type,
            entityId: id,
          }) as jest.AsymmetricMatcher,
        }),
      );
    },
  );

  it('rejects missing and unsupported versions', async () => {
    prisma.contentVersion.findFirst.mockResolvedValue(null);
    await expect(
      service.restore('MODULE', 'missing', 1, 'admin-1'),
    ).rejects.toThrow('Versión de contenido no encontrada');

    prisma.contentVersion.findFirst.mockResolvedValue({
      entityType: 'UNKNOWN',
      snapshot: {},
    });
    await expect(
      service.restore('UNKNOWN', 'id', 1, 'admin-1'),
    ).rejects.toThrow('Tipo de contenido no soportado');
  });
});

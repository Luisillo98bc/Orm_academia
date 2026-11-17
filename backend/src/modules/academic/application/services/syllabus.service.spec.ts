import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SyllabusService } from './syllabus.service';

describe('SyllabusService', () => {
  const prisma = {
    cohort: { findUnique: jest.fn() },
    syllabusModule: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    material: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    classSession: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const versions = { record: jest.fn() };
  let service: SyllabusService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SyllabusService(prisma as never, versions as never);
  });

  it('permite accesos administrativos y valida docentes/alumnos', async () => {
    await service.assertCohortViewAccess('cohort-1', {
      id: 'admin-1',
      roles: ['ADMIN'],
    });
    await service.assertCohortManagerAccess('cohort-1', {
      id: 'admin-1',
      roles: ['ADMIN'],
    });
    expect(prisma.cohort.findUnique).not.toHaveBeenCalled();

    prisma.cohort.findUnique.mockResolvedValue({
      id: 'cohort-1',
      teachers: [{ id: 'teacher-1' }],
      enrollments: [{ id: 'enrollment-1' }],
    });
    await service.assertCohortViewAccess('cohort-1', {
      id: 'teacher-1',
      roles: ['DOCENTE'],
    });
    await service.assertCohortViewAccess('cohort-1', {
      id: 'student-1',
      roles: ['ESTUDIANTE'],
    });

    prisma.cohort.findUnique.mockResolvedValue({
      id: 'cohort-1',
      teachers: [{ id: 'teacher-1' }],
      enrollments: [],
    });
    await expect(
      service.assertCohortViewAccess('cohort-1', {
        id: 'outsider',
        roles: ['ESTUDIANTE'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    prisma.cohort.findUnique.mockResolvedValue(null);
    await expect(
      service.assertCohortViewAccess('missing', {
        id: 'student-1',
        roles: ['ESTUDIANTE'],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza una cohorte inexistente o un docente no asignado', async () => {
    prisma.cohort.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.assertCohortManagerAccess('missing', {
        id: 'teacher-1',
        roles: ['DOCENTE'],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.cohort.findUnique.mockResolvedValueOnce({
      id: 'cohort-1',
      teachers: [{ id: 'another-teacher' }],
    });
    await expect(
      service.assertCohortManagerAccess('cohort-1', {
        id: 'teacher-1',
        roles: ['DOCENTE'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('crea, consulta y publica módulos', async () => {
    prisma.cohort.findUnique.mockResolvedValue({
      id: 'cohort-1',
      teachers: [{ id: 'teacher-1' }],
    });
    prisma.syllabusModule.create.mockResolvedValue({ id: 'module-1' });
    prisma.syllabusModule.findMany
      .mockResolvedValueOnce([{ id: 'module-1' }])
      .mockResolvedValueOnce([{ id: 'module-public' }]);

    await expect(
      service.createModule(
        'cohort-1',
        { title: 'Módulo 1', description: 'Descripción', order: 1 },
        { id: 'teacher-1', roles: ['DOCENTE'] },
      ),
    ).resolves.toEqual({ id: 'module-1' });
    await expect(service.getModulesByCohort('cohort-1')).resolves.toEqual([
      { id: 'module-1' },
    ]);
    await expect(service.getPublicModulesByCohort('cohort-1')).resolves.toEqual(
      [{ id: 'module-public' }],
    );
    prisma.cohort.findUnique.mockResolvedValue(null);
    await expect(
      service.createModule(
        'missing',
        { title: 'Módulo', order: 1 },
        { id: 'teacher-1', roles: ['DOCENTE'] },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('crea materiales y sesiones solo dentro de módulos gestionables', async () => {
    prisma.syllabusModule.findUnique.mockResolvedValue({
      cohortId: 'cohort-1',
    });
    prisma.cohort.findUnique.mockResolvedValue({
      id: 'cohort-1',
      teachers: [{ id: 'teacher-1' }],
    });
    prisma.material.create.mockResolvedValue({ id: 'material-1' });
    prisma.classSession.create.mockResolvedValue({ id: 'session-1' });

    await expect(
      service.addMaterial(
        'module-1',
        { title: 'PDF', type: 'PDF', fileUrl: '/files/a.pdf' },
        { id: 'teacher-1', roles: ['DOCENTE'] },
      ),
    ).resolves.toEqual({ id: 'material-1' });
    await expect(
      service.addSession(
        'module-1',
        {
          title: 'Clase',
          date: new Date('2026-08-26'),
          meetLink: '  https://meet  ',
        },
        { id: 'teacher-1', roles: ['DOCENTE'] },
      ),
    ).resolves.toEqual({ id: 'session-1' });
  });

  it('actualiza contenido y registra versiones', async () => {
    prisma.syllabusModule.findUnique.mockResolvedValue({
      cohortId: 'cohort-1',
    });
    prisma.classSession.findUnique.mockResolvedValue({ moduleId: 'module-1' });
    prisma.material.findUnique.mockResolvedValue({ moduleId: 'module-1' });
    prisma.cohort.findUnique.mockResolvedValue({
      id: 'cohort-1',
      teachers: [{ id: 'teacher-1' }],
    });
    prisma.syllabusModule.update.mockResolvedValue({
      id: 'module-1',
      title: 'Nuevo',
    });
    prisma.material.update.mockResolvedValue({
      id: 'material-1',
      title: 'Nuevo PDF',
    });
    prisma.classSession.update.mockResolvedValue({
      id: 'session-1',
      title: 'Nueva clase',
    });

    const user = { id: 'teacher-1', roles: ['DOCENTE'] };
    await service.updateModule(
      'module-1',
      { title: '  Nuevo  ', description: '  Desc  ', order: 2 },
      user,
    );
    await service.updateMaterial(
      'material-1',
      { title: '  Nuevo PDF  ', fileUrl: ' /new.pdf ' },
      user,
    );
    await service.updateSession(
      'session-1',
      { title: '  Nueva clase  ', meetLink: '  ' },
      user,
    );

    prisma.syllabusModule.findUnique.mockResolvedValue(null);
    await expect(
      service.updateMaterial('missing-module', { title: 'x' }, user),
    ).rejects.toBeInstanceOf(NotFoundException);
    prisma.syllabusModule.findUnique.mockResolvedValue({
      cohortId: 'cohort-1',
    });
    prisma.material.findUnique.mockResolvedValue(null);
    await expect(
      service.updateMaterial('missing', { title: 'x' }, user),
    ).rejects.toBeInstanceOf(NotFoundException);
    prisma.classSession.findUnique.mockResolvedValue(null);
    await expect(
      service.updateSession('missing', { title: 'x' }, user),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(versions.record).toHaveBeenCalledTimes(3);
    expect(prisma.classSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { title: 'Nueva clase', meetLink: null },
    });
  });

  it('elimina módulos, materiales y sesiones, validando faltantes', async () => {
    prisma.syllabusModule.findUnique.mockResolvedValue({
      cohortId: 'cohort-1',
    });
    prisma.material.findUnique.mockResolvedValue({ moduleId: 'module-1' });
    prisma.classSession.findUnique.mockResolvedValue({ moduleId: 'module-1' });
    prisma.cohort.findUnique.mockResolvedValue({
      id: 'cohort-1',
      teachers: [{ id: 'teacher-1' }],
    });
    prisma.syllabusModule.delete.mockResolvedValue({ id: 'module-1' });
    prisma.material.delete.mockResolvedValue({ id: 'material-1' });
    prisma.classSession.delete.mockResolvedValue({ id: 'session-1' });
    const user = { id: 'teacher-1', roles: ['DOCENTE'] };

    await expect(service.deleteModule('module-1', user)).resolves.toEqual({
      id: 'module-1',
    });
    await expect(service.deleteMaterial('material-1', user)).resolves.toEqual({
      id: 'material-1',
    });
    await expect(service.deleteSession('session-1', user)).resolves.toEqual({
      id: 'session-1',
    });

    prisma.material.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.deleteMaterial('missing', user),
    ).rejects.toBeInstanceOf(NotFoundException);
    prisma.classSession.findUnique.mockResolvedValueOnce(null);
    await expect(service.deleteSession('missing', user)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

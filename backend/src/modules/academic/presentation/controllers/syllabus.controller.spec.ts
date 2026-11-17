import { BadRequestException } from '@nestjs/common';
import { MaterialType } from '@prisma/client';
import { SyllabusController } from './syllabus.controller';
import type { SyllabusService } from '../../application/services/syllabus.service';
import type { ContentVersionService } from '../../application/services/content-version.service';
import type { StorageService } from '../../../../shared/infrastructure/storage/storage.service';

describe('SyllabusController', () => {
  let controller: SyllabusController;
  let syllabus: Record<string, jest.Mock>;
  let storage: Record<string, jest.Mock>;
  let versions: Record<string, jest.Mock>;
  const user = {
    id: 'teacher-1',
    email: 'teacher@example.com',
    roles: ['DOCENTE'],
    permissions: [],
  };

  beforeEach(() => {
    syllabus = {
      assertContentManagerAccess: jest.fn().mockResolvedValue(undefined),
      assertModuleManagerAccess: jest.fn().mockResolvedValue(undefined),
      addMaterial: jest.fn().mockResolvedValue({}),
      addSession: jest.fn().mockResolvedValue({}),
      updateModule: jest.fn().mockResolvedValue({}),
      deleteModule: jest.fn().mockResolvedValue(undefined),
      deleteMaterial: jest.fn().mockResolvedValue(undefined),
      updateMaterial: jest.fn().mockResolvedValue({}),
      deleteSession: jest.fn().mockResolvedValue(undefined),
      updateSession: jest.fn().mockResolvedValue({}),
      createModule: jest.fn().mockResolvedValue({}),
      getPublicModulesByCohort: jest.fn().mockResolvedValue([]),
      assertCohortViewAccess: jest.fn().mockResolvedValue(undefined),
      getModulesByCohort: jest.fn().mockResolvedValue([]),
    };
    storage = {
      uploadFile: jest.fn().mockResolvedValue('https://cdn/material.pdf'),
    };
    versions = {
      list: jest.fn().mockResolvedValue([]),
      restore: jest.fn().mockResolvedValue({}),
    };
    controller = new SyllabusController(
      syllabus as unknown as SyllabusService,
      storage as unknown as StorageService,
      versions as unknown as ContentVersionService,
    );
  });

  it('lists and restores content versions with normalized parameters', async () => {
    await controller.listContentVersions('material', 'material-1', user);
    await controller.restoreContentVersion('session', 'session-1', '3', {
      id: 'admin-1',
      roles: ['ADMIN'],
    } as never);

    expect(versions.list).toHaveBeenCalledWith('MATERIAL', 'material-1');
    expect(versions.restore).toHaveBeenCalledWith(
      'session',
      'session-1',
      3,
      'admin-1',
    );
  });

  it('uploads materials, inferring PDF, video and repository types', async () => {
    await expect(
      controller.uploadMaterialFile(
        'module-1',
        { originalname: 'guide.pdf' } as Express.Multer.File,
        undefined,
        undefined,
        user,
      ),
    ).resolves.toBeDefined();
    await controller.uploadMaterialFile(
      'module-1',
      { originalname: 'class.mp4' } as Express.Multer.File,
      'Class',
      MaterialType.PDF,
      user,
    );
    await controller.uploadMaterialFile(
      'module-1',
      { originalname: 'diagram.png' } as Express.Multer.File,
      undefined,
      undefined,
      user,
    );

    expect(storage.uploadFile).toHaveBeenCalledTimes(3);
    expect(syllabus.addMaterial).toHaveBeenNthCalledWith(
      1,
      'module-1',
      expect.objectContaining({ title: 'guide.pdf', type: MaterialType.PDF }),
      user,
    );
    expect(syllabus.addMaterial).toHaveBeenNthCalledWith(
      2,
      'module-1',
      expect.objectContaining({ title: 'Class', type: MaterialType.VIDEO }),
      user,
    );
    expect(syllabus.addMaterial).toHaveBeenNthCalledWith(
      3,
      'module-1',
      expect.objectContaining({ type: MaterialType.REPOSITORY }),
      user,
    );
  });

  it('rejects uploads without a file', async () => {
    await expect(
      controller.uploadMaterialFile(
        'module-1',
        undefined as never,
        undefined,
        undefined,
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('delegates module, material and session mutations', async () => {
    await controller.addMaterial(
      'module-1',
      {
        title: 'PDF',
        type: MaterialType.PDF,
        fileUrl: 'url',
      },
      user,
    );
    await controller.addSession(
      'module-1',
      { title: 'Live', date: '2026-02-01', meetLink: 'meet' },
      user,
    );
    await controller.updateModule('module-1', { title: 'Updated' }, user);
    await controller.deleteModule('module-1', user);
    await controller.deleteMaterial('material-1', user);
    await controller.updateMaterial('material-1', { title: 'Updated' }, user);
    await controller.deleteSession('session-1', user);
    await controller.updateSession('session-1', { date: '2026-02-02' }, user);

    expect(syllabus.addSession).toHaveBeenCalledWith(
      'module-1',
      expect.objectContaining({ date: new Date('2026-02-01') }),
      user,
    );
    expect(syllabus.updateSession).toHaveBeenCalledWith(
      'session-1',
      { date: new Date('2026-02-02') },
      user,
    );
    expect(syllabus.deleteMaterial).toHaveBeenCalledWith('material-1', user);
  });

  it('creates modules and protects cohort module listing', async () => {
    await controller.createModule(
      'cohort-1',
      { title: 'Week 1', order: 1 },
      user,
    );
    await controller.getPublicModules('cohort-1');
    await controller.getModules('cohort-1', user);

    expect(syllabus.createModule).toHaveBeenCalledWith(
      'cohort-1',
      { title: 'Week 1', order: 1 },
      user,
    );
    expect(syllabus.getPublicModulesByCohort).toHaveBeenCalledWith('cohort-1');
    expect(syllabus.assertCohortViewAccess).toHaveBeenCalledWith(
      'cohort-1',
      user,
    );
    expect(syllabus.getModulesByCohort).toHaveBeenCalledWith('cohort-1');
  });
});

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import { StorageService } from './storage.service';

jest.mock('net', () => ({
  ...jest.requireActual<typeof net>('net'),
  createConnection: jest.fn(),
}));

function file(originalname: string, buffer: Buffer, filePath?: string) {
  return {
    originalname,
    buffer,
    path: filePath,
  } as Express.Multer.File;
}

function createStorage(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    STORAGE_PROVIDER: 'local',
    PRIVATE_STORAGE_DIR: 'C:\\tmp\\academia-storage-tests',
    ...overrides,
  };
  const config = {
    get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback),
  };
  const prisma = {
    material: { findFirst: jest.fn(), count: jest.fn().mockResolvedValue(0) },
    payment: { findFirst: jest.fn(), count: jest.fn().mockResolvedValue(0) },
    deliverable: {
      findFirst: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    cohort: { count: jest.fn().mockResolvedValue(0) },
    enrollment: { count: jest.fn().mockResolvedValue(0) },
    course: { count: jest.fn().mockResolvedValue(0) },
    user: { count: jest.fn().mockResolvedValue(0) },
  };
  return {
    storage: new StorageService(config as never, prisma as never),
    prisma,
  };
}

describe('StorageService file validation and access control', () => {
  it.each([
    ['document.pdf', Buffer.from('%PDF-1.7')],
    ['photo.jpg', Buffer.from([0xff, 0xd8, 0xff, 0x00])],
    [
      'photo.png',
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ],
    ['image.gif', Buffer.from('GIF89a')],
    [
      'image.webp',
      Buffer.concat([
        Buffer.from('RIFF'),
        Buffer.alloc(4),
        Buffer.from('WEBP'),
      ]),
    ],
    [
      'legacy.doc',
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    ],
    ['archive.zip', Buffer.from([0x50, 0x4b, 0x03, 0x04])],
    ['video.mp4', Buffer.concat([Buffer.alloc(4), Buffer.from('ftyp')])],
    [
      'video.avi',
      Buffer.concat([
        Buffer.from('RIFF'),
        Buffer.alloc(4),
        Buffer.from('AVI '),
      ]),
    ],
    ['video.webm', Buffer.from([0x1a, 0x45, 0xdf, 0xa3])],
    ['image.svg', Buffer.from('<svg viewBox="0 0 10 10"></svg>')],
    ['data.csv', Buffer.from('name,email\nAna,ana@example.com')],
  ])('accepts a valid %s signature', (name, bytes) => {
    const { storage } = createStorage();
    expect(() => storage.validateFile(file(name, bytes))).not.toThrow();
  });

  it('rejects empty and mismatched files', () => {
    const { storage } = createStorage();

    expect(() =>
      storage.validateFile(file('empty.pdf', Buffer.alloc(0))),
    ).toThrow('El archivo está vacío');
    expect(() =>
      storage.validateFile(file('fake.png', Buffer.from('%PDF-1.7'))),
    ).toThrow('El contenido no coincide con la extensión .png');
  });

  it('rejects invalid storage references and missing public files', async () => {
    const { storage } = createStorage();

    await expect(
      storage.resolvePublicDownloadTarget('storage://local/nope/file.txt'),
    ).rejects.toThrow('Referencia de almacenamiento inválida');
    await expect(
      storage.resolvePublicDownloadTarget(
        'storage://local/courses/missing.png',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      storage.resolvePublicDownloadTarget('storage://local/materials/file.pdf'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows administrators and assigned or enrolled users to access materials', async () => {
    const admin = createStorage();
    await expect(
      admin.storage.assertReferenceAccess(
        'storage://local/materials/file.pdf',
        { id: 'admin', roles: ['ADMIN'] },
      ),
    ).resolves.toBeUndefined();

    const teacher = createStorage();
    teacher.prisma.material.findFirst.mockResolvedValue({
      module: { cohortId: 'cohort-1' },
    });
    teacher.prisma.cohort.count.mockResolvedValue(1);
    await expect(
      teacher.storage.assertReferenceAccess(
        'storage://local/materials/file.pdf',
        { id: 'teacher', roles: ['DOCENTE'] },
      ),
    ).resolves.toBeUndefined();

    const student = createStorage();
    student.prisma.material.findFirst.mockResolvedValue({
      module: { cohortId: 'cohort-1' },
    });
    student.prisma.enrollment.count.mockResolvedValue(1);
    await expect(
      student.storage.assertReferenceAccess(
        'storage://local/materials/file.pdf',
        { id: 'student', roles: ['ESTUDIANTE'] },
      ),
    ).resolves.toBeUndefined();
  });

  it('rejects unauthorized material, voucher and missing-file access', async () => {
    const material = createStorage();
    material.prisma.material.findFirst.mockResolvedValue({
      module: { cohortId: 'cohort-1' },
    });
    await expect(
      material.storage.assertReferenceAccess(
        'storage://local/materials/file.pdf',
        { id: 'user', roles: ['ESTUDIANTE'] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    material.prisma.material.findFirst.mockResolvedValue(null);
    await expect(
      material.storage.assertReferenceAccess(
        'storage://local/materials/missing.pdf',
        { id: 'user', roles: ['ESTUDIANTE'] },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    const voucher = createStorage();
    voucher.prisma.payment.findFirst.mockResolvedValue({
      enrollment: { userId: 'owner' },
    });
    await expect(
      voucher.storage.assertReferenceAccess(
        'storage://local/vouchers/file.pdf',
        { id: 'owner' },
      ),
    ).resolves.toBeUndefined();
    await expect(
      voucher.storage.assertReferenceAccess(
        'storage://local/vouchers/file.pdf',
        { id: 'other' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const missing = createStorage();
    await expect(
      missing.storage.assertReferenceAccess(
        'storage://local/vouchers/missing.pdf',
        { id: 'user' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('recognizes public legacy images only when no private record uses the reference', async () => {
    const publicImage = createStorage();
    publicImage.prisma.course.count.mockResolvedValue(1);
    await expect(
      publicImage.storage.isPublicLegacyReference('/uploads/course.png'),
    ).resolves.toBe(true);

    const privateFile = createStorage();
    privateFile.prisma.material.count.mockResolvedValue(1);
    privateFile.prisma.course.count.mockResolvedValue(1);
    await expect(
      privateFile.storage.isPublicLegacyReference('/uploads/course.png'),
    ).resolves.toBe(false);
  });

  it('sube archivos localmente y resuelve su descarga privada', async () => {
    const root = fs.mkdtempSync(path.join(process.cwd(), '.storage-upload-'));
    try {
      const { storage } = createStorage({ PRIVATE_STORAGE_DIR: root });
      const reference = await storage.uploadFile(
        file('material.pdf', Buffer.from('%PDF-1.7 test')),
        'materials',
      );

      expect(reference).toMatch(/^storage:\/\/local\/materials\//);
      const target = await storage.resolveDownloadTarget(reference);
      expect(target.kind).toBe('local');
      if (target.kind === 'local') {
        expect(fs.existsSync(target.filePath)).toBe(true);
        expect(fs.readFileSync(target.filePath).toString()).toContain(
          '%PDF-1.7',
        );
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('resuelve archivos públicos locales y rechaza referencias antiguas privadas', async () => {
    const root = fs.mkdtempSync(path.join(process.cwd(), '.storage-public-'));
    try {
      const publicDir = path.join(root, 'courses');
      fs.mkdirSync(publicDir, { recursive: true });
      fs.writeFileSync(path.join(publicDir, 'cover.png'), Buffer.from('image'));
      const { storage } = createStorage({ PRIVATE_STORAGE_DIR: root });
      const target = await storage.resolvePublicDownloadTarget(
        'storage://local/courses/cover.png',
      );
      expect(target).toEqual({
        kind: 'local',
        filePath: path.join(publicDir, 'cover.png'),
      });

      await expect(
        storage.resolveDownloadTarget('storage://local/materials/missing.pdf'),
      ).rejects.toThrow('Archivo no encontrado');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('resuelve uploads legacy locales y valida traversal', async () => {
    const root = path.resolve(process.cwd(), 'uploads');
    fs.mkdirSync(root, { recursive: true });
    const filePath = path.join(root, 'legacy-test.txt');
    fs.writeFileSync(filePath, 'legacy');
    try {
      const { storage } = createStorage();
      await expect(
        storage.resolveDownloadTarget('/uploads/legacy-test.txt'),
      ).resolves.toMatchObject({
        kind: 'local',
        filePath,
      });
      await expect(
        storage.resolveDownloadTarget('/uploads/missing-test.txt'),
      ).rejects.toThrow('Archivo no encontrado');
      await expect(
        storage.resolveDownloadTarget('/uploads/../secret.txt'),
      ).rejects.toThrow();
    } finally {
      if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
    }
  });

  it('authorizes legacy material, voucher and deliverable references', async () => {
    const admin = createStorage();
    await expect(
      admin.storage.assertReferenceAccess('/uploads/admin.pdf', {
        id: 'admin',
        roles: ['ADMIN'],
      }),
    ).resolves.toBeUndefined();

    const material = createStorage();
    material.prisma.material.findFirst.mockResolvedValue({
      module: { cohortId: 'cohort-1' },
    });
    material.prisma.enrollment.count.mockResolvedValue(1);
    await expect(
      material.storage.assertReferenceAccess('/uploads/material.pdf', {
        id: 'student',
        roles: ['ESTUDIANTE'],
      }),
    ).resolves.toBeUndefined();

    const voucher = createStorage();
    voucher.prisma.material.findFirst.mockResolvedValue(null);
    voucher.prisma.payment.findFirst.mockResolvedValue({
      enrollment: { userId: 'student' },
    });
    await expect(
      voucher.storage.assertReferenceAccess('/uploads/voucher.pdf', {
        id: 'rrhh',
        roles: ['RRHH'],
      }),
    ).resolves.toBeUndefined();

    const deliverable = createStorage();
    deliverable.prisma.material.findFirst.mockResolvedValue(null);
    deliverable.prisma.payment.findFirst.mockResolvedValue(null);
    deliverable.prisma.deliverable.findFirst.mockResolvedValue({
      studentId: 'student',
      evaluation: { cohortId: 'cohort-1' },
    });
    await expect(
      deliverable.storage.assertReferenceAccess('/uploads/deliverable.zip', {
        id: 'student',
      }),
    ).resolves.toBeUndefined();
    deliverable.prisma.cohort.count.mockResolvedValue(1);
    await expect(
      deliverable.storage.assertReferenceAccess('/uploads/deliverable.zip', {
        id: 'teacher',
        roles: ['DOCENTE'],
      }),
    ).resolves.toBeUndefined();
    deliverable.prisma.deliverable.findFirst.mockResolvedValue(null);
    await expect(
      deliverable.storage.assertReferenceAccess('/uploads/missing.zip', {
        id: 'other',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    const unauthorizedMaterial = createStorage();
    unauthorizedMaterial.prisma.material.findFirst.mockResolvedValue({
      module: { cohortId: 'cohort-1' },
    });
    await expect(
      unauthorizedMaterial.storage.assertReferenceAccess(
        '/uploads/material.pdf',
        {
          id: 'other',
          roles: ['ESTUDIANTE'],
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const unauthorizedVoucher = createStorage();
    unauthorizedVoucher.prisma.payment.findFirst.mockResolvedValue({
      enrollment: { userId: 'owner' },
    });
    await expect(
      unauthorizedVoucher.storage.assertReferenceAccess(
        '/uploads/voucher.pdf',
        {
          id: 'other',
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const unauthorizedDeliverable = createStorage();
    unauthorizedDeliverable.prisma.deliverable.findFirst.mockResolvedValue({
      studentId: 'owner',
      evaluation: { cohortId: 'cohort-1' },
    });
    await expect(
      unauthorizedDeliverable.storage.assertReferenceAccess(
        '/uploads/deliverable.zip',
        {
          id: 'other',
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('resolves Supabase and MinIO download targets through controlled clients', async () => {
    const supabase = createStorage({
      STORAGE_PROVIDER: 'supabase',
      SUPABASE_URL: 'https://supabase.example',
      SUPABASE_SERVICE_ROLE_KEY: 'key',
    });
    (
      supabase.storage as unknown as { supabaseClient: unknown }
    ).supabaseClient = {
      storage: {
        from: jest.fn().mockReturnValue({
          createSignedUrl: jest.fn().mockResolvedValue({
            data: { signedUrl: 'https://signed.example' },
            error: null,
          }),
        }),
      },
    };
    await expect(
      supabase.storage.resolveDownloadTarget(
        'storage://supabase/materials/file.pdf',
      ),
    ).resolves.toEqual({ kind: 'redirect', url: 'https://signed.example' });

    const minio = createStorage({
      STORAGE_PROVIDER: 'minio',
      MINIO_ENDPOINT: 'http://minio',
      MINIO_ACCESS_KEY: 'key',
      MINIO_SECRET_KEY: 'secret',
    });
    (
      minio.storage as unknown as { minioClient: { send: jest.Mock } }
    ).minioClient = {
      send: jest.fn().mockResolvedValue({
        Body: { on: jest.fn() },
        ContentType: 'application/pdf',
        ContentLength: 10,
      }),
    };
    await expect(
      minio.storage.resolveDownloadTarget('storage://minio/materials/file.pdf'),
    ).resolves.toMatchObject({
      kind: 'stream',
      contentType: 'application/pdf',
      contentLength: 10,
    });
    (
      minio.storage as unknown as { minioClient: { send: jest.Mock } }
    ).minioClient.send.mockResolvedValue({});
    await expect(
      minio.storage.resolveDownloadTarget('storage://minio/materials/file.pdf'),
    ).rejects.toThrow('Archivo no encontrado');
    const noDownloadMinio = createStorage();
    const noDownloadState = noDownloadMinio.storage as unknown as {
      provider: 'minio';
      minioClient: null;
    };
    noDownloadState.provider = 'minio';
    noDownloadState.minioClient = null;
    await expect(
      noDownloadMinio.storage.resolveDownloadTarget(
        'storage://minio/materials/file.pdf',
      ),
    ).rejects.toThrow('MinIO no está configurado');
  });

  it('reports missing providers and remote download errors', async () => {
    const noSupabase = createStorage();
    const noSupabaseState = noSupabase.storage as unknown as {
      provider: 'supabase';
      supabaseClient: null;
    };
    noSupabaseState.provider = 'supabase';
    noSupabaseState.supabaseClient = null;
    await expect(
      noSupabase.storage.resolveDownloadTarget(
        'storage://supabase/materials/file.pdf',
      ),
    ).rejects.toThrow('Supabase Storage no está configurado');

    const supabase = createStorage();
    const supabaseState = supabase.storage as unknown as {
      provider: 'supabase';
      supabaseClient: {
        storage: { from: jest.Mock };
      };
    };
    supabaseState.provider = 'supabase';
    supabaseState.supabaseClient = {
      storage: {
        from: jest.fn().mockReturnValue({
          createSignedUrl: jest.fn().mockResolvedValue({
            data: null,
            error: new Error('signed url failed'),
          }),
        }),
      },
    };
    await expect(
      supabase.storage.resolveDownloadTarget(
        'storage://supabase/materials/file.pdf',
      ),
    ).rejects.toThrow('signed url failed');

    const noMinio = createStorage();
    const noMinioState = noMinio.storage as unknown as {
      provider: 'minio';
      minioClient: null;
    };
    noMinioState.provider = 'minio';
    noMinioState.minioClient = null;
    await expect(
      noMinio.storage.resolvePublicDownloadTarget(
        'storage://minio/courses/file.png',
      ),
    ).rejects.toThrow('MinIO no está configurado');

    const publicMinio = createStorage();
    const publicMinioState = publicMinio.storage as unknown as {
      provider: 'minio';
      minioClient: { send: jest.Mock };
    };
    publicMinioState.provider = 'minio';
    publicMinioState.minioClient = {
      send: jest.fn().mockResolvedValue({}),
    };
    await expect(
      publicMinio.storage.resolvePublicDownloadTarget(
        'storage://minio/courses/file.png',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    publicMinioState.minioClient.send.mockResolvedValue({
      Body: { on: jest.fn() },
      ContentType: 'image/png',
      ContentLength: 10,
    });
    await expect(
      publicMinio.storage.resolvePublicDownloadTarget(
        'storage://minio/courses/file.png',
      ),
    ).resolves.toMatchObject({ kind: 'stream', contentType: 'image/png' });

    const noPublicSupabase = createStorage();
    const noPublicSupabaseState = noPublicSupabase.storage as unknown as {
      provider: 'supabase';
      supabaseClient: null;
    };
    noPublicSupabaseState.provider = 'supabase';
    noPublicSupabaseState.supabaseClient = null;
    await expect(
      noPublicSupabase.storage.resolvePublicDownloadTarget(
        'storage://supabase/courses/file.png',
      ),
    ).rejects.toThrow('Supabase no está configurado');
    const publicSupabase = createStorage();
    const publicSupabaseState = publicSupabase.storage as unknown as {
      provider: 'supabase';
      supabaseClient: { storage: { from: jest.Mock } };
    };
    publicSupabaseState.provider = 'supabase';
    publicSupabaseState.supabaseClient = {
      storage: {
        from: jest.fn().mockReturnValue({
          createSignedUrl: jest.fn().mockResolvedValue({
            data: { signedUrl: 'https://public-signed.example' },
            error: null,
          }),
        }),
      },
    };
    await expect(
      publicSupabase.storage.resolvePublicDownloadTarget(
        'storage://supabase/courses/file.png',
      ),
    ).resolves.toEqual({
      kind: 'redirect',
      url: 'https://public-signed.example',
    });
    publicSupabaseState.supabaseClient.storage.from.mockReturnValue({
      createSignedUrl: jest.fn().mockResolvedValue({
        data: null,
        error: new Error('public signed url failed'),
      }),
    });
    await expect(
      publicSupabase.storage.resolvePublicDownloadTarget(
        'storage://supabase/courses/file.png',
      ),
    ).rejects.toThrow('public signed url failed');
  });

  it('uploads through Supabase and MinIO and enforces the bucket quota', async () => {
    const supabase = createStorage({
      STORAGE_PROVIDER: 'supabase',
      SUPABASE_URL: 'https://supabase.example',
      SUPABASE_SERVICE_ROLE_KEY: 'key',
    });
    const upload = jest.fn().mockResolvedValue({ error: null });
    (
      supabase.storage as unknown as { supabaseClient: unknown }
    ).supabaseClient = {
      storage: { from: jest.fn().mockReturnValue({ upload }) },
    };
    await expect(
      supabase.storage.uploadFile(
        file('material.pdf', Buffer.from('%PDF-1.7')),
        'materials',
      ),
    ).resolves.toMatch(/^storage:\/\/supabase\/materials\//);
    upload.mockResolvedValueOnce({ error: new Error('supabase down') });
    await expect(
      supabase.storage.uploadFile(
        file('material.pdf', Buffer.from('%PDF-1.7')),
        'materials',
      ),
    ).rejects.toThrow('supabase down');

    const minio = createStorage({
      STORAGE_PROVIDER: 'minio',
      MINIO_ENDPOINT: 'http://minio',
      MINIO_ACCESS_KEY: 'key',
      MINIO_SECRET_KEY: 'secret',
      STORAGE_BUCKET_QUOTA_BYTES: 20,
    });
    const send = jest
      .fn()
      .mockResolvedValueOnce({
        Contents: [{ Size: 3 }],
        IsTruncated: true,
        NextContinuationToken: 'next',
      })
      .mockResolvedValueOnce({ Contents: [{ Size: 4 }], IsTruncated: false })
      .mockResolvedValueOnce({});
    (
      minio.storage as unknown as { minioClient: { send: jest.Mock } }
    ).minioClient = { send };
    await expect(
      minio.storage.uploadFile(
        file('document.pdf', Buffer.from('%PDF-1.7')),
        'materials',
      ),
    ).resolves.toMatch(/^storage:\/\/minio\/materials\//);
    const quota = createStorage({
      STORAGE_PROVIDER: 'minio',
      MINIO_ENDPOINT: 'http://minio',
      MINIO_ACCESS_KEY: 'key',
      MINIO_SECRET_KEY: 'secret',
      STORAGE_BUCKET_QUOTA_BYTES: 5,
    });
    (
      quota.storage as unknown as { minioClient: { send: jest.Mock } }
    ).minioClient = {
      send: jest
        .fn()
        .mockResolvedValue({ Contents: [{ Size: 5 }], IsTruncated: false }),
    };
    await expect(
      quota.storage.uploadFile(
        file('document.pdf', Buffer.from('%PDF-1.7')),
        'materials',
      ),
    ).rejects.toThrow();
  });

  it('handles local path uploads, MinIO configuration errors and quota failures', async () => {
    expect(() =>
      createStorage({
        STORAGE_PROVIDER: 'minio',
        MINIO_ENDPOINT: undefined,
        MINIO_ACCESS_KEY: undefined,
        MINIO_SECRET_KEY: undefined,
      }),
    ).toThrow();
    const root = fs.mkdtempSync(path.join(process.cwd(), '.storage-path-'));
    const source = path.join(root, 'source.pdf');
    fs.writeFileSync(source, '%PDF-1.7');
    try {
      const { storage } = createStorage({ PRIVATE_STORAGE_DIR: root });
      await expect(
        storage.uploadFile(
          {
            originalname: 'source.pdf',
            buffer: undefined,
            path: source,
          } as never,
          'materials',
        ),
      ).resolves.toMatch(/^storage:\/\/local\/materials\//);
      expect(fs.existsSync(source)).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
    const quota = createStorage({
      STORAGE_PROVIDER: 'minio',
      MINIO_ENDPOINT: 'http://minio',
      MINIO_ACCESS_KEY: 'key',
      MINIO_SECRET_KEY: 'secret',
      STORAGE_BUCKET_QUOTA_BYTES: 10,
    });
    (
      quota.storage as unknown as { minioClient: { send: jest.Mock } }
    ).minioClient = {
      send: jest.fn().mockRejectedValue(new Error('list failed')),
    };
    await expect(
      quota.storage.uploadFile(
        file('document.pdf', Buffer.from('%PDF-1.7')),
        'materials',
      ),
    ).rejects.toThrow();
  });

  it('moves uploads between different filesystems without losing the source on failure', async () => {
    const root = fs.mkdtempSync(path.join(process.cwd(), '.storage-volumes-'));
    const source = path.join(root, 'voucher.pdf');
    fs.writeFileSync(source, '%PDF-1.7');
    const rename = jest.spyOn(
      jest.requireActual<typeof fs>('fs'),
      'renameSync',
    );
    rename.mockImplementation(() => {
      throw Object.assign(new Error('cross-device link'), { code: 'EXDEV' });
    });
    try {
      const { storage } = createStorage({
        PRIVATE_STORAGE_DIR: path.join(root, 'private'),
      });
      const reference = await storage.uploadFile(
        { originalname: 'voucher.pdf', path: source } as Express.Multer.File,
        'vouchers',
      );
      expect(reference).toMatch(/^storage:\/\/local\/vouchers\//);
      expect(
        fs.readFileSync(
          path.join(root, 'private', 'vouchers', reference.split('/').pop()!),
          'utf8',
        ),
      ).toBe('%PDF-1.7');
      expect(fs.existsSync(source)).toBe(false);

      fs.writeFileSync(source, '%PDF-1.7');
      rename.mockImplementation(() => {
        throw Object.assign(new Error('denied'), { code: 'EACCES' });
      });
      await expect(
        storage.uploadFile(
          { originalname: 'voucher.pdf', path: source } as Express.Multer.File,
          'vouchers',
        ),
      ).rejects.toThrow('denied');
      expect(fs.existsSync(source)).toBe(true);
    } finally {
      rename.mockRestore();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('handles antivirus OK, infection and connection errors', async () => {
    const socket: {
      setTimeout: jest.Mock;
      on: jest.Mock;
      write: jest.Mock;
      destroy: jest.Mock;
    } = {
      setTimeout: jest.fn(),
      on: jest.fn(),
      write: jest.fn(),
      destroy: jest.fn(),
    };
    (net.createConnection as unknown as jest.Mock).mockReturnValue(socket);
    socket.on.mockImplementation(
      (event: string, callback: (value?: unknown) => void) => {
        if (event === 'connect') callback();
        if (event === 'data')
          queueMicrotask(() => callback(Buffer.from('stream: OK')));
        return socket;
      },
    );
    const root = fs.mkdtempSync(path.join(process.cwd(), '.storage-clamav-'));
    try {
      const { storage } = createStorage({
        CLAMAV_HOST: '127.0.0.1',
        PRIVATE_STORAGE_DIR: root,
      });
      await expect(
        storage.uploadFile(
          file('document.pdf', Buffer.from('%PDF-1.7')),
          'materials',
        ),
      ).resolves.toMatch(/^storage:\/\/local\/materials\//);
      expect(socket.write).toHaveBeenCalledWith('zINSTREAM\0');

      socket.on.mockImplementation(
        (event: string, callback: (value?: unknown) => void) => {
          if (event === 'connect') callback();
          if (event === 'data')
            queueMicrotask(() => callback(Buffer.from('stream: FOUND')));
          return socket;
        },
      );
      await expect(
        storage.uploadFile(
          file('document.pdf', Buffer.from('%PDF-1.7')),
          'materials',
        ),
      ).rejects.toThrow();

      socket.on.mockImplementation(
        (event: string, callback: (value?: unknown) => void) => {
          if (event === 'connect') callback();
          if (event === 'data')
            queueMicrotask(() => callback(Buffer.from('stream: ERROR')));
          return socket;
        },
      );
      await expect(
        storage.uploadFile(
          file('document.pdf', Buffer.from('%PDF-1.7')),
          'materials',
        ),
      ).rejects.toThrow('El antivirus no pudo analizar el archivo');

      socket.on.mockImplementation(
        (event: string, callback: (value?: unknown) => void) => {
          if (event === 'connect') callback();
          if (event === 'data')
            queueMicrotask(() => callback(Buffer.from('UNKNOWN COMMAND\0')));
          if (event === 'close') queueMicrotask(() => callback());
          return socket;
        },
      );
      await expect(
        storage.uploadFile(
          file('document.pdf', Buffer.from('%PDF-1.7')),
          'materials',
        ),
      ).rejects.toThrow(
        'El antivirus cerró la conexión sin confirmar el análisis',
      );

      socket.on.mockImplementation(
        (event: string, callback: (value?: unknown) => void) => {
          if (event === 'error') callback(new Error('offline'));
          return socket;
        },
      );
      await expect(
        storage.uploadFile(
          file('document.pdf', Buffer.from('%PDF-1.7')),
          'materials',
        ),
      ).rejects.toThrow();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
      jest.restoreAllMocks();
    }
  });

  it('rejects required antivirus without configuration', async () => {
    const { storage } = createStorage({ CLAMAV_REQUIRED: 'true' });
    await expect(
      storage.uploadFile(file('document.pdf', Buffer.from('%PDF-1.7'))),
    ).rejects.toThrow();
  });

  it('handles antivirus timeouts and unreadable sources', async () => {
    const socket: {
      setTimeout: jest.Mock;
      on: jest.Mock;
      write: jest.Mock;
      destroy: jest.Mock;
    } = {
      setTimeout: jest.fn(),
      on: jest.fn().mockReturnValue(undefined),
      write: jest.fn(),
      destroy: jest.fn(),
    };
    (net.createConnection as unknown as jest.Mock).mockReturnValue(socket);
    socket.setTimeout.mockImplementation(
      (_milliseconds: number, callback: () => void) => callback(),
    );
    const { storage } = createStorage({ CLAMAV_HOST: '127.0.0.1' });
    const scan = (
      storage as unknown as {
        scanWithClamAv: (value: Express.Multer.File) => Promise<void>;
      }
    ).scanWithClamAv.bind(storage);
    await expect(
      scan(file('document.pdf', Buffer.from('%PDF-1.7'))),
    ).rejects.toThrow('El antivirus agotó el tiempo de espera');

    socket.setTimeout.mockImplementation(() => undefined);
    socket.on.mockImplementation((event: string, callback: () => void) => {
      if (event === 'connect') callback();
      return socket;
    });
    await expect(
      scan({ originalname: 'document.pdf' } as never),
    ).rejects.toThrow('El archivo no pudo ser leído');
    const root = fs.mkdtempSync(
      path.join(process.cwd(), '.storage-clamav-path-'),
    );
    const sourcePath = path.join(root, 'document.pdf');
    fs.writeFileSync(sourcePath, '%PDF-1.7');
    try {
      socket.on.mockImplementation(
        (event: string, callback: (value?: unknown) => void) => {
          if (event === 'connect') callback();
          if (event === 'data')
            queueMicrotask(() => callback(Buffer.from('stream: OK')));
          return socket;
        },
      );
      await expect(
        scan({ originalname: 'document.pdf', path: sourcePath } as never),
      ).resolves.toBeUndefined();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }

    const removableRoot = fs.mkdtempSync(
      path.join(process.cwd(), '.storage-remove-'),
    );
    const removable = path.join(removableRoot, 'temporary.pdf');
    fs.writeFileSync(removable, '%PDF-1.7');
    const removeTemporaryUpload = (
      storage as unknown as {
        removeTemporaryUpload: (value: Express.Multer.File) => void;
      }
    ).removeTemporaryUpload.bind(storage);
    removeTemporaryUpload({ path: removable } as never);
    expect(fs.existsSync(removable)).toBe(false);
    fs.rmSync(removableRoot, { recursive: true, force: true });
  });
});

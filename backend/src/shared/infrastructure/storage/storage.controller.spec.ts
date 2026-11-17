import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  LegacyUploadController,
  StorageController,
} from './storage.controller';

describe('StorageController', () => {
  const storage = {
    resolvePublicDownloadTarget: jest.fn(),
    assertReferenceAccess: jest.fn(),
    resolveDownloadTarget: jest.fn(),
    isPublicLegacyReference: jest.fn(),
  };
  const response = {
    setHeader: jest.fn(),
    redirect: jest.fn().mockReturnValue('redirected'),
    type: jest.fn(),
    sendFile: jest.fn().mockReturnValue('sent'),
  };
  let controller: StorageController;
  let legacy: LegacyUploadController;

  beforeEach(() => {
    jest.resetAllMocks();
    response.redirect.mockReturnValue('redirected');
    response.sendFile.mockReturnValue('sent');
    controller = new StorageController(storage as never);
    legacy = new LegacyUploadController(storage as never);
  });

  it('sirve assets públicos como redirect, stream o archivo local', async () => {
    await expect(
      controller.publicAsset(undefined as never, response as never),
    ).rejects.toBeInstanceOf(NotFoundException);

    storage.resolvePublicDownloadTarget.mockResolvedValue({
      kind: 'redirect',
      url: 'https://cdn.test/file.png',
    });
    await expect(
      controller.publicAsset(
        'storage://supabase/courses/file.png',
        response as never,
      ),
    ).resolves.toBe('redirected');
    expect(response.redirect).toHaveBeenCalledWith('https://cdn.test/file.png');

    const body = { pipe: jest.fn().mockReturnValue('streamed') };
    storage.resolvePublicDownloadTarget.mockResolvedValue({
      kind: 'stream',
      body,
      contentType: 'image/png',
      contentLength: 10,
    });
    await expect(
      controller.publicAsset(
        'storage://minio/courses/file.png',
        response as never,
      ),
    ).resolves.toBe('streamed');
    expect(response.type).toHaveBeenCalledWith('image/png');
    expect(body.pipe).toHaveBeenCalledWith(response);

    storage.resolvePublicDownloadTarget.mockResolvedValue({
      kind: 'local',
      filePath: 'C:\\files\\file.png',
    });
    await expect(
      controller.publicAsset(
        'storage://local/courses/file.png',
        response as never,
      ),
    ).resolves.toBe('sent');
    expect(response.sendFile).toHaveBeenCalledWith('C:\\files\\file.png');
  });

  it('descarga archivos protegidos y traduce errores de almacenamiento', async () => {
    await expect(
      controller.download(
        undefined as never,
        { id: 'user-1' },
        response as never,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    storage.resolveDownloadTarget.mockResolvedValue({
      kind: 'local',
      filePath: 'C:\\files\\private.pdf',
    });
    await expect(
      controller.download(
        'storage://local/materials/private.pdf',
        { id: 'user-1' },
        response as never,
      ),
    ).resolves.toBe('sent');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="archivo.pdf"',
    );

    storage.resolveDownloadTarget.mockRejectedValue(
      new Error('Archivo no encontrado'),
    );
    await expect(
      controller.download(
        'storage://local/materials/missing.pdf',
        { id: 'user-1' },
        response as never,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    storage.resolveDownloadTarget.mockRejectedValue(
      new Error('Referencia de almacenamiento inválida'),
    );
    await expect(
      controller.download('bad', { id: 'user-1' }, response as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    storage.resolveDownloadTarget.mockRejectedValue(new Error('unexpected'));
    await expect(
      controller.download('bad', { id: 'user-1' }, response as never),
    ).rejects.toThrow('No se pudo descargar');

    const body = { pipe: jest.fn().mockReturnValue('streamed-private') };
    storage.resolveDownloadTarget.mockResolvedValue({
      kind: 'stream',
      body,
    });
    await expect(
      controller.download(
        'storage://minio/materials/private.pdf',
        { id: 'user-1' },
        response as never,
      ),
    ).resolves.toBe('streamed-private');

    storage.resolveDownloadTarget.mockResolvedValue({
      kind: 'redirect',
      url: 'https://signed.test/private.pdf',
    });
    await expect(
      controller.download(
        'storage://supabase/materials/private.pdf',
        { id: 'user-1' },
        response as never,
      ),
    ).resolves.toBe('redirected');

    storage.resolveDownloadTarget.mockResolvedValue({
      kind: 'stream',
      body,
      contentType: 'application/pdf',
      contentLength: 42,
    });
    await controller.download(
      'storage://minio/materials/with-metadata.pdf',
      { id: 'user-1' },
      response as never,
    );
    expect(response.type).toHaveBeenCalledWith('application/pdf');
    expect(response.setHeader).toHaveBeenCalledWith('Content-Length', 42);

    storage.assertReferenceAccess.mockRejectedValue(
      new NotFoundException('Archivo no encontrado'),
    );
    await expect(
      controller.download(
        'storage://local/materials/missing.pdf',
        { id: 'user-1' },
        response as never,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('aplica autorización a referencias legacy públicas y privadas', async () => {
    storage.isPublicLegacyReference.mockResolvedValue(true);
    storage.resolveDownloadTarget.mockResolvedValue({
      kind: 'local',
      filePath: 'C:\\uploads\\avatar.png',
    });
    await expect(
      legacy.downloadLegacy(
        'avatar.png',
        { user: undefined } as never,
        response as never,
      ),
    ).resolves.toBe('sent');

    storage.isPublicLegacyReference.mockResolvedValue(false);
    await expect(
      legacy.downloadLegacy(
        'document.pdf',
        { user: undefined } as never,
        response as never,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    storage.assertReferenceAccess.mockResolvedValue(undefined);
    await expect(
      legacy.downloadLegacy(
        'document.pdf',
        { user: { id: 'user-1' } } as never,
        response as never,
      ),
    ).resolves.toBe('sent');
    expect(storage.assertReferenceAccess).toHaveBeenCalledWith(
      '/uploads/document.pdf',
      { id: 'user-1' },
    );

    storage.resolveDownloadTarget.mockRejectedValue(
      new Error('Archivo no encontrado'),
    );
    await expect(
      legacy.downloadLegacy(
        'missing.pdf',
        { user: { id: 'user-1' } } as never,
        response as never,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    storage.isPublicLegacyReference.mockResolvedValue(true);
    storage.resolveDownloadTarget.mockResolvedValue({
      kind: 'redirect',
      url: 'https://cdn.test/legacy.pdf',
    });
    await expect(
      legacy.downloadLegacy(
        'redirect.pdf',
        { user: undefined } as never,
        response as never,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    storage.resolveDownloadTarget.mockRejectedValue(new Error('invalid'));
    await expect(
      legacy.downloadLegacy(
        'invalid.pdf',
        { user: undefined } as never,
        response as never,
      ),
    ).rejects.toThrow('Referencia de archivo inválida');
  });
});

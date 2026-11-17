import { LocalStorageService } from './local-storage.service';

describe('LocalStorageService', () => {
  it('stores external URLs and buffers, and validates URL accessibility', async () => {
    const service = new LocalStorageService();
    await expect(
      service.upload('https://github.com/example/repo', 'deliverables', 'repo'),
    ).resolves.toEqual({
      url: 'https://github.com/example/repo',
      fileName: 'repo',
    });
    await expect(
      service.upload(Buffer.from('data'), 'deliverables', 'file.zip'),
    ).resolves.toMatchObject({
      url: expect.stringContaining(
        'https://storage.academia.edu/deliverables/',
      ) as jest.AsymmetricMatcher,
      fileName: 'file.zip',
      size: 4,
    });
    await expect(service.isAccessible('https://example.com')).resolves.toBe(
      true,
    );
    await expect(service.isAccessible('not-a-url')).resolves.toBe(false);
  });
});

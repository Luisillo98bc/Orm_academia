import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

describe('service worker privacy boundaries', () => {
  function setup() {
    const handlers = new Map<string, (event: unknown) => void>();
    const caches = {
      match: jest.fn().mockResolvedValue('offline-page'),
      keys: jest
        .fn()
        .mockResolvedValue(['academia-static-v4', 'another-app-cache']),
      delete: jest.fn().mockResolvedValue(true),
    };
    const fetch = jest.fn().mockRejectedValue(new Error('offline'));
    const self = {
      location: { origin: 'https://academy.local' },
      addEventListener: (event: string, handler: (event: unknown) => void) =>
        handlers.set(event, handler),
      clients: { claim: jest.fn() },
    };
    const source = readFileSync(
      resolve(__dirname, '../../../../../frontend/public/sw.js'),
      'utf8',
    );
    runInNewContext(source, { self, caches, fetch, URL });
    return { handlers, caches };
  }

  it.each([
    '/api/v1/storage/download?ref=private-image',
    '/_next/data/private.json',
    '/private-image.png',
  ])('does not cache or intercept %s', (path) => {
    const { handlers, caches } = setup();
    const respondWith = jest.fn();
    handlers.get('fetch')!({
      request: {
        method: 'GET',
        url: `https://academy.local${path}`,
        destination: 'image',
      },
      respondWith,
    });
    expect(respondWith).not.toHaveBeenCalled();
    expect(caches.match).not.toHaveBeenCalled();
  });

  it('falls back to the public offline page instead of a cached private page', async () => {
    const { handlers, caches } = setup();
    let response: unknown;
    handlers.get('fetch')!({
      request: {
        method: 'GET',
        mode: 'navigate',
        url: 'https://academy.local/dashboard',
      },
      respondWith: (value: unknown) => {
        response = value;
      },
    });
    await expect(response).resolves.toBe('offline-page');
    expect(caches.match).toHaveBeenCalledWith('/offline');
    expect(caches.match).toHaveBeenCalledTimes(1);
  });

  it('cleans only old academy caches', async () => {
    const { handlers, caches } = setup();
    let completion: unknown;
    handlers.get('activate')!({
      waitUntil: (value: unknown) => {
        completion = value;
      },
    });
    await completion;
    expect(caches.delete).toHaveBeenCalledWith('academia-static-v4');
    expect(caches.delete).not.toHaveBeenCalledWith('another-app-cache');
  });
});

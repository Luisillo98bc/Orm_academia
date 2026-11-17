import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { transpileModule, ModuleKind } from 'typescript';
import { randomUUID } from 'node:crypto';

describe('browser session renewal', () => {
  function setup() {
    const storage = new Map<string, string>();
    let queue = Promise.resolve<unknown>(undefined);
    const locks = {
      request: (_name: string, callback: () => unknown) => {
        const result = queue.then(callback);
        queue = result.catch(() => undefined);
        return result;
      },
    };
    const fetch = jest.fn();
    const createTab = () => {
      const exports = {} as {
        fetchApiResponse: (endpoint: string) => Promise<Response>;
        getTabAccessToken: () => string | null;
      };
      const tabStorage = new Map<string, string>();
      const source = readFileSync(
        resolve(__dirname, '../../../../../frontend/src/lib/api.ts'),
        'utf8',
      );
      const { outputText } = transpileModule(source, {
        compilerOptions: { module: ModuleKind.CommonJS },
      });
      runInNewContext(outputText, {
        exports,
        process: { env: {} },
        fetch,
        Headers,
        FormData,
        crypto: { randomUUID },
        navigator: { locks },
        window: {
          location: { hostname: 'localhost' },
          dispatchEvent: jest.fn(),
          sessionStorage: {
            getItem: (key: string) => tabStorage.get(key) ?? null,
            setItem: (key: string, value: string) => tabStorage.set(key, value),
            removeItem: (key: string) => tabStorage.delete(key),
          },
          localStorage: {
            getItem: (key: string) => storage.get(key) ?? null,
            setItem: (key: string, value: string) => storage.set(key, value),
          },
        },
      });
      return exports;
    };
    return { fetch, createTab };
  }

  it('renews isolated tab sessions independently without sharing their tokens', async () => {
    const { fetch, createTab } = setup();
    const first = createTab();
    const second = createTab();
    let protectedRequests = 0;
    let refreshed = 0;
    fetch.mockImplementation((url: string) =>
      Promise.resolve(
        new Response('{}', {
          headers: url.endsWith('/auth/refresh')
            ? {
                'x-tab-access-token': `access-${++refreshed}`,
                'x-tab-refresh-token': `refresh-${refreshed}`,
              }
            : {},
          status:
            url.endsWith('/auth/refresh') || ++protectedRequests > 2
              ? 200
              : 401,
        }),
      ),
    );
    await Promise.all([
      first.fetchApiResponse('/users/me'),
      second.fetchApiResponse('/users/me'),
    ]);
    expect(
      fetch.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh')),
    ).toHaveLength(2);
    expect(
      new Set([first.getTabAccessToken(), second.getTabAccessToken()]),
    ).toEqual(new Set(['access-1', 'access-2']));
  });

  it('renews only once for simultaneous requests in the same tab', async () => {
    const { fetch, createTab } = setup();
    const tab = createTab();
    let protectedRequests = 0;
    fetch.mockImplementation((url: string) =>
      Promise.resolve(
        new Response('{}', {
          status:
            url.endsWith('/auth/refresh') || ++protectedRequests > 2
              ? 200
              : 401,
        }),
      ),
    );
    await Promise.all([
      tab.fetchApiResponse('/users/me'),
      tab.fetchApiResponse('/auth/sessions'),
    ]);
    expect(
      fetch.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh')),
    ).toHaveLength(1);
  });

  it('also renews protected auth routes such as session management', async () => {
    const { fetch, createTab } = setup();
    fetch
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response('[]', { status: 200 }));
    expect((await createTab().fetchApiResponse('/auth/sessions')).status).toBe(
      200,
    );
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('does not retry invalid login credentials via the refresh endpoint', async () => {
    const { fetch, createTab } = setup();
    fetch.mockResolvedValue(
      new Response('{"message":"Invalid credentials"}', { status: 401 }),
    );
    await expect(createTab().fetchApiResponse('/auth/login')).rejects.toThrow(
      'Invalid credentials',
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

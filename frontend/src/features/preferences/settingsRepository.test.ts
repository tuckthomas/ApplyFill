import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadSetting,
  resetSettingsRepositoryForTests,
  saveSetting,
} from './settingsRepository';

afterEach(() => {
  resetSettingsRepositoryForTests();
  vi.unstubAllGlobals();
});

describe('settingsRepository', () => {
  it('treats an absent setting as a first-use default', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response(null, { status: 404 })));

    await expect(loadSetting('dashboard')).resolves.toBeNull();
  });

  it('uses the loaded concurrency token when saving', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      if ((init?.method ?? 'GET') === 'GET') {
        return jsonResponse({
          concurrencyToken: 'setting-version-1',
          content: { value: 'MM/DD/YYYY' },
          key: 'date-format',
          schemaVersion: 1,
          updatedAt: '2026-07-22T12:00:00Z',
        });
      }
      return jsonResponse({
        concurrencyToken: 'setting-version-2',
        content: { value: 'DD/MM/YYYY' },
        key: 'date-format',
        schemaVersion: 1,
        updatedAt: '2026-07-22T12:01:00Z',
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await loadSetting('date-format');
    await saveSetting('date-format', 1, { value: 'DD/MM/YYYY' });

    const [, saveInit] = fetchMock.mock.calls[1];
    expect(new Headers(saveInit?.headers).get('If-Match')).toBe('"setting-version-1"');
    expect(JSON.parse(String(saveInit?.body))).toEqual({
      content: { value: 'DD/MM/YYYY' },
      schemaVersion: 1,
    });
  });

  it('serializes rapid saves so each request uses the newest token', async () => {
    let finishFirstSave: ((response: Response) => void) | undefined;
    const firstSave = new Promise<Response>((resolve) => {
      finishFirstSave = resolve;
    });
    const fetchMock = vi.fn<typeof fetch>(async () => {
      if (fetchMock.mock.calls.length === 1) return firstSave;
      return jsonResponse({
        concurrencyToken: 'setting-version-2',
        content: { value: 2 },
        key: 'dashboard',
        schemaVersion: 1,
        updatedAt: '2026-07-22T12:01:00Z',
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = saveSetting('dashboard', 1, { value: 1 });
    const second = saveSetting('dashboard', 1, { value: 2 });
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    finishFirstSave?.(jsonResponse({
      concurrencyToken: 'setting-version-1',
      content: { value: 1 },
      key: 'dashboard',
      schemaVersion: 1,
      updatedAt: '2026-07-22T12:00:00Z',
    }));
    await first;
    await second;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, secondInit] = fetchMock.mock.calls[1];
    expect(new Headers(secondInit?.headers).get('If-Match')).toBe('"setting-version-1"');
  });
});

const jsonResponse = (value: unknown) => new Response(JSON.stringify(value), {
  headers: { 'Content-Type': 'application/json' },
  status: 200,
});

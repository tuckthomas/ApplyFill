import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDateFormatPreference } from './dateFormatPreference';
import { DateFormatPreferenceProvider } from './DateFormatProvider';
import { resetSettingsRepositoryForTests } from './settingsRepository';

afterEach(() => {
  resetSettingsRepositoryForTests();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('DateFormatPreferenceProvider', () => {
  it('loads and saves the date choice through the local settings API', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      const isSave = init?.method === 'PUT';
      return jsonResponse({
        concurrencyToken: isSave ? 'date-version-2' : 'date-version-1',
        content: { value: isSave ? 'MM/DD/YYYY' : 'DD/MM/YYYY' },
        key: 'date-format',
        schemaVersion: 1,
        updatedAt: '2026-07-22T12:00:00Z',
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DateFormatPreferenceProvider>
          <DatePreferenceTestView />
        </DateFormatPreferenceProvider>,
      );
    });

    expect(container.querySelector('[data-testid="date-format"]')?.textContent).toBe('DD/MM/YYYY');

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button')?.click();
    });

    const [, saveInit] = fetchMock.mock.calls[1];
    expect(JSON.parse(String(saveInit?.body))).toEqual({
      content: { value: 'MM/DD/YYYY' },
      schemaVersion: 1,
    });
    expect(new Headers(saveInit?.headers).get('If-Match')).toBe('"date-version-1"');

    await act(async () => root.unmount());
  });
});

function DatePreferenceTestView() {
  const { dateFormat, setDateFormat } = useDateFormatPreference();
  return (
    <div>
      <span data-testid="date-format">{dateFormat}</span>
      <button onClick={() => setDateFormat('MM/DD/YYYY')} type="button">Use month first</button>
    </div>
  );
}

const jsonResponse = (value: unknown) => new Response(JSON.stringify(value), {
  headers: { 'Content-Type': 'application/json' },
  status: 200,
});

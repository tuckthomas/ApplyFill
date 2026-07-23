import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, apiRequest } from './localApiClient';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('localApiClient availability errors', () => {
  it('turns a connection failure into ordinary recovery guidance', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => {
      throw new TypeError('Failed to fetch');
    }));

    const request = apiRequest('/api/v1/profiles/current');

    await expect(request).rejects.toMatchObject({
      message: 'ApplyFill could not reach its local service. Keep ApplyFill open, then try again.',
      status: 0,
    } satisfies Partial<ApiClientError>);
  });

  it('preserves cancellation instead of reporting the service as unavailable', async () => {
    const cancellation = new DOMException('The operation was aborted.', 'AbortError');
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => {
      throw cancellation;
    }));

    await expect(apiRequest('/api/v1/resumes', { signal: AbortSignal.abort() })).rejects.toBe(cancellation);
  });
});

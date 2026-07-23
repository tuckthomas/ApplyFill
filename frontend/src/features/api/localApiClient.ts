type ProblemDetails = {
  detail?: string;
  title?: string;
};

type ApiRequestOptions = {
  concurrencyToken?: string;
  idempotencyKey?: string;
  sensitiveAction?: 'reveal';
};

export class ApiClientError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
  }
}

export type ApiResponse<Result> = {
  etag: string | null;
  value: Result;
};

const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? '';

export const apiUrl = (path: string) => {
  const base = configuredBaseUrl || window.location.origin;
  const url = new URL(path, base);
  if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname.toLowerCase())) {
    throw new Error('ApplyFill blocked an unsafe local service address.');
  }
  return url;
};

const errorFromResponse = async (response: Response) => {
  let problem: ProblemDetails | undefined;
  try {
    problem = await response.json() as ProblemDetails;
  } catch {
    // Do not expose non-JSON local service responses.
  }
  if (response.status === 409 || response.status === 412) {
    return new ApiClientError('This record changed after you opened it. Reload the latest version before saving.', response.status);
  }
  return new ApiClientError(problem?.detail || problem?.title || 'ApplyFill could not complete that request. Try again.', response.status);
};

export const apiRequest = async <Result>(
  path: string,
  init: RequestInit = {},
  options: ApiRequestOptions = {},
): Promise<ApiResponse<Result>> => {
  const method = (init.method ?? 'GET').toUpperCase();
  const isCommand = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  const hasJsonBody = Boolean(init.body) && !(init.body instanceof FormData);
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
        ...(isCommand ? {
          'Idempotency-Key': options.idempotencyKey ?? globalThis.crypto.randomUUID(),
          'X-ApplyFill-Request': '1',
        } : {}),
        ...(options.concurrencyToken ? { 'If-Match': `"${options.concurrencyToken}"` } : {}),
        ...(options.sensitiveAction ? { 'X-ApplyFill-Sensitive-Action': options.sensitiveAction } : {}),
        ...init.headers,
      },
      redirect: 'error',
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiClientError('ApplyFill could not reach its local service. Keep ApplyFill open, then try again.', 0);
  }
  if (!response.ok) throw await errorFromResponse(response);
  return {
    etag: response.headers.get('ETag')?.replaceAll('"', '') ?? null,
    value: response.status === 204 ? undefined as Result : await response.json() as Result,
  };
};

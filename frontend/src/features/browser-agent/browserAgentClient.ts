import {
  HubConnectionBuilder,
  HttpTransportType,
  LogLevel,
  type HubConnection,
} from '@microsoft/signalr';
import type {
  BrowserAgentClient,
  BrowserAgentQuestionAnswer,
  BrowserAgentStreamEvent,
  BrowserInput,
  BrowserRunCommand,
  BrowserRunSnapshot,
  BrowserRunSummary,
  PrivateAiStatus,
  StartBrowserRunRequest,
} from './contracts';

const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? '';

const getBaseUrl = () => {
  if (!configuredBaseUrl) return window.location.origin;
  const configured = new URL(configuredBaseUrl, window.location.origin);
  if (configured.origin !== window.location.origin) {
    throw new Error('ApplyFill blocked an unsafe service address.');
  }
  return configured.origin;
};

type ProblemDetails = {
  detail?: string;
  title?: string;
};

const friendlyRequestError = async (response: Response) => {
  let problem: ProblemDetails | undefined;
  try {
    problem = await response.json() as ProblemDetails;
  } catch {
    // Empty and non-JSON error bodies are deliberately not exposed to the UI.
  }
  return new Error(problem?.detail || problem?.title || 'ApplyFill could not complete that request. Try again.');
};

class HttpBrowserAgentClient implements BrowserAgentClient {
  private readonly baseUrl = getBaseUrl();
  private readonly antiForgeryToken = document.querySelector<HTMLMetaElement>('meta[name="request-verification-token"]')?.content;

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(new URL(path, this.baseUrl), {
      ...init,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(this.antiForgeryToken ? { 'X-Request-Verification-Token': this.antiForgeryToken } : {}),
        ...init.headers,
      },
      redirect: 'error',
    });
    if (!response.ok) throw await friendlyRequestError(response);
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  getPrivateAiStatus(signal?: AbortSignal) {
    return this.request<PrivateAiStatus>('/api/private-ai/status', { signal });
  }

  setupPrivateAi(signal?: AbortSignal) {
    return this.request<PrivateAiStatus>('/api/private-ai/setup', { method: 'POST', signal });
  }

  listRuns(signal?: AbortSignal) {
    return this.request<BrowserRunSummary[]>('/api/browser-agent/runs', { signal });
  }

  getRun(runId: string, signal?: AbortSignal) {
    return this.request<BrowserRunSnapshot>(`/api/browser-agent/runs/${encodeURIComponent(runId)}`, { signal });
  }

  startRun(request: StartBrowserRunRequest, signal?: AbortSignal) {
    return this.request<BrowserRunSnapshot>('/api/browser-agent/runs', {
      body: JSON.stringify(request),
      method: 'POST',
      signal,
    });
  }

  command(runId: string, command: BrowserRunCommand, revision: number, signal?: AbortSignal) {
    return this.request<BrowserRunSnapshot>(`/api/browser-agent/runs/${encodeURIComponent(runId)}/commands`, {
      body: JSON.stringify({ command, expectedRevision: revision }),
      method: 'POST',
      signal,
    });
  }

  answerQuestion(runId: string, questionId: string, answer: BrowserAgentQuestionAnswer, revision: number, signal?: AbortSignal) {
    return this.request<BrowserRunSnapshot>(`/api/browser-agent/runs/${encodeURIComponent(runId)}/questions/${encodeURIComponent(questionId)}/answer`, {
      body: JSON.stringify({ ...answer, expectedRevision: revision }),
      method: 'POST',
      signal,
    });
  }

  sendInput(runId: string, input: BrowserInput) {
    return this.request<void>(`/api/browser-agent/runs/${encodeURIComponent(runId)}/input`, {
      body: JSON.stringify(input),
      method: 'POST',
    });
  }

  deleteRun(runId: string, signal?: AbortSignal) {
    return this.request<void>(`/api/browser-agent/runs/${encodeURIComponent(runId)}`, { method: 'DELETE', signal });
  }

  async connect(runId: string, listener: (event: BrowserAgentStreamEvent) => void) {
    const connection = new HubConnectionBuilder()
      .withUrl(new URL('/hubs/browser-agent', this.baseUrl).toString(), {
        skipNegotiation: false,
        transport: HttpTransportType.WebSockets | HttpTransportType.ServerSentEvents | HttpTransportType.LongPolling,
        withCredentials: true,
      })
      .configureLogging(LogLevel.None)
      .withAutomaticReconnect([0, 1_000, 3_000, 10_000])
      .build();

    const emitConnection = (state: 'connecting' | 'connected' | 'reconnecting' | 'disconnected') => {
      listener({ type: 'connection', state });
    };
    connection.on('RunUpdated', (snapshot: BrowserRunSnapshot) => listener({ type: 'snapshot', snapshot }));
    connection.on('FrameAvailable', (frame: Omit<Extract<BrowserAgentStreamEvent, { type: 'frame' }>, 'type'>) => {
      listener({ type: 'frame', ...frame });
    });
    connection.onreconnecting(() => emitConnection('reconnecting'));
    connection.onreconnected(() => emitConnection('connected'));
    connection.onclose(() => emitConnection('disconnected'));

    emitConnection('connecting');
    await connection.start();
    await connection.invoke('WatchRun', runId);
    emitConnection('connected');

    return async () => {
      await safelyStop(connection, runId);
    };
  }
}

const safelyStop = async (connection: HubConnection, runId: string) => {
  try {
    await connection.invoke('LeaveRun', runId);
  } catch {
    // The connection may already be gone; local teardown still needs to continue.
  }
  await connection.stop();
};

export const browserAgentClient: BrowserAgentClient = new HttpBrowserAgentClient();

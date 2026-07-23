import {
  HubConnectionBuilder,
  HttpTransportType,
  LogLevel,
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
import { apiRequest } from '../api/localApiClient';

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

type BrowserFrameEvent = Extract<BrowserAgentStreamEvent, { type: 'frame' }>;
type BrowserFramePayload = Omit<BrowserFrameEvent, 'type'>;

interface BrowserHubConnection {
  invoke<T = unknown>(methodName: string, ...args: unknown[]): Promise<T>;
  on(methodName: string, handler: (...args: never[]) => void): void;
  onclose(handler: (error?: Error) => void | Promise<void>): void;
  onreconnected(handler: (connectionId?: string) => void | Promise<void>): void;
  onreconnecting(handler: (error?: Error) => void | Promise<void>): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}

type BrowserHubConnectionFactory = (baseUrl: string) => BrowserHubConnection;

const createBrowserHubConnection: BrowserHubConnectionFactory = (baseUrl) => new HubConnectionBuilder()
  .withUrl(new URL('/hubs/browser-agent', baseUrl).toString(), {
    skipNegotiation: false,
    transport: HttpTransportType.WebSockets | HttpTransportType.ServerSentEvents | HttpTransportType.LongPolling,
    withCredentials: true,
  })
  .configureLogging(LogLevel.None)
  .withAutomaticReconnect([0, 1_000, 3_000, 10_000])
  .build();

export class BrowserAgentStreamGate {
  private framePageGeneration = -1;
  private frameSequence = -1;
  private readonly runId: string;
  private snapshotRevision = -1;

  constructor(runId: string) {
    this.runId = runId;
  }

  acceptSnapshot(snapshot: BrowserRunSnapshot) {
    if (snapshot.id !== this.runId || snapshot.revision <= this.snapshotRevision) {
      return { accepted: false, gap: false };
    }
    const gap = this.snapshotRevision >= 0 && snapshot.revision > this.snapshotRevision + 1;
    this.snapshotRevision = snapshot.revision;
    return { accepted: true, gap };
  }

  acceptFrame(frame: BrowserFramePayload) {
    if (frame.runId !== this.runId || frame.pageGeneration < this.framePageGeneration) {
      return { accepted: false, gap: false };
    }
    if (frame.pageGeneration === this.framePageGeneration && frame.sequence <= this.frameSequence) {
      return { accepted: false, gap: false };
    }
    const gap = this.frameSequence >= 0 && frame.sequence > this.frameSequence + 1;
    this.framePageGeneration = frame.pageGeneration;
    this.frameSequence = frame.sequence;
    return { accepted: true, gap };
  }
}

export class BrowserAgentClientError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'BrowserAgentClientError';
    this.status = status;
  }
}

const friendlyRequestError = async (response: Response) => {
  let problem: ProblemDetails | undefined;
  try {
    problem = await response.json() as ProblemDetails;
  } catch {
    // Empty and non-JSON error bodies are deliberately not exposed to the UI.
  }
  return new BrowserAgentClientError(
    problem?.detail || problem?.title || 'ApplyFill could not complete that request. Try again.',
    response.status,
  );
};

export class HttpBrowserAgentClient implements BrowserAgentClient {
  private readonly baseUrl = getBaseUrl();
  private readonly antiForgeryToken = document.querySelector<HTMLMetaElement>('meta[name="request-verification-token"]')?.content;
  private readonly connectionFactory: BrowserHubConnectionFactory;

  constructor(connectionFactory: BrowserHubConnectionFactory = createBrowserHubConnection) {
    this.connectionFactory = connectionFactory;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const method = (init.method ?? 'GET').toUpperCase();
    const isCommand = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    let response: Response;
    try {
      response = await fetch(new URL(path, this.baseUrl), {
        ...init,
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...(this.antiForgeryToken ? { 'X-Request-Verification-Token': this.antiForgeryToken } : {}),
          ...(isCommand ? {
            'Idempotency-Key': globalThis.crypto.randomUUID(),
            'X-ApplyFill-Request': '1',
          } : {}),
          ...init.headers,
        },
        redirect: 'error',
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new BrowserAgentClientError('ApplyFill could not reach the application window. Keep ApplyFill open, then try again.', 0);
    }
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

  recoverRun(runId: string, signal?: AbortSignal) {
    return this.request<BrowserRunSnapshot>(`/api/browser-agent/runs/${encodeURIComponent(runId)}/recover`, {
      method: 'POST',
      signal,
    });
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

  async decideSensitiveApproval(
    runId: string,
    approvalId: string,
    approved: boolean,
    concurrencyToken: string,
    signal?: AbortSignal,
  ) {
    await apiRequest(
      `/api/v1/application-runs/${encodeURIComponent(runId)}/sensitive-approvals/${encodeURIComponent(approvalId)}/decision`,
      {
        body: JSON.stringify({ approved }),
        method: 'POST',
        signal,
      },
      {
        concurrencyToken,
        idempotencyKey: `sensitive-approval:${runId}:${approvalId}:${approved ? 'approve' : 'deny'}`,
      },
    );
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
    const connection = this.connectionFactory(this.baseUrl);
    const gate = new BrowserAgentStreamGate(runId);
    let disposed = false;
    let resync: Promise<void> | null = null;

    const emitConnection = (state: 'connecting' | 'connected' | 'reconnecting' | 'disconnected') => {
      if (!disposed) listener({ type: 'connection', state });
    };
    const emitSnapshot = (snapshot: BrowserRunSnapshot) => {
      const decision = gate.acceptSnapshot(snapshot);
      if (!decision.accepted || disposed) return;
      listener({ type: 'snapshot', snapshot });
      if (decision.gap) scheduleResync();
    };
    const scheduleResync = () => {
      if (disposed || resync) return;
      resync = this.getRun(runId)
        .then(emitSnapshot)
        .catch(() => undefined)
        .finally(() => { resync = null; });
    };
    const watchRun = async () => {
      await connection.invoke('WatchRun', runId);
    };

    connection.on('RunUpdated', (snapshot: BrowserRunSnapshot) => emitSnapshot(snapshot));
    connection.on('FrameAvailable', (frame: BrowserFramePayload) => {
      const decision = gate.acceptFrame(frame);
      if (!decision.accepted || disposed) return;
      listener({ type: 'frame', ...frame });
      if (decision.gap) scheduleResync();
    });
    connection.onreconnecting(() => emitConnection('reconnecting'));
    connection.onreconnected(async () => {
      if (disposed) return;
      try {
        await watchRun();
        scheduleResync();
        emitConnection('connected');
      } catch {
        emitConnection('disconnected');
        await connection.stop();
      }
    });
    connection.onclose(() => emitConnection('disconnected'));

    emitConnection('connecting');
    try {
      await connection.start();
      await watchRun();
      emitConnection('connected');
    } catch (error) {
      emitConnection('disconnected');
      await connection.stop().catch(() => undefined);
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new BrowserAgentClientError('ApplyFill could not connect to the application window. Try again.', 0);
    }

    return async () => {
      disposed = true;
      await safelyStop(connection, runId);
    };
  }
}

const safelyStop = async (connection: BrowserHubConnection, runId: string) => {
  try {
    await connection.invoke('LeaveRun', runId);
  } catch {
    // The connection may already be gone; local teardown still needs to continue.
  }
  await connection.stop();
};

export const browserAgentClient: BrowserAgentClient = new HttpBrowserAgentClient();

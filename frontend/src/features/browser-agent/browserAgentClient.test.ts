import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BrowserAgentStreamEvent, BrowserRunSnapshot } from './contracts';
import {
  BrowserAgentStreamGate,
  HttpBrowserAgentClient,
  browserAgentClient,
} from './browserAgentClient';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('browserAgentClient', () => {
  it('sends a stable protected command when deciding a sensitive approval', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response('{}', {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    }));
    vi.stubGlobal('fetch', fetchMock);

    await browserAgentClient.decideSensitiveApproval('run-1', 'approval-1', true, 'version-1');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(String(url)).toContain('/api/v1/application-runs/run-1/sensitive-approvals/approval-1/decision');
    expect(init?.body).toBe('{"approved":true}');
    expect(init?.method).toBe('POST');
    expect(headers.get('If-Match')).toBe('"version-1"');
    expect(headers.get('X-ApplyFill-Request')).toBe('1');
    expect(headers.get('Idempotency-Key')).toBe('sensitive-approval:run-1:approval-1:approve');
  });

  it('recovers a run only through an explicit protected POST', async () => {
    const snapshot = { id: 'run-1' };
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(snapshot), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    }));
    vi.stubGlobal('fetch', fetchMock);

    await browserAgentClient.recoverRun('run-1');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(String(url)).toContain('/api/browser-agent/runs/run-1/recover');
    expect(init?.method).toBe('POST');
    expect(headers.get('X-ApplyFill-Request')).toBe('1');
    expect(headers.get('Idempotency-Key')).toBeTruthy();
  });

  it('sends the acknowledged frame identity with browser-pixel input', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await browserAgentClient.sendInput('run-1', {
      button: 0,
      event: 'down',
      frameSequence: 24,
      kind: 'pointer',
      pageGeneration: 6,
      x: 640,
      y: 360,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/browser-agent/runs/run-1/input');
    expect(init?.body).toBe('{"button":0,"event":"down","frameSequence":24,"kind":"pointer","pageGeneration":6,"x":640,"y":360}');
  });

  it('turns an unavailable application window into retry guidance', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => {
      throw new TypeError('Failed to fetch');
    }));

    await expect(browserAgentClient.getRun('run-1')).rejects.toMatchObject({
      message: 'ApplyFill could not reach the application window. Keep ApplyFill open, then try again.',
      status: 0,
    });
  });

  it('rejects stale snapshots and frames while detecting sequence gaps', () => {
    const gate = new BrowserAgentStreamGate('run-1');

    expect(gate.acceptSnapshot(snapshot(4))).toEqual({ accepted: true, gap: false });
    expect(gate.acceptSnapshot(snapshot(3))).toEqual({ accepted: false, gap: false });
    expect(gate.acceptSnapshot(snapshot(6))).toEqual({ accepted: true, gap: true });
    expect(gate.acceptFrame(frame(10, 2))).toEqual({ accepted: true, gap: false });
    expect(gate.acceptFrame(frame(9, 2))).toEqual({ accepted: false, gap: false });
    expect(gate.acceptFrame(frame(11, 1))).toEqual({ accepted: false, gap: false });
    expect(gate.acceptFrame(frame(12, 2))).toEqual({ accepted: true, gap: true });
  });

  it('resubscribes and refreshes authoritative state after reconnect', async () => {
    const connection = new FakeHubConnection();
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(snapshot(8)), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new HttpBrowserAgentClient(() => connection);
    const events: BrowserAgentStreamEvent[] = [];

    const disconnect = await client.connect('run-1', (event) => events.push(event));
    expect(connection.invocations).toEqual([['WatchRun', 'run-1']]);
    await connection.reconnect();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    expect(connection.invocations).toEqual([
      ['WatchRun', 'run-1'],
      ['WatchRun', 'run-1'],
    ]);
    expect(events).toContainEqual({ state: 'reconnecting', type: 'connection' });
    expect(events).toContainEqual({ state: 'connected', type: 'connection' });
    await vi.waitFor(() => expect(events.some((event) => event.type === 'snapshot' && event.snapshot.revision === 8)).toBe(true));
    await disconnect();
    expect(connection.invocations.at(-1)).toEqual(['LeaveRun', 'run-1']);
  });

  it('keeps the newest complete events and resyncs after a frame gap', async () => {
    const connection = new FakeHubConnection();
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(snapshot(7)), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new HttpBrowserAgentClient(() => connection);
    const events: BrowserAgentStreamEvent[] = [];
    const disconnect = await client.connect('run-1', (event) => events.push(event));

    connection.emit('RunUpdated', snapshot(5));
    connection.emit('RunUpdated', snapshot(4));
    connection.emit('FrameAvailable', frame(20, 3));
    connection.emit('FrameAvailable', frame(19, 3));
    connection.emit('FrameAvailable', frame(22, 3));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(events.filter((event) => event.type === 'snapshot')).toHaveLength(2));

    expect(events.filter((event) => event.type === 'snapshot').map((event) => event.snapshot.revision)).toEqual([5, 7]);
    expect(events.filter((event) => event.type === 'frame').map((event) => event.sequence)).toEqual([20, 22]);
    await disconnect();
  });
});

const snapshot = (revision: number): BrowserRunSnapshot => ({
  activity: [],
  applicationStage: 'Application',
  canResume: true,
  checkpointRetained: true,
  controlOwner: 'agent',
  currentDomain: 'jobs.example.test',
  currentUrl: 'https://jobs.example.test/apply',
  id: 'run-1',
  revision,
  state: 'agent-running',
  statusMessage: 'ApplyFill is working.',
  updatedAt: `2026-07-22T12:00:${String(revision).padStart(2, '0')}Z`,
});

const frame = (sequence: number, pageGeneration: number) => ({
  deviceScaleFactor: 1,
  frameUpdatedAt: `2026-07-22T12:01:${String(sequence).padStart(2, '0')}Z`,
  frameUrl: `/api/browser-agent/runs/run-1/frame/latest?sequence=${sequence}`,
  height: 720,
  pageGeneration,
  runId: 'run-1',
  sequence,
  width: 1280,
});

class FakeHubConnection {
  readonly invocations: unknown[][] = [];
  private readonly handlers = new Map<string, (...args: never[]) => void>();
  private closeHandler?: (error?: Error) => void | Promise<void>;
  private reconnectedHandler?: (connectionId?: string) => void | Promise<void>;
  private reconnectingHandler?: (error?: Error) => void | Promise<void>;

  async invoke<T = unknown>(methodName: string, ...args: unknown[]): Promise<T> {
    this.invocations.push([methodName, ...args]);
    return undefined as T;
  }

  on(methodName: string, handler: (...args: never[]) => void) {
    this.handlers.set(methodName, handler);
  }

  onclose(handler: (error?: Error) => void | Promise<void>) {
    this.closeHandler = handler;
  }

  onreconnected(handler: (connectionId?: string) => void | Promise<void>) {
    this.reconnectedHandler = handler;
  }

  onreconnecting(handler: (error?: Error) => void | Promise<void>) {
    this.reconnectingHandler = handler;
  }

  async start() { return undefined; }

  async stop() {
    await this.closeHandler?.();
  }

  emit(methodName: string, value: unknown) {
    this.handlers.get(methodName)?.(value as never);
  }

  async reconnect() {
    await this.reconnectingHandler?.();
    await this.reconnectedHandler?.('connection-2');
  }
}

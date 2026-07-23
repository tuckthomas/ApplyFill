import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  BrowserAgentClient,
  BrowserAgentQuestionAnswer,
  BrowserAgentStreamEvent,
  BrowserInput,
  BrowserRunCommand,
  BrowserRunSnapshot,
  PrivateAiStatus,
  StartBrowserRunRequest,
} from '../features/browser-agent';
import { BrowserAgentPage } from './BrowserAgent';

const baseRun = (overrides: Partial<BrowserRunSnapshot> = {}): BrowserRunSnapshot => ({
  activity: [
    { id: 'a1', kind: 'completed', occurredAt: '2026-07-22T17:00:00Z', summary: 'Opened application' },
    { id: 'a2', kind: 'current', occurredAt: '2026-07-22T17:01:00Z', summary: 'Completing contact information' },
  ],
  applicationStage: 'Contact information',
  canResume: false,
  checkpointRetained: true,
  companyName: 'Example Company',
  controlOwner: 'agent',
  currentAction: 'Entering your contact information',
  currentDomain: 'jobs.example.com',
  currentUrl: 'https://jobs.example.com/apply/123',
  frameHeight: 720,
  frameSequence: 12,
  framePageGeneration: 3,
  frameDeviceScaleFactor: 1,
  frameUpdatedAt: new Date().toISOString(),
  frameUrl: '/api/browser-agent/runs/run-1/frame/latest',
  frameWidth: 1280,
  id: 'run-1',
  jobTitle: 'Credit Analyst',
  revision: 1,
  state: 'agent-running',
  statusMessage: 'Completing contact information.',
  updatedAt: '2026-07-22T17:01:00Z',
  ...overrides,
});

const readyPrivateAi: PrivateAiStatus = { message: 'Private AI is ready.', state: 'ready' };

class FakeBrowserAgentClient implements BrowserAgentClient {
  run: BrowserRunSnapshot;
  privateAi: PrivateAiStatus;
  commandCalls: BrowserRunCommand[] = [];
  inputCalls: BrowserInput[] = [];
  answerCalls: BrowserAgentQuestionAnswer[] = [];
  callOrder: string[] = [];
  decisionCalls: Array<{ approvalId: string; approved: boolean; concurrencyToken: string }> = [];
  getRunError: Error | null = null;
  statusError: Error | null = null;
  decisionError: Error | null = null;
  recoverCalls = 0;
  connectCalls = 0;
  connectState: 'connected' | 'disconnected' = 'connected';

  constructor(run = baseRun(), privateAi = readyPrivateAi) {
    this.run = run;
    this.privateAi = privateAi;
  }

  async getPrivateAiStatus() {
    if (this.statusError) throw this.statusError;
    return this.privateAi;
  }
  async setupPrivateAi() {
    this.privateAi = { message: 'Downloading.', progress: 14, stage: 'Downloading', state: 'downloading' };
    return this.privateAi;
  }
  async listRuns() { return []; }
  async getRun() {
    if (this.getRunError) throw this.getRunError;
    return this.run;
  }
  async recoverRun() {
    this.recoverCalls += 1;
    this.callOrder.push('recover');
    return this.run;
  }
  async startRun(_request: StartBrowserRunRequest) { return this.run; }
  async command(_runId: string, command: BrowserRunCommand) {
    this.commandCalls.push(command);
    if (command === 'pause') this.run = baseRun({ canResume: true, controlOwner: 'none', revision: this.run.revision + 1, state: 'paused' });
    if (command === 'resume' || command === 'return-control') this.run = baseRun({ revision: this.run.revision + 1 });
    if (command === 'take-control') this.run = baseRun({ controlOwner: 'user', revision: this.run.revision + 1, state: 'user-control' });
    if (command === 'stop') this.run = baseRun({ canResume: true, controlOwner: 'none', revision: this.run.revision + 1, state: 'stopped' });
    return this.run;
  }
  async answerQuestion(_runId: string, _questionId: string, answer: BrowserAgentQuestionAnswer) {
    this.callOrder.push(`answer:${answer.optionId}`);
    this.answerCalls.push(answer);
    this.run = baseRun({ revision: this.run.revision + 1 });
    return this.run;
  }
  async decideSensitiveApproval(_runId: string, approvalId: string, approved: boolean, concurrencyToken: string) {
    this.callOrder.push(`decision:${approved ? 'approve' : 'deny'}`);
    this.decisionCalls.push({ approvalId, approved, concurrencyToken });
    if (this.decisionError) throw this.decisionError;
  }
  async sendInput(_runId: string, input: BrowserInput) { this.inputCalls.push(input); }
  async deleteRun() { return undefined; }
  async connect(_runId: string, listener: (event: BrowserAgentStreamEvent) => void) {
    this.connectCalls += 1;
    listener({ state: this.connectState, type: 'connection' });
    return async () => undefined;
  }
}

const mounted: Array<{ container: HTMLDivElement; root: ReturnType<typeof createRoot> }> = [];

afterEach(() => {
  for (const item of mounted.splice(0)) act(() => item.root.unmount());
});

const mountPage = async (client: BrowserAgentClient, path = '/agent/run-1') => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mounted.push({ container, root });
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<BrowserAgentPage client={client} loadStartResources={async () => ({ applications: [], profileId: '0bca6cee-38ef-4b4c-b02d-dd540c2fb5e4', resumes: [] })} />} path="/agent" />
          <Route element={<BrowserAgentPage client={client} loadStartResources={async () => ({ applications: [], profileId: '0bca6cee-38ef-4b4c-b02d-dd540c2fb5e4', resumes: [] })} />} path="/agent/:runId" />
        </Routes>
      </MemoryRouter>,
    );
    await Promise.resolve();
  });
  return container;
};

const buttonWithText = (container: HTMLElement, value: string) => [...container.querySelectorAll('button')]
  .find((button) => button.textContent?.includes(value)) as HTMLButtonElement | undefined;

describe('BrowserAgentPage', () => {
  it('uses one plain-language Private AI setup action and hides implementation details', async () => {
    const client = new FakeBrowserAgentClient(baseRun(), {
      downloadSize: '6 GB',
      message: 'Not ready.',
      state: 'not-ready',
    });
    const container = await mountPage(client, '/agent');
    expect(container.textContent).toContain('Set Up Private AI');
    expect(container.textContent).toContain('one-time download of about 6 GB');
    expect(container.textContent).not.toMatch(/Ollama|Qwen|Paddle|WebNN|GPU layer|port|container/i);
    await act(async () => buttonWithText(container, 'Set Up Private AI')?.click());
    expect(container.textContent).toContain('Downloading Private AI');
    expect(container.textContent).toContain('14%');
  });

  it('supports pause, resume, take-control, return-control, and confirmed stop without reconnecting', async () => {
    const client = new FakeBrowserAgentClient();
    const container = await mountPage(client);

    await act(async () => buttonWithText(container, 'Pause')?.click());
    expect(client.commandCalls).toEqual(['pause']);
    expect(container.textContent).toContain('Paused');

    await act(async () => buttonWithText(container, 'Resume')?.click());
    await act(async () => buttonWithText(container, 'Take Control')?.click());
    expect(container.textContent).toContain('You have control');
    expect(container.textContent).toContain('Return to ApplyFill');

    await act(async () => buttonWithText(container, 'Return to ApplyFill')?.click());
    expect(client.commandCalls).toContain('return-control');
    await act(async () => buttonWithText(container, 'Stop')?.click());
    expect(container.textContent).toContain('Stop this application run?');
    const stopButtons = [...container.querySelectorAll('button')].filter((button) => button.textContent?.includes('Stop Run'));
    await act(async () => (stopButtons[0] as HTMLButtonElement).click());
    expect(client.commandCalls.at(-1)).toBe('stop');
    expect(container.textContent).toContain('Stopped');
  });

  it('keeps sensitive questions behind an explicit user answer and optional profile save', async () => {
    const client = new FakeBrowserAgentClient(baseRun({
      controlOwner: 'none',
      pendingQuestion: {
        canSaveToProfile: true,
        category: 'sensitive',
        context: 'The employer is asking about future work authorization.',
        id: 'q1',
        options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }],
        prompt: 'Will you need visa sponsorship?',
      },
      state: 'waiting-for-user',
    }));
    const container = await mountPage(client);
    expect(container.textContent).toContain('Will you need visa sponsorship?');
    const noAnswer = container.querySelector<HTMLInputElement>('input[value="no"]')
      ?? [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')][1];
    await act(async () => noAnswer.click());
    const save = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    await act(async () => save?.click());
    await act(async () => buttonWithText(container, 'Use This Answer')?.click());
    expect(client.answerCalls).toEqual([{ optionId: 'no', saveToProfile: true, value: undefined }]);
  });

  it.each([
    ['approve', true],
    ['deny', false],
  ] as const)('records a sensitive %s decision before telling the worker to continue', async (optionId, approved) => {
    const client = new FakeBrowserAgentClient(baseRun({
      controlOwner: 'none',
      pendingQuestion: {
        approvalConcurrencyToken: 'approval-version-1',
        approvalId: 'approval-1',
        allowFreeText: false,
        canSaveToProfile: false,
        category: 'sensitive-approval',
        context: 'This saved value is only used after you approve it.',
        id: 'approval-1',
        maskedValue: '•••6789',
        options: [
          { id: 'approve', label: 'Use saved answer', description: 'Use •••6789 for this application only.' },
          { id: 'deny', label: 'Do not use it' },
        ],
        prompt: 'Use your saved Social Security number?',
      },
      state: 'waiting-for-user',
    }));
    const container = await mountPage(client);
    const option = container.querySelector<HTMLInputElement>(`input[value="${optionId}"]`);
    await act(async () => option?.click());
    await act(async () => buttonWithText(container, 'Use This Answer')?.click());

    expect(client.callOrder).toEqual([`decision:${optionId}`, `answer:${optionId}`]);
    expect(client.decisionCalls).toEqual([{ approvalId: 'approval-1', approved, concurrencyToken: 'approval-version-1' }]);
    expect(client.answerCalls).toEqual([{ optionId, saveToProfile: false, value: undefined }]);
  });

  it('does not tell the worker to use a sensitive answer when approval changed', async () => {
    const client = new FakeBrowserAgentClient(baseRun({
      controlOwner: 'none',
      pendingQuestion: {
        approvalConcurrencyToken: 'stale-version',
        approvalId: 'approval-1',
        category: 'sensitive-approval',
        context: 'Approve this masked saved value.',
        id: 'approval-1',
        maskedValue: '•••6789',
        options: [{ id: 'approve', label: 'Use saved answer' }, { id: 'deny', label: 'Do not use it' }],
        prompt: 'Use this saved answer?',
      },
      state: 'waiting-for-user',
    }));
    client.decisionError = Object.assign(new Error('This approval changed. Reload it before continuing.'), { status: 412 });
    const container = await mountPage(client);
    await act(async () => container.querySelector<HTMLInputElement>('input[value="approve"]')?.click());
    await act(async () => buttonWithText(container, 'Use This Answer')?.click());

    expect(client.callOrder).toEqual(['decision:approve']);
    expect(client.answerCalls).toEqual([]);
    expect(container.textContent).toContain('This approval changed. Reload it before continuing.');
  });

  it('offers recovery explicitly when a saved run is not live', async () => {
    const client = new FakeBrowserAgentClient(baseRun({ canResume: true, controlOwner: 'none', state: 'paused' }));
    client.getRunError = Object.assign(new Error('Not found.'), { status: 404 });
    const container = await mountPage(client);

    expect(client.recoverCalls).toBe(0);
    expect(container.textContent).toContain('Resume this application?');
    expect(container.textContent).toContain('Nothing will be submitted.');
    await act(async () => buttonWithText(container, 'Resume This Application')?.click());
    expect(client.recoverCalls).toBe(1);
    expect(container.textContent).toContain('Credit Analyst');
  });

  it('blocks final submission while review warnings remain', async () => {
    const client = new FakeBrowserAgentClient(baseRun({
      controlOwner: 'none',
      review: {
        approvalRecorded: false,
        coverLetterName: 'Cover Letter.pdf',
        resumeName: 'Resume.pdf',
        sectionsAnswered: ['Contact information', 'Experience'],
        sensitiveDisclosures: ['Work authorization'],
        unresolvedWarnings: ['Confirm the requested salary.'],
        userModifiedFields: ['Preferred name'],
      },
      state: 'ready-for-review',
    }));
    const container = await mountPage(client);
    expect(container.textContent).toContain('Nothing has been submitted yet');
    expect(container.textContent).toContain('Confirm the requested salary.');
    expect(buttonWithText(container, 'Approve and Submit Application')?.disabled).toBe(true);
  });

  it('retries the saved application connection without restarting the run', async () => {
    const client = new FakeBrowserAgentClient();
    client.connectState = 'disconnected';
    const container = await mountPage(client);

    expect(container.textContent).toContain('Your application is still saved.');
    expect(client.connectCalls).toBe(1);
    await act(async () => buttonWithText(container, 'Try Again')?.click());
    expect(client.connectCalls).toBe(2);
    expect(client.recoverCalls).toBe(0);
  });

  it('offers a plain retry when landing data cannot be reached', async () => {
    const client = new FakeBrowserAgentClient();
    client.statusError = new Error('ApplyFill could not reach its local service. Keep ApplyFill open, then try again.');
    const container = await mountPage(client, '/agent');

    expect(container.textContent).toContain('ApplyFill is still starting. Try again in a moment.');
    client.statusError = null;
    await act(async () => buttonWithText(container, 'Try Again')?.click());
    expect(container.textContent).toContain('Private AI is ready.');
  });
});

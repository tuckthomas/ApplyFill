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

  constructor(run = baseRun(), privateAi = readyPrivateAi) {
    this.run = run;
    this.privateAi = privateAi;
  }

  async getPrivateAiStatus() { return this.privateAi; }
  async setupPrivateAi() {
    this.privateAi = { message: 'Downloading.', progress: 14, stage: 'Downloading', state: 'downloading' };
    return this.privateAi;
  }
  async listRuns() { return []; }
  async getRun() { return this.run; }
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
    this.answerCalls.push(answer);
    this.run = baseRun({ revision: this.run.revision + 1 });
    return this.run;
  }
  async sendInput(_runId: string, input: BrowserInput) { this.inputCalls.push(input); }
  async deleteRun() { return undefined; }
  async connect(_runId: string, listener: (event: BrowserAgentStreamEvent) => void) {
    listener({ state: 'connected', type: 'connection' });
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
          <Route element={<BrowserAgentPage client={client} />} path="/agent" />
          <Route element={<BrowserAgentPage client={client} />} path="/agent/:runId" />
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
});

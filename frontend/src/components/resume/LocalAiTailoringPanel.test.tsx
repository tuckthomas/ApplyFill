import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LocalProfileDocument } from '../../features/profile/profileBuilder';
import { createResumeDraft } from '../../features/resume/resumeDocument';
import { FakeLocalAiRuntime } from '../../features/local-ai/runtime';
import type { ModelManifestEntry } from '../../features/local-ai/runtime';
import LocalAiTailoringPanel from './LocalAiTailoringPanel';

const profile = {
  data: {
    education: [],
    experience: [{ company: 'Example', description: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Built reliable software"}]}]}', id: 1, isSaved: true, jobTitle: 'Engineer' }],
    projects: [], skills: []
  },
  updatedAtUtc: '2026-07-18T00:00:00.000Z'
} as unknown as LocalProfileDocument;
const model = {
  approvedTasks: ['resume-tailoring-draft'], artifact: { byteSize: 1, digest: `sha256-${'0'.repeat(64)}`, url: '/model' },
  contextLimit: 4096, displayName: 'Fake', format: '.litertlm', id: 'fake', license: { attribution: '', name: 'Test', redistributionAllowed: true, url: '' },
  runtime: 'litert-lm-js', runtimeVersion: 'test', supportedAccelerators: ['wasm'], version: '1'
} as ModelManifestEntry;
const output = JSON.stringify({
  analysis: { employer: 'Example', format: 'applyfill.ai.job-analysis', keywords: ['reliable'], preferredSkills: [], requiredSkills: [], responsibilities: [], role: 'Engineer', schemaVersion: 1 },
  bullets: { format: 'applyfill.ai.bullet-suggestions', schemaVersion: 1, suggestions: [] },
  format: 'applyfill.ai.resume-tailoring',
  relevance: { format: 'applyfill.ai.relevance', items: [{ opaqueId: 'experience:1', reason: 'Match', score: 1 }], schemaVersion: 1 },
  schemaVersion: 1,
  summaries: { format: 'applyfill.ai.summary-suggestions', schemaVersion: 1, suggestions: [{
    after: 'Engineer focused on reliable software.', before: '', confidence: 'high', evidence: [{ note: 'Source', opaqueId: 'experience:1' }], suggestionId: 's1'
  }] }
});

const mounted: Array<{ container: HTMLDivElement; root: ReturnType<typeof createRoot> }> = [];
afterEach(() => {
  for (const item of mounted.splice(0)) act(() => item.root.unmount());
});

const setTextarea = (element: HTMLTextAreaElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('LocalAiTailoringPanel', () => {
  it('shows preflight, generates a proposal, and applies it only after confirmation', async () => {
    const runtime = new FakeLocalAiRuntime({ response: { finishReason: 'completed', text: output, toolCalls: [] } });
    await runtime.initialize({ acceleratorPreference: 'wasm', model });
    const resume = createResumeDraft(profile, '2026-07-18T00:01:00.000Z');
    const onResumeChange = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    mounted.push({ container, root });
    await act(async () => root.render(<LocalAiTailoringPanel onClose={vi.fn()} onResumeChange={onResumeChange} profile={profile} resume={resume} runtime={runtime} />));
    expect(container.textContent).toContain('Excluded from the model');
    expect(container.textContent).toContain('1 selected');
    const job = container.querySelector('#local-ai-job-posting') as HTMLTextAreaElement;
    await act(async () => setTextarea(job, 'Engineer job'));
    const generate = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Analyze & Suggest')) as HTMLButtonElement;
    await act(async () => generate.click());
    expect(onResumeChange).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Review Proposed Changes');
    const accept = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Accept This Change')) as HTMLButtonElement;
    await act(async () => accept.click());
    expect(onResumeChange).toHaveBeenCalledTimes(1);
    expect(onResumeChange.mock.calls[0][0].summary).toBe('Engineer focused on reliable software.');
  });

  it('keeps the resume unchanged when model output is invalid', async () => {
    const runtime = new FakeLocalAiRuntime({ response: { finishReason: 'completed', text: '<script>bad()</script>', toolCalls: [] } });
    await runtime.initialize({ acceleratorPreference: 'wasm', model });
    const onResumeChange = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    mounted.push({ container, root });
    await act(async () => root.render(<LocalAiTailoringPanel onClose={vi.fn()} onResumeChange={onResumeChange} profile={profile} resume={createResumeDraft(profile)} runtime={runtime} />));
    await act(async () => setTextarea(container.querySelector('#local-ai-job-posting') as HTMLTextAreaElement, 'Engineer job'));
    const generate = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Analyze & Suggest')) as HTMLButtonElement;
    await act(async () => generate.click());
    expect(onResumeChange).not.toHaveBeenCalled();
    expect(container.textContent).toContain('invalid JSON');
  });
});

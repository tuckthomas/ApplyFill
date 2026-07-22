import { describe, expect, it, vi } from 'vitest';
import type { LocalProfileDocument } from '../../profile/profileBuilder';
import { createResumeDraft } from '../../resume/resumeDocument';
import type { LocalAiRuntime } from '../runtime/types';
import { createAiSafeResumeSnapshot } from '../contracts';
import { runResumeTailoringWorkflow } from './resumeTailoring';

const profile = {
  data: {
    education: [],
    experience: [{
      company: 'Example', description: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Built reliable software"}]}]}',
      id: 1, isSaved: true, jobTitle: 'Engineer'
    }],
    projects: [], skills: []
  },
  updatedAtUtc: '2026-07-18T00:00:00.000Z'
} as unknown as LocalProfileDocument;

const runtimeWith = (text: string): LocalAiRuntime => ({
  snapshot: { diagnostics: { browserSupported: true }, state: 'ready' },
  detectCapabilities: vi.fn(), dispose: vi.fn(), exportDiagnostics: vi.fn(), generate: vi.fn().mockResolvedValue({ finishReason: 'completed', text, toolCalls: [] }),
  initialize: vi.fn(), reset: vi.fn(), subscribe: vi.fn()
});

describe('resume tailoring workflow', () => {
  it('uses only a bounded snapshot and returns proposals without network or mutation', async () => {
    const resume = createResumeDraft(profile, '2026-07-18T00:01:00.000Z');
    const before = structuredClone(resume);
    const safe = createAiSafeResumeSnapshot(profile, resume);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const output = {
      analysis: { employer: 'Employer', format: 'applyfill.ai.job-analysis', keywords: ['reliable'], preferredSkills: [], requiredSkills: [], responsibilities: [], role: 'Engineer', schemaVersion: 1 },
      bullets: { format: 'applyfill.ai.bullet-suggestions', schemaVersion: 1, suggestions: [{
        after: 'Built reliable software', before: 'Built reliable software', confidence: 'high',
        evidence: [{ note: 'Exact source', opaqueId: 'experience:1' }], sourceOpaqueId: 'experience:1', suggestionId: 'b1'
      }] },
      format: 'applyfill.ai.resume-tailoring', schemaVersion: 1,
      relevance: { format: 'applyfill.ai.relevance', schemaVersion: 1, items: [{ opaqueId: 'experience:1', reason: 'Direct match', score: 1 }] },
      summaries: { format: 'applyfill.ai.summary-suggestions', schemaVersion: 1, suggestions: [{
        after: 'Engineer focused on reliable software.', before: '', confidence: 'high',
        evidence: [{ note: 'Role evidence', opaqueId: 'experience:1' }], suggestionId: 's1'
      }] }
    };
    const runtime = runtimeWith(JSON.stringify(output));
    const result = await runResumeTailoringWorkflow(runtime, profile, resume, '<script>bad()</script> Engineer');
    expect(result.patches).toHaveLength(2);
    expect(resume).toEqual(before);
    expect(fetchSpy).not.toHaveBeenCalled();
    const prompt = vi.mocked(runtime.generate).mock.calls[0][0].input;
    expect(prompt).toContain(JSON.stringify(safe));
    expect(prompt).not.toContain('bad()');

    const envelopeRuntime = runtimeWith('');
    const withoutClientBookkeeping = {
      analysis: Object.fromEntries(Object.entries(output.analysis).filter(([key]) => !['format', 'schemaVersion'].includes(key))),
      bullets: {
        suggestions: output.bullets.suggestions.map(({ sourceOpaqueId: _sourceOpaqueId, suggestionId: _suggestionId, ...suggestion }) => ({
          ...suggestion,
          sourceOpaqueId: 'model-owned-invalid-id',
          suggestionId: 'model-owned-id'
        }))
      },
      relevance: { items: output.relevance.items },
      summaries: {
        suggestions: output.summaries.suggestions.map(({ suggestionId: _suggestionId, ...suggestion }) => ({
          ...suggestion,
          suggestionId: 'model-owned-id'
        }))
      }
    };
    vi.mocked(envelopeRuntime.generate).mockResolvedValue({
      finishReason: 'tool-call',
      text: '',
      toolCalls: [{
        name: 'return_resume_tailoring',
        arguments: withoutClientBookkeeping
      }]
    });
    await expect(
      runResumeTailoringWorkflow(envelopeRuntime, profile, resume, 'Engineer')
    ).resolves.toMatchObject({
      patches: [
        expect.objectContaining({ patchId: 'summary-1' }),
        expect.objectContaining({ patchId: 'bullet-1' })
      ]
    });
    fetchSpy.mockRestore();
  });

  it('rejects tools and invalid model output', async () => {
    const resume = createResumeDraft(profile);
    const runtime = runtimeWith('{}');
    await expect(runResumeTailoringWorkflow(runtime, profile, resume, 'Engineer')).rejects.toThrow(/invalid tailoring/);
    vi.mocked(runtime.generate).mockResolvedValue({ finishReason: 'tool-call', text: '{}', toolCalls: [{ name: 'fetch', arguments: {} }] });
    await expect(runResumeTailoringWorkflow(runtime, profile, resume, 'Engineer')).rejects.toThrow(/does not permit/);
  });
});

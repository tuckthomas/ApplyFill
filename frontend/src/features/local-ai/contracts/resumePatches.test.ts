import { describe, expect, it } from 'vitest';
import type { LocalResumeDraft } from '../../resume/resumeDocument';
import type { AiSafeResumeSnapshot } from './aiSafeProjection';
import { applyResumeAiPatches, prepareResumeForAiPatches, validateResumeAiPatch } from './resumePatches';

const snapshot: AiSafeResumeSnapshot = {
  education: [], format: 'applyfill.ai-safe-resume-snapshot', projects: [], schemaVersion: 1,
  sourceRevision: 'rev-1', skills: [], summary: 'Engineer',
  experience: [{ accomplishments: ['Reduced deployment time by 20%'], opaqueId: 'experience:1', organization: 'Example', role: 'Engineer' }]
};
const resume = {
  contentOverrides: { experienceDetails: {}, projectDetails: {} }, summary: 'Engineer'
} as unknown as LocalResumeDraft;

describe('resume AI patches', () => {
  it('applies only an explicitly selected validated proposal and leaves its input immutable', () => {
    const before = structuredClone(resume);
    const patch = validateResumeAiPatch({
      after: 'Reduced deployment time by 20%', before: 'Reduced deployment time by 20%', evidenceIds: ['experience:1'],
      patchId: 'p1', sourceOpaqueId: 'experience:1', target: 'experience-bullet'
    }, snapshot);
    const next = applyResumeAiPatches(prepareResumeForAiPatches(resume, snapshot), [patch]);
    expect(next.contentOverrides.experienceDetails['1']).toEqual(['Reduced deployment time by 20%']);
    expect(resume).toEqual(before);
  });

  it('blocks invented numbers, markup, URLs, stale source text, and unknown evidence', () => {
    const base = { before: 'Reduced deployment time by 20%', evidenceIds: ['experience:1'], patchId: 'p1', sourceOpaqueId: 'experience:1', target: 'experience-bullet' as const };
    expect(() => validateResumeAiPatch({ ...base, after: 'Reduced deployment time by 50%' }, snapshot)).toThrow(/numeric claim/);
    expect(() => validateResumeAiPatch({ ...base, after: '<strong>Improved</strong>' }, snapshot)).toThrow(/markup/);
    expect(() => validateResumeAiPatch({ ...base, after: 'See https://example.com' }, snapshot)).toThrow(/URL/);
    expect(() => validateResumeAiPatch({ ...base, after: 'Improved', before: 'Unknown source' }, snapshot)).toThrow(/source text/);
    expect(() => validateResumeAiPatch({ ...base, after: 'Improved', evidenceIds: ['experience:2'] }, snapshot)).toThrow(/outside/);
  });
});

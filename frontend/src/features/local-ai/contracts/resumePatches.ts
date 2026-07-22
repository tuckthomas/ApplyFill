import type { LocalResumeDraft } from '../../resume/resumeDocument';
import type { AiSafeResumeSnapshot } from './aiSafeProjection';
import type { ResumeTailoringOutput } from './outputSchemas';
import { containsMarkup } from './textBoundary';

export type ResumeAiPatch = {
  after: string;
  before: string;
  evidenceIds: string[];
  patchId: string;
  sourceOpaqueId: string | null;
  target: 'summary' | 'experience-bullet' | 'project-bullet';
};

const numericClaims = (value: string) => value.match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? [];
const snapshotText = (snapshot: AiSafeResumeSnapshot) => JSON.stringify(snapshot);

export const validateResumeAiPatch = (patch: ResumeAiPatch, snapshot: AiSafeResumeSnapshot) => {
  if (!patch.after.trim() || patch.after.length > 2_000 || containsMarkup(patch.after)
    || /\b(?:https?:\/\/|www\.)/i.test(patch.after)) {
    throw new Error('A suggestion contained unsupported markup, a URL, or invalid text.');
  }
  const source = snapshotText(snapshot);
  if (numericClaims(patch.after).some((claim) => !source.includes(claim))) {
    throw new Error('A suggestion introduced a numeric claim that was not in the approved source.');
  }
  if (patch.sourceOpaqueId) {
    const record = [...snapshot.experience, ...snapshot.projects].find((item) => item.opaqueId === patch.sourceOpaqueId);
    const content = record && 'accomplishments' in record ? record.accomplishments : record?.details;
    if (!record || !content?.includes(patch.before)) throw new Error('A suggestion does not match its approved source text.');
  } else if (patch.before !== snapshot.summary) {
    throw new Error('A summary suggestion does not match the approved source text.');
  }
  if (patch.evidenceIds.some((id) => !source.includes(`"opaqueId":"${id}"`))) {
    throw new Error('A suggestion cited information outside the approved source.');
  }
  return patch;
};

export const createResumeAiPatches = (
  output: ResumeTailoringOutput,
  snapshot: AiSafeResumeSnapshot
): ResumeAiPatch[] => [
  ...output.summaries.suggestions.map((suggestion) => validateResumeAiPatch({
    after: suggestion.after,
    before: suggestion.before,
    evidenceIds: suggestion.evidence.map((item) => item.opaqueId),
    patchId: suggestion.suggestionId,
    sourceOpaqueId: null,
    target: 'summary'
  }, snapshot)),
  ...output.bullets.suggestions.map((suggestion) => validateResumeAiPatch({
    after: suggestion.after,
    before: suggestion.before,
    evidenceIds: suggestion.evidence.map((item) => item.opaqueId),
    patchId: suggestion.suggestionId,
    sourceOpaqueId: suggestion.sourceOpaqueId,
    target: suggestion.sourceOpaqueId.startsWith('experience:') ? 'experience-bullet' : 'project-bullet'
  }, snapshot))
];

export const applyResumeAiPatches = (
  resume: LocalResumeDraft,
  patches: ResumeAiPatch[]
): LocalResumeDraft => patches.reduce((current, patch) => {
  if (patch.target === 'summary') return { ...current, summary: patch.after };
  const [kind, rawId] = patch.sourceOpaqueId?.split(':') ?? [];
  const key = kind === 'experience' ? 'experienceDetails' : 'projectDetails';
  const existing = current.contentOverrides[key][rawId];
  if (!existing) throw new Error('The resume source changed before this suggestion was accepted.');
  const index = existing.indexOf(patch.before);
  if (index < 0) throw new Error('The resume source changed before this suggestion was accepted.');
  const next = [...existing];
  next[index] = patch.after;
  return {
    ...current,
    contentOverrides: {
      ...current.contentOverrides,
      [key]: { ...current.contentOverrides[key], [rawId]: next }
    }
  };
}, resume);

export const prepareResumeForAiPatches = (
  resume: LocalResumeDraft,
  snapshot: AiSafeResumeSnapshot
): LocalResumeDraft => ({
  ...resume,
  contentOverrides: {
    experienceDetails: Object.fromEntries(snapshot.experience.map((item) => [
      item.opaqueId.split(':')[1],
      resume.contentOverrides.experienceDetails[item.opaqueId.split(':')[1]] ?? item.accomplishments
    ])),
    projectDetails: Object.fromEntries(snapshot.projects.map((item) => [
      item.opaqueId.split(':')[1],
      resume.contentOverrides.projectDetails[item.opaqueId.split(':')[1]] ?? item.details
    ]))
  }
});

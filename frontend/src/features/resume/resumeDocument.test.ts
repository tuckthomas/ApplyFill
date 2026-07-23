import { describe, expect, it } from 'vitest';
import type { LocalProfileDocument } from '../profile/profileBuilder';
import {
  createPortableResumeDocument,
  createResumeDraft,
  parsePortableResumeDocument
} from './resumeDocument';

const profile = {
  data: {
    education: [],
    experience: [],
    projects: [],
    skills: []
  },
  updatedAtUtc: '2026-07-18T12:00:00.000Z'
} as unknown as LocalProfileDocument;

describe('resume documents', () => {
  it('round-trips a validated portable resume document', () => {
    const draft = createResumeDraft(profile, '2026-07-18T12:30:00.000Z');
    const json = JSON.stringify(createPortableResumeDocument(draft));
    expect(parsePortableResumeDocument(json).resume).toEqual(draft);
    expect(() => parsePortableResumeDocument('{"format":"unknown"}')).toThrow(/ApplyFill resume schema version 2/);
  });
});

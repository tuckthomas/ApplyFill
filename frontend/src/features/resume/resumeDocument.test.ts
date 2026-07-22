import { beforeEach, describe, expect, it } from 'vitest';
import type { LocalProfileDocument } from '../profile/profileBuilder';
import {
  createPortableResumeDocument,
  createResumeDraft,
  loadResumeCollection,
  parsePortableResumeDocument,
  saveResumeDraft
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

const deleteDatabase = () => new Promise<void>((resolve, reject) => {
  const request = indexedDB.deleteDatabase('applyfill-local');
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error);
  request.onblocked = () => reject(new Error('Test database deletion was blocked.'));
});

describe('local resume documents', () => {
  beforeEach(async () => {
    await deleteDatabase();
  });

  it('round-trips a validated portable resume document', () => {
    const draft = createResumeDraft(profile, '2026-07-18T12:30:00.000Z');
    const json = JSON.stringify(createPortableResumeDocument(draft));
    expect(parsePortableResumeDocument(json).resume).toEqual(draft);
    expect(() => parsePortableResumeDocument('{"format":"unknown"}')).toThrow(/ApplyFill resume schema version 2/);
  });

  it('persists and updates drafts through the shared IndexedDB boundary', async () => {
    const draft = createResumeDraft(profile, '2026-07-18T12:30:00.000Z');
    await saveResumeDraft(draft, '2026-07-18T12:31:00.000Z');
    await saveResumeDraft({ ...draft, title: 'Targeted Resume' }, '2026-07-18T12:32:00.000Z');
    const collection = await loadResumeCollection();
    expect(collection.resumes).toHaveLength(1);
    expect(collection.resumes[0]).toMatchObject({ title: 'Targeted Resume', updatedAtUtc: '2026-07-18T12:32:00.000Z' });
  });
});

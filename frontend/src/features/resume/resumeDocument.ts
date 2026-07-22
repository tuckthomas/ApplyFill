import type { LocalProfileDocument } from '../profile/profileBuilder';
import { LOCAL_DATA_KEYS, readLocalDocument, writeLocalDocument } from '../storage/localDatabase';

export const RESUME_COLLECTION_FORMAT = 'applyfill.resume-collection';
export const RESUME_DOCUMENT_FORMAT = 'applyfill.resume';
export const RESUME_SCHEMA_VERSION = 2;

export type ResumeTemplateId = 'classic';

export type ResumeSelections = {
  educationIds: number[];
  experienceIds: number[];
  projectIds: number[];
  skillIds: number[];
};

export type ResumeContentOverrides = {
  experienceDetails: Record<string, string[]>;
  projectDetails: Record<string, string[]>;
};

export type LocalResumeDraft = {
  createdAtUtc: string;
  id: string;
  contentOverrides: ResumeContentOverrides;
  selections: ResumeSelections;
  sourceProfileUpdatedAtUtc: string;
  summary: string;
  targetJobUrl: string;
  targetRole: string;
  template: ResumeTemplateId;
  title: string;
  updatedAtUtc: string;
};

export type LocalResumeCollection = {
  format: typeof RESUME_COLLECTION_FORMAT;
  resumes: LocalResumeDraft[];
  schemaVersion: typeof RESUME_SCHEMA_VERSION;
  updatedAtUtc: string;
};

export type PortableResumeDocument = {
  format: typeof RESUME_DOCUMENT_FORMAT;
  resume: LocalResumeDraft;
  schemaVersion: typeof RESUME_SCHEMA_VERSION;
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isNumberArray = (value: unknown): value is number[] => (
  Array.isArray(value) && value.every((item) => typeof item === 'number' && Number.isFinite(item))
);

const isDetailsRecord = (value: unknown): value is Record<string, string[]> => isRecord(value)
  && Object.entries(value).every(([key, lines]) => /^\d+$/.test(key)
    && Array.isArray(lines) && lines.length <= 50
    && lines.every((line) => typeof line === 'string' && line.length <= 2_000));

export const isLocalResumeDraft = (value: unknown): value is LocalResumeDraft => {
  if (!isRecord(value) || !isRecord(value.selections) || !isRecord(value.contentOverrides)) return false;
  const requiredStrings = [
    'createdAtUtc', 'id', 'sourceProfileUpdatedAtUtc', 'summary', 'targetJobUrl',
    'targetRole', 'template', 'title', 'updatedAtUtc'
  ];
  return requiredStrings.every((field) => typeof value[field] === 'string')
    && typeof value.id === 'string'
    && value.id.length > 0
    && value.template === 'classic'
    && isDetailsRecord(value.contentOverrides.experienceDetails)
    && isDetailsRecord(value.contentOverrides.projectDetails)
    && isNumberArray(value.selections.educationIds)
    && isNumberArray(value.selections.experienceIds)
    && isNumberArray(value.selections.projectIds)
    && isNumberArray(value.selections.skillIds);
};

export const isLocalResumeCollection = (value: unknown): value is LocalResumeCollection => (
  isRecord(value)
  && value.format === RESUME_COLLECTION_FORMAT
  && value.schemaVersion === RESUME_SCHEMA_VERSION
  && typeof value.updatedAtUtc === 'string'
  && Array.isArray(value.resumes)
  && value.resumes.every(isLocalResumeDraft)
);

const createEmptyCollection = (updatedAtUtc = new Date().toISOString()): LocalResumeCollection => ({
  format: RESUME_COLLECTION_FORMAT,
  resumes: [],
  schemaVersion: RESUME_SCHEMA_VERSION,
  updatedAtUtc
});

const createResumeId = () => (
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
);

export const createResumeDraft = (
  profile: LocalProfileDocument,
  now = new Date().toISOString()
): LocalResumeDraft => ({
  createdAtUtc: now,
  contentOverrides: { experienceDetails: {}, projectDetails: {} },
  id: createResumeId(),
  selections: {
    educationIds: profile.data.education.filter((entry) => entry.isSaved).map((entry) => entry.id),
    experienceIds: profile.data.experience.filter((entry) => entry.isSaved).map((entry) => entry.id),
    projectIds: profile.data.projects.filter((entry) => entry.isSaved).map((entry) => entry.id),
    skillIds: profile.data.skills.map((entry) => entry.id)
  },
  sourceProfileUpdatedAtUtc: profile.updatedAtUtc,
  summary: '',
  targetJobUrl: '',
  targetRole: '',
  template: 'classic',
  title: 'Untitled Resume',
  updatedAtUtc: now
});

export const loadResumeCollection = async (): Promise<LocalResumeCollection> => {
  const value = await readLocalDocument<unknown>(LOCAL_DATA_KEYS.resumes);
  if (value === null) return createEmptyCollection();
  if (!isLocalResumeCollection(value)) throw new Error('The locally stored resumes have an unsupported format.');
  return value;
};

export const saveResumeDraft = async (
  resume: LocalResumeDraft,
  updatedAtUtc = new Date().toISOString()
): Promise<LocalResumeDraft> => {
  const collection = await loadResumeCollection();
  const saved = { ...resume, updatedAtUtc };
  const resumes = collection.resumes.some((item) => item.id === saved.id)
    ? collection.resumes.map((item) => item.id === saved.id ? saved : item)
    : [...collection.resumes, saved];
  await writeLocalDocument(LOCAL_DATA_KEYS.resumes, {
    ...collection,
    resumes,
    updatedAtUtc
  });
  return saved;
};

export const deleteResumeDraft = async (resumeId: string): Promise<void> => {
  const collection = await loadResumeCollection();
  const updatedAtUtc = new Date().toISOString();
  await writeLocalDocument(LOCAL_DATA_KEYS.resumes, {
    ...collection,
    resumes: collection.resumes.filter((resume) => resume.id !== resumeId),
    updatedAtUtc
  });
};

export const createPortableResumeDocument = (resume: LocalResumeDraft): PortableResumeDocument => ({
  format: RESUME_DOCUMENT_FORMAT,
  resume,
  schemaVersion: RESUME_SCHEMA_VERSION
});

export const parsePortableResumeDocument = (json: string): PortableResumeDocument => {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error('Choose a valid JSON file.');
  }
  if (!isRecord(value)
    || value.format !== RESUME_DOCUMENT_FORMAT
    || value.schemaVersion !== RESUME_SCHEMA_VERSION
    || !isLocalResumeDraft(value.resume)) {
    throw new Error(`This is not an ApplyFill resume schema version ${RESUME_SCHEMA_VERSION} document.`);
  }
  return value as PortableResumeDocument;
};

export const cloneImportedResume = (
  document: PortableResumeDocument,
  now = new Date().toISOString()
): LocalResumeDraft => ({
  ...document.resume,
  createdAtUtc: now,
  id: createResumeId(),
  title: `${document.resume.title} (Imported)`,
  updatedAtUtc: now
});

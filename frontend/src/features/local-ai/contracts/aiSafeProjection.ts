import type { LocalProfileDocument } from '../../profile/profileBuilder';
import type { LocalResumeDraft } from '../../resume/resumeDocument';
import { AI_TEXT_LIMITS, boundPlainText, normalizeUntrustedJobText, richTextToAiPlainText } from './textBoundary';

export const AI_INPUT_SCHEMA_VERSION = 1 as const;

export type AiSafeExperience = {
  accomplishments: string[];
  opaqueId: string;
  organization: string;
  role: string;
};

export type AiSafeProject = {
  details: string[];
  name: string;
  opaqueId: string;
  organization: string;
  role: string;
};

export type AiSafeEducation = {
  credential: string;
  details: string[];
  fieldOfStudy: string;
  opaqueId: string;
  provider: string;
};

export type AiSafeCredential = {
  issuer: string;
  name: string;
  opaqueId: string;
  type: string;
};

export type AiSafeSkill = { name: string; opaqueId: string };

export type AiSafeResumeSnapshot = {
  credentials: AiSafeCredential[];
  education: AiSafeEducation[];
  experience: AiSafeExperience[];
  format: 'applyfill.ai-safe-resume-snapshot';
  projects: AiSafeProject[];
  schemaVersion: typeof AI_INPUT_SCHEMA_VERSION;
  skills: AiSafeSkill[];
  sourceRevision: string;
  summary: string;
};

export type AiJobPosting = {
  content: string;
  format: 'applyfill.untrusted-job-posting';
  schemaVersion: typeof AI_INPUT_SCHEMA_VERSION;
};

const lines = (value: string) => value.split(/\n+/).map((line) => line.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
const opaqueId = (kind: string, id: number) => `${kind}:${id}`;

const sourceRevision = (profile: LocalProfileDocument, resume: LocalResumeDraft) => {
  const source = JSON.stringify({
    profileUpdatedAtUtc: profile.updatedAtUtc,
    contentOverrides: resume.contentOverrides,
    selections: resume.selections,
    summary: resume.summary,
    updatedAtUtc: resume.updatedAtUtc
  });
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `rev-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

export const createAiSafeResumeSnapshot = (
  profile: LocalProfileDocument,
  resume: LocalResumeDraft
): AiSafeResumeSnapshot => {
  const selectedExperience = new Set(resume.selections.experienceIds);
  const selectedProjects = new Set(resume.selections.projectIds);
  const selectedEducation = new Set(resume.selections.educationIds);
  const selectedCredentials = new Set(resume.selections.credentialIds);
  const selectedSkills = new Set(resume.selections.skillIds);

  const snapshot: AiSafeResumeSnapshot = {
    credentials: (profile.data.credentials ?? [])
      .filter((entry) => selectedCredentials.has(entry.id))
      .map((entry) => ({
        issuer: boundPlainText(entry.issuer, 200),
        name: boundPlainText(entry.name, 200),
        opaqueId: opaqueId('credential', entry.id),
        type: entry.type,
      })),
    education: profile.data.education
      .filter((entry) => entry.isSaved && selectedEducation.has(entry.id))
      .map((entry) => ({
        credential: boundPlainText(entry.level?.label ?? '', 160),
        details: lines(richTextToAiPlainText(entry.additionalDetails, AI_TEXT_LIMITS.educationDetail)),
        fieldOfStudy: boundPlainText(entry.fieldOfStudy, 200),
        opaqueId: opaqueId('education', entry.id),
        provider: boundPlainText(entry.provider, 200)
      })),
    experience: profile.data.experience
      .filter((entry) => entry.isSaved && selectedExperience.has(entry.id))
      .map((entry) => ({
        accomplishments: resume.contentOverrides.experienceDetails[String(entry.id)]
          ?? lines(richTextToAiPlainText(entry.description, AI_TEXT_LIMITS.accomplishment)),
        opaqueId: opaqueId('experience', entry.id),
        organization: boundPlainText(entry.company, 200),
        role: boundPlainText(entry.jobTitle, 200)
      })),
    format: 'applyfill.ai-safe-resume-snapshot',
    projects: profile.data.projects
      .filter((entry) => entry.isSaved && selectedProjects.has(entry.id))
      .map((entry) => ({
        details: resume.contentOverrides.projectDetails[String(entry.id)]
          ?? lines(richTextToAiPlainText(entry.description, AI_TEXT_LIMITS.projectDetail)),
        name: boundPlainText(entry.name, 200),
        opaqueId: opaqueId('project', entry.id),
        organization: boundPlainText(entry.organization, 200),
        role: boundPlainText(entry.role, 200)
      })),
    schemaVersion: AI_INPUT_SCHEMA_VERSION,
    skills: profile.data.skills
      .filter((entry) => selectedSkills.has(entry.id))
      .map((entry) => ({ name: boundPlainText(entry.name, 120), opaqueId: opaqueId('skill', entry.id) })),
    sourceRevision: sourceRevision(profile, resume),
    summary: boundPlainText(resume.summary, AI_TEXT_LIMITS.summary)
  };

  if (JSON.stringify(snapshot).length > AI_TEXT_LIMITS.totalContext) {
    throw new Error('The selected resume content is too large for Private AI. Select fewer sections.');
  }
  return snapshot;
};

export const createAiJobPosting = (value: string): AiJobPosting => {
  const content = normalizeUntrustedJobText(value);
  if (!content) throw new Error('Paste the job posting text before starting Private AI.');
  return { content, format: 'applyfill.untrusted-job-posting', schemaVersion: AI_INPUT_SCHEMA_VERSION };
};

export const createSummaryOnlySnapshot = (
  profile: LocalProfileDocument,
  resume: LocalResumeDraft
): AiSafeResumeSnapshot => {
  const snapshot = createAiSafeResumeSnapshot(profile, resume);
  return { ...snapshot, credentials: [], education: [], experience: [], projects: [], skills: [], summary: snapshot.summary };
};

export const AI_PROHIBITED_PROFILE_KEYS = [
  'firstName', 'middleName', 'lastName', 'email', 'phone', 'address1', 'address2', 'city', 'state',
  'postalCode', 'country', 'webLinks', 'alternativeNames', 'applicationQuestions', 'governmentIdentifiers',
  'workAuthorizations', 'raceEthnicity', 'veteranStatus', 'disabilityStatus', 'reasonForLeaving',
  'supervisorName', 'mayContactSupervisor', 'companyPhone', 'projectUrl'
] as const;

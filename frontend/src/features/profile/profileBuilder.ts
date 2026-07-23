import {
  EMPTY_APPLICATION_QUESTIONS
} from './applicationQuestions';
import type {
  ApplicationQuestionsData,
  GovernmentIdentifier,
  WorkAuthorization
} from './applicationQuestions';
import type { EducationEntry } from '../../components/resume/EducationSection';
import type { CredentialEntry } from '../../components/resume/CredentialsSection';
import type { ExperienceEntry } from '../../components/resume/ExperienceSection';
import type { ProfileSectionData } from '../../components/resume/ProfileSection';
import type { ProjectEntry } from '../../components/resume/ProjectsSection';
import type { SkillEntry } from '../../components/resume/SkillsSection';
import { EMPTY_PROFILE_AUTOMATION_CONSENT } from './profileConsent';
import type { ProfileAutomationConsent } from './profileConsent';
import { apiRequest, ApiClientError } from '../api/localApiClient';
import { notifyDataChanged } from '../api/dataEvents';
import { isStoredPhoneNumber } from './phoneNumber';
import { getRichTextPlainText } from '../rich-text/richText';
export const PROFILE_BUILDER_SCHEMA_VERSION = 2;
export const PROFILE_DOCUMENT_FORMAT = 'applyfill.profile';

export const PROFILE_BUILDER_STEPS = [
  { id: 'introduction', label: 'Overview' },
  { id: 'resume-import', label: 'Resume Import' },
  { id: 'profile', label: 'Personal Info' },
  { id: 'education', label: 'Education' },
  { id: 'experience', label: 'Work Experience' },
  { id: 'credentials', label: 'Certifications & Licenses' },
  { id: 'projects', label: 'Projects' },
  { id: 'skills', label: 'Skills' },
  { id: 'application-questions', label: 'Application Questions' }
] as const;

export type ProfileBuilderData = {
  automationConsent: ProfileAutomationConsent;
  profile: ProfileSectionData;
  education: EducationEntry[];
  experience: ExperienceEntry[];
  credentials: CredentialEntry[];
  projects: ProjectEntry[];
  skills: SkillEntry[];
  applicationQuestions: ApplicationQuestionsData;
};

export type ProfileBuilderState = {
  activeStep: number;
  data: ProfileBuilderData;
  isComplete: boolean;
  schemaVersion: number;
};

export type LocalProfileDocument = {
  data: ProfileBuilderData;
  format: typeof PROFILE_DOCUMENT_FORMAT;
  isComplete: boolean;
  schemaVersion: typeof PROFILE_BUILDER_SCHEMA_VERSION;
  updatedAtUtc: string;
};

export type CurrentProfileResource = {
  document: LocalProfileDocument;
  id: string;
};

type ProfileResponse = {
  concurrencyToken: string;
  content: unknown;
  hasSensitiveApplicationData: boolean;
  id: string;
  schemaVersion: number;
  updatedAt: string;
};

type SensitiveApplicationDataResponse = { content: unknown };

let currentProfileId: string | null = null;
let currentProfileToken: string | null = null;

export const DEFAULT_PROFILE_SECTION_DATA: ProfileSectionData = {
  firstName: '', middleName: '', lastName: '', email: '', phone: '', alternativeNames: [],
  address1: '', address2: '', city: '', state: null, postalCode: '', country: null, webLinks: []
};

export const DEFAULT_PROFILE_BUILDER_DATA: ProfileBuilderData = {
  automationConsent: EMPTY_PROFILE_AUTOMATION_CONSENT,
  profile: DEFAULT_PROFILE_SECTION_DATA,
  education: [], experience: [], credentials: [], projects: [], skills: [],
  applicationQuestions: EMPTY_APPLICATION_QUESTIONS
};

export const createDefaultProfileBuilderState = (
  automationConsent: ProfileAutomationConsent = EMPTY_PROFILE_AUTOMATION_CONSENT
): ProfileBuilderState => ({
  activeStep: 0,
  data: {
    ...DEFAULT_PROFILE_BUILDER_DATA,
    automationConsent: { ...automationConsent },
    profile: { ...DEFAULT_PROFILE_SECTION_DATA },
    education: [],
    experience: [],
    credentials: [],
    projects: [],
    skills: [],
    applicationQuestions: {
      ...DEFAULT_PROFILE_BUILDER_DATA.applicationQuestions,
      governmentIdentifiers: [],
      workAuthorizations: []
    }
  },
  isComplete: false,
  schemaVersion: PROFILE_BUILDER_SCHEMA_VERSION
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const hasFields = (
  value: unknown,
  stringFields: string[],
  booleanFields: string[] = [],
  numberFields: string[] = []
): value is Record<string, unknown> => isRecord(value)
  && stringFields.every((field) => typeof value[field] === 'string')
  && booleanFields.every((field) => typeof value[field] === 'boolean')
  && numberFields.every((field) => typeof value[field] === 'number' && Number.isFinite(value[field]));

const isOption = (value: unknown) => value === null || hasFields(value, ['label', 'value']);
const isNullableString = (value: unknown) => value === null || typeof value === 'string';

const isValidGpaPair = (value: Record<string, unknown>) => {
  if (typeof value.gpa !== 'string' || typeof value.gpaScale !== 'string') return false;
  if (!value.gpa && !value.gpaScale) return true;
  if (!/^\d+\.\d{2}$/.test(value.gpa) || !/^\d+\.\d{2}$/.test(value.gpaScale)) return false;
  const gpa = Number(value.gpa);
  const scale = Number(value.gpaScale);
  return gpa >= 0 && scale > 0 && scale <= 100 && gpa <= scale;
};

const isEducation = (value: unknown) => hasFields(
  value,
  ['fieldOfStudy', 'provider', 'city', 'startDate', 'startDatePrecision', 'endDate', 'endDatePrecision', 'gpa', 'gpaScale', 'additionalDetails'],
  ['isRemote', 'isCurrentlyEnrolled', 'isEditing', 'isSaved'],
  ['id']
) && isOption(value.level) && isOption(value.country) && isOption(value.state) && isValidGpaPair(value);

const isExperience = (value: unknown) => hasFields(
  value,
  [
    'jobTitle', 'company', 'startDate', 'startDatePrecision', 'endDate', 'endDatePrecision',
    'address1', 'address2', 'city', 'postalCode', 'companyPhone', 'supervisorName',
    'description', 'reasonForLeaving', 'rewriteMessage', 'validationMessage'
  ],
  ['isCurrentJob', 'mayContactSupervisor', 'isEditing', 'isSaved'],
  ['id']
) && isOption(value.state) && isOption(value.country) && isStoredPhoneNumber(value.companyPhone as string);

const isCredential = (value: unknown) => hasFields(
  value,
  ['type', 'name', 'issuer', 'credentialId', 'credentialUrl', 'issueDate', 'expirationDate', 'details'],
  ['doesNotExpire'],
  ['id']
) && ['Certificate', 'Certification', 'License', 'Registration', 'Permit', 'Other'].includes(value.type as string);

const isProject = (value: unknown) => hasFields(
  value,
  [
    'name', 'role', 'organization', 'projectUrl', 'startDate', 'startDatePrecision',
    'endDate', 'endDatePrecision', 'description', 'rewriteMessage'
  ],
  ['isOngoing', 'isEditing', 'isSaved'],
  ['id']
) && isOption(value.projectType);

const isSkill = (value: unknown) => hasFields(value, ['name'], [], ['id'])
  && isNullableString(value.level);

const isAlternativeName = (value: unknown) => hasFields(value, ['name'], [], ['id'])
  && isOption(value.context);

const isWebLink = (value: unknown) => hasFields(value, ['name', 'url'], [], ['id']);

const isGovernmentIdentifier = (value: unknown): value is GovernmentIdentifier => hasFields(
  value,
  ['identifierType', 'value'],
  [],
  ['id']
) && typeof value.identifierType === 'string'
  && value.identifierType.trim().length > 0
  && value.identifierType.length <= 80
  && typeof value.value === 'string'
  && value.value.trim().length > 0
  && value.value.length <= 128
  && hasFields(value.country, ['label', 'value']);

const isApplicationAnswer = (value: unknown) => value === null
  || value === 'Yes'
  || value === 'No'
  || value === 'Unsure';

const isWorkAuthorization = (value: unknown): value is WorkAuthorization => hasFields(
  value,
  [],
  [],
  ['id']
) && hasFields(value.country, ['label', 'value'])
  && isApplicationAnswer(value.authorizedToWork)
  && isApplicationAnswer(value.requiresSponsorship);

export const isLocalProfileDocument = (value: unknown): value is LocalProfileDocument => {
  if (!isRecord(value)
    || value.format !== PROFILE_DOCUMENT_FORMAT
    || value.schemaVersion !== PROFILE_BUILDER_SCHEMA_VERSION
    || typeof value.updatedAtUtc !== 'string'
    || typeof value.isComplete !== 'boolean'
    || !isRecord(value.data)) return false;

  const data = value.data;
  if (!isRecord(data.profile)) return false;
  if (!isRecord(data.applicationQuestions)) return false;
  const profile = data.profile;
  const applicationQuestions = data.applicationQuestions;
  return isRecord(data.automationConsent)
    && (typeof data.automationConsent.acceptedAtUtc === 'string' || data.automationConsent.acceptedAtUtc === null)
    && typeof data.automationConsent.disclosureVersion === 'string'
    && ['firstName', 'middleName', 'lastName', 'email', 'phone', 'address1', 'address2', 'city', 'postalCode']
      .every((field) => typeof profile[field] === 'string')
    && isStoredPhoneNumber(profile.phone as string)
    && Array.isArray(profile.alternativeNames)
    && profile.alternativeNames.every(isAlternativeName)
    && Array.isArray(profile.webLinks)
    && profile.webLinks.every(isWebLink)
    && isOption(profile.state)
    && isOption(profile.country)
    && Array.isArray(data.education)
    && data.education.every(isEducation)
    && Array.isArray(data.experience)
    && data.experience.every(isExperience)
    && Array.isArray(data.credentials)
    && data.credentials.every(isCredential)
    && Array.isArray(data.projects)
    && data.projects.every(isProject)
    && Array.isArray(data.skills)
    && data.skills.every(isSkill)
    && ['raceEthnicity', 'veteranStatus', 'disabilityStatus']
      .every((field) => isNullableString(applicationQuestions[field]))
    && Array.isArray(applicationQuestions.governmentIdentifiers)
    && applicationQuestions.governmentIdentifiers.every(isGovernmentIdentifier)
    && Array.isArray(applicationQuestions.workAuthorizations)
    && applicationQuestions.workAuthorizations.every(isWorkAuthorization);
};

const toCredentialMonth = (value: unknown) => {
  if (typeof value !== 'string') return '';
  if (/^(?:19|20)\d{2}-(?:0[1-9]|1[0-2])$/.test(value)) return value;
  const match = /^(0[1-9]|1[0-2])\/(?:(?:0[1-9]|[12]\d|3[01])\/)?((?:19|20)\d{2})$/.exec(value);
  return match ? `${match[2]}-${match[1]}` : '';
};

const migrateProfileCredentials = (value: unknown): unknown => {
  if (!isRecord(value) || value.format !== PROFILE_DOCUMENT_FORMAT
    || value.schemaVersion !== PROFILE_BUILDER_SCHEMA_VERSION || !isRecord(value.data)) return value;
  const data = value.data;
  if ('credentials' in data && !Array.isArray(data.credentials)) return value;
  const education = Array.isArray(data.education) ? data.education : [];
  const certificateEntries = education.filter((entry) => isRecord(entry) && isRecord(entry.level)
    && (entry.level.value === 'Certificate' || entry.level.label === 'Certificate'));
  const credentials = Array.isArray(data.credentials) ? data.credentials : [];
  if (certificateEntries.length === 0 && Array.isArray(data.credentials)) return value;
  const existingIds = new Set(credentials.filter(isRecord).map((entry) => entry.id));
  return {
    ...value,
    data: {
      ...data,
      credentials: [
        ...credentials,
        ...certificateEntries.filter((entry) => !existingIds.has(entry.id)).map((entry) => ({
          id: entry.id,
          type: 'Certificate',
          name: typeof entry.fieldOfStudy === 'string' && entry.fieldOfStudy.trim()
            ? entry.fieldOfStudy.trim()
            : typeof entry.provider === 'string' ? entry.provider.trim() : 'Certificate',
          issuer: typeof entry.provider === 'string' ? entry.provider.trim() : '',
          credentialId: '',
          credentialUrl: '',
          issueDate: toCredentialMonth(entry.endDate || entry.startDate),
          expirationDate: '',
          doesNotExpire: false,
          details: getRichTextPlainText(entry.additionalDetails),
        })),
      ],
      education: education.filter((entry) => !certificateEntries.includes(entry)),
    },
  };
};

export const createLocalProfileDocument = (
  state: ProfileBuilderState,
  updatedAtUtc = new Date().toISOString()
): LocalProfileDocument => ({
  data: state.data,
  format: PROFILE_DOCUMENT_FORMAT,
  isComplete: state.isComplete,
  schemaVersion: PROFILE_BUILDER_SCHEMA_VERSION,
  updatedAtUtc
});

export const toProfileBuilderState = (document: LocalProfileDocument): ProfileBuilderState => ({
  activeStep: 0,
  data: document.data,
  isComplete: document.isComplete,
  schemaVersion: document.schemaVersion
});

export const loadCurrentProfileResource = async (): Promise<CurrentProfileResource | null> => {
  let response;
  try {
    response = await apiRequest<ProfileResponse>('/api/v1/profiles/current');
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      currentProfileId = null;
      currentProfileToken = null;
      return null;
    }
    throw error;
  }
  const value = migrateProfileCredentials(response.value.content);
  if (!isLocalProfileDocument(value)) throw new Error('The saved profile has an unsupported format.');
  let document = { ...value, updatedAtUtc: response.value.updatedAt };
  if (response.value.hasSensitiveApplicationData) {
    const sensitive = await apiRequest<SensitiveApplicationDataResponse>(
      '/api/v1/profiles/current/reveal-sensitive',
      { method: 'POST' },
      { sensitiveAction: 'reveal' },
    );
    if (typeof sensitive.value.content === 'object' && sensitive.value.content !== null) {
      document = {
        ...document,
        data: { ...document.data, applicationQuestions: sensitive.value.content as ApplicationQuestionsData },
      };
    }
  }
  if (!isLocalProfileDocument(document)) throw new Error('The saved profile has an unsupported format.');
  currentProfileId = response.value.id;
  currentProfileToken = response.value.concurrencyToken || response.etag;
  return { document, id: response.value.id };
};

export const loadProfileDocument = async (): Promise<LocalProfileDocument | null> => (
  (await loadCurrentProfileResource())?.document ?? null
);

export const loadProfileBuilderState = async (): Promise<ProfileBuilderState> => {
  const document = await loadProfileDocument();
  return document ? toProfileBuilderState(document) : createDefaultProfileBuilderState();
};

export const saveProfileBuilderState = async (state: ProfileBuilderState): Promise<LocalProfileDocument> => {
  const document = createLocalProfileDocument(state);
  return saveProfileDocument(document);
};

export const parseProfileDocument = (json: string): LocalProfileDocument => {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error('Choose a valid JSON file.');
  }
  value = migrateProfileCredentials(value);
  if (!isLocalProfileDocument(value)) {
    throw new Error(`This is not an ApplyFill profile schema version ${PROFILE_BUILDER_SCHEMA_VERSION} document.`);
  }
  return value;
};

export const saveProfileDocument = async (document: LocalProfileDocument): Promise<LocalProfileDocument> => {
  const savedDocument = {
    ...document,
    updatedAtUtc: new Date().toISOString()
  };
  if (currentProfileId === null && currentProfileToken === null) await loadCurrentProfileResource();
  const publicDocument: LocalProfileDocument = {
    ...savedDocument,
    data: {
      ...savedDocument.data,
      applicationQuestions: structuredClone(EMPTY_APPLICATION_QUESTIONS),
    },
  };
  const response = await apiRequest<ProfileResponse>('/api/v1/profiles/current', {
    body: JSON.stringify({
      content: publicDocument,
      schemaVersion: PROFILE_BUILDER_SCHEMA_VERSION,
      sensitiveApplicationData: savedDocument.data.applicationQuestions,
    }),
    method: 'PUT',
  }, currentProfileToken ? { concurrencyToken: currentProfileToken } : {});
  currentProfileId = response.value.id;
  currentProfileToken = response.value.concurrencyToken || response.etag;
  notifyDataChanged('profile');
  return { ...savedDocument, updatedAtUtc: response.value.updatedAt };
};

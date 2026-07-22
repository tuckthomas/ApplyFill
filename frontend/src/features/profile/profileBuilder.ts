import {
  EMPTY_APPLICATION_QUESTIONS
} from './applicationQuestions';
import type {
  ApplicationQuestionsData,
  GovernmentIdentifier,
  WorkAuthorization
} from './applicationQuestions';
import type { EducationEntry } from '../../components/resume/EducationSection';
import type { ExperienceEntry } from '../../components/resume/ExperienceSection';
import type { ProfileSectionData } from '../../components/resume/ProfileSection';
import type { ProjectEntry } from '../../components/resume/ProjectsSection';
import type { SkillEntry } from '../../components/resume/SkillsSection';
import { EMPTY_PROFILE_AUTOMATION_CONSENT } from './profileConsent';
import type { ProfileAutomationConsent } from './profileConsent';
import { LOCAL_DATA_KEYS, readLocalDocument, writeLocalDocument } from '../storage/localDatabase';
import { isStoredPhoneNumber } from './phoneNumber';
export const PROFILE_BUILDER_SCHEMA_VERSION = 2;
export const PROFILE_DOCUMENT_FORMAT = 'applyfill.profile';

export const PROFILE_BUILDER_STEPS = [
  { id: 'introduction', label: 'Overview' },
  { id: 'profile', label: 'Personal Info' },
  { id: 'education', label: 'Education' },
  { id: 'experience', label: 'Work Experience' },
  { id: 'projects', label: 'Projects' },
  { id: 'skills', label: 'Skills' },
  { id: 'application-questions', label: 'Application Questions' }
] as const;

export type ProfileBuilderData = {
  automationConsent: ProfileAutomationConsent;
  profile: ProfileSectionData;
  education: EducationEntry[];
  experience: ExperienceEntry[];
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

export const DEFAULT_PROFILE_SECTION_DATA: ProfileSectionData = {
  firstName: '', middleName: '', lastName: '', email: '', phone: '', alternativeNames: [],
  address1: '', address2: '', city: '', state: null, postalCode: '', country: null, webLinks: []
};

export const DEFAULT_PROFILE_BUILDER_DATA: ProfileBuilderData = {
  automationConsent: EMPTY_PROFILE_AUTOMATION_CONSENT,
  profile: DEFAULT_PROFILE_SECTION_DATA,
  education: [], experience: [], projects: [], skills: [],
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

export const loadProfileDocument = async (): Promise<LocalProfileDocument | null> => {
  const value = await readLocalDocument<unknown>(LOCAL_DATA_KEYS.profile);
  if (value === null) return null;
  if (!isLocalProfileDocument(value)) throw new Error('The locally stored profile has an unsupported format.');
  return value;
};

export const loadProfileBuilderState = async (): Promise<ProfileBuilderState> => {
  const document = await loadProfileDocument();
  return document ? toProfileBuilderState(document) : createDefaultProfileBuilderState();
};

export const saveProfileBuilderState = async (state: ProfileBuilderState): Promise<LocalProfileDocument> => {
  const document = createLocalProfileDocument(state);
  await writeLocalDocument(LOCAL_DATA_KEYS.profile, document);
  return document;
};

export const parseProfileDocument = (json: string): LocalProfileDocument => {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error('Choose a valid JSON file.');
  }
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
  await writeLocalDocument(LOCAL_DATA_KEYS.profile, savedDocument);
  return savedDocument;
};

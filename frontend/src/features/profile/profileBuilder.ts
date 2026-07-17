import type { ApplicationQuestionsData } from '../../components/resume/ApplicationQuestionsSection';
import type { EducationEntry } from '../../components/resume/EducationSection';
import type { ExperienceEntry } from '../../components/resume/ExperienceSection';
import type { ProfileSectionData } from '../../components/resume/ProfileSection';
import type { ProjectEntry } from '../../components/resume/ProjectsSection';
import type { SkillEntry } from '../../components/resume/SkillsSection';
import { EMPTY_PROFILE_AUTOMATION_CONSENT, hasCurrentProfileAutomationConsent } from './profileConsent';
import type { ProfileAutomationConsent } from './profileConsent';
import { normalizeRichText } from '../rich-text/richText';

export const PROFILE_BUILDER_STORAGE_KEY = 'applyfill.profile-builder.v1';
export const PROFILE_BUILDER_SCHEMA_VERSION = 3;

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

export const DEFAULT_PROFILE_SECTION_DATA: ProfileSectionData = {
  firstName: '', middleName: '', lastName: '', email: '', phone: '', alternativeNames: [],
  address1: '', address2: '', city: '', state: null, postalCode: '', country: null, webLinks: []
};

export const DEFAULT_PROFILE_BUILDER_DATA: ProfileBuilderData = {
  automationConsent: EMPTY_PROFILE_AUTOMATION_CONSENT,
  profile: DEFAULT_PROFILE_SECTION_DATA,
  education: [], experience: [], projects: [], skills: [],
  applicationQuestions: { raceEthnicity: null, veteranStatus: null, disabilityStatus: null }
};

const DEFAULT_PROFILE_BUILDER_STATE: ProfileBuilderState = {
  activeStep: 0,
  data: DEFAULT_PROFILE_BUILDER_DATA,
  isComplete: false,
  schemaVersion: PROFILE_BUILDER_SCHEMA_VERSION
};

const normalizeProfileBuilderData = (data: Partial<ProfileBuilderData> | undefined): ProfileBuilderData => ({
  automationConsent: {
    ...EMPTY_PROFILE_AUTOMATION_CONSENT,
    ...(data?.automationConsent ?? {})
  },
  profile: {
    ...DEFAULT_PROFILE_SECTION_DATA,
    ...(data?.profile ?? {}),
    alternativeNames: (data?.profile?.alternativeNames ?? []).filter((name) => name.name.trim()),
    webLinks: (data?.profile?.webLinks ?? []).filter((link) => link.name.trim() || link.url.trim())
  },
  education: data?.education ?? [],
  experience: (data?.experience ?? []).map((entry) => ({
    ...entry,
    description: normalizeRichText(entry.description),
    reasonForLeaving: normalizeRichText(entry.reasonForLeaving)
  })),
  projects: (data?.projects ?? []).map((entry) => ({ ...entry, description: normalizeRichText(entry.description) })),
  skills: data?.skills ?? [],
  applicationQuestions: { ...DEFAULT_PROFILE_BUILDER_DATA.applicationQuestions, ...(data?.applicationQuestions ?? {}) }
});

export const loadProfileBuilderState = (): ProfileBuilderState => {
  if (typeof window === 'undefined') return DEFAULT_PROFILE_BUILDER_STATE;

  try {
    const storedValue = window.localStorage.getItem(PROFILE_BUILDER_STORAGE_KEY);
    if (!storedValue) return DEFAULT_PROFILE_BUILDER_STATE;

    const parsed = JSON.parse(storedValue) as Partial<ProfileBuilderState>;
    const storedStep = parsed.activeStep ?? 0;
    const storedSchemaVersion = parsed.schemaVersion ?? 1;
    const isPreProjectsState = parsed.data !== undefined && !Object.prototype.hasOwnProperty.call(parsed.data, 'projects');
    const hasLegacySummary = parsed.data !== undefined && Object.prototype.hasOwnProperty.call(parsed.data, 'summary');
    let migratedStep = isPreProjectsState && storedStep >= 4 ? storedStep + 1 : storedStep;
    if (hasLegacySummary && migratedStep >= 3) migratedStep -= 1;
    if (storedSchemaVersion < 2) migratedStep += 1;

    const normalizedData = normalizeProfileBuilderData(parsed.data);

    return {
      activeStep: hasCurrentProfileAutomationConsent(normalizedData.automationConsent) && Number.isInteger(storedStep)
        ? Math.min(Math.max(migratedStep, 0), PROFILE_BUILDER_STEPS.length - 1)
        : 0,
      data: normalizedData,
      isComplete: parsed.isComplete === true,
      schemaVersion: PROFILE_BUILDER_SCHEMA_VERSION
    };
  } catch {
    return DEFAULT_PROFILE_BUILDER_STATE;
  }
};

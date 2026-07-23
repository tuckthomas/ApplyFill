import type { LocalProfileDocument } from '../profile/profileBuilder';
import { formatPhoneNumber } from '../profile/phoneNumber';
import { getRichTextPlainText } from '../rich-text/richText';
import type { LocalResumeDraft } from './resumeDocument';

export type ResumeSafeExperience = {
  company: string;
  dateRange: string;
  details: string[];
  employmentGroupId: number;
  jobTitle: string;
  location: string;
};

export type ResumeSafeEducation = {
  credential: string;
  dateRange: string;
  details: string[];
  fieldOfStudy: string;
  gpa: string;
  location: string;
  provider: string;
};

export type ResumeSafeCredential = {
  credentialId: string;
  credentialUrl: string;
  dateRange: string;
  details: string[];
  issuer: string;
  name: string;
  type: string;
};

export type ResumeSafeProject = {
  dateRange: string;
  details: string[];
  name: string;
  organization: string;
  projectType: string;
  projectUrl: string;
  role: string;
};

export type ResumeSafeViewModel = {
  contact: {
    email: string;
    links: Array<{ label: string; url: string }>;
    location: string;
    name: string;
    phone: string;
  };
  education: ResumeSafeEducation[];
  credentials: ResumeSafeCredential[];
  experience: ResumeSafeExperience[];
  projects: ResumeSafeProject[];
  skills: string[];
  summary: string;
  title: string;
};

export const groupResumeExperience = (entries: ResumeSafeExperience[]) => (
  entries.reduce<ResumeSafeExperience[][]>((groups, entry) => {
    const group = groups.find((roles) => roles[0]?.employmentGroupId === entry.employmentGroupId);
    if (group) group.push(entry);
    else groups.push([entry]);
    return groups;
  }, [])
);

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatResumeDate = (value: string) => {
  if (!value.trim()) return '';
  const match = /^(?:(\d{4})-(\d{2})(?:-\d{2})?|(\d{2})\/\d{2}\/(\d{4}))$/.exec(value.trim());
  if (!match) return value.trim();
  const year = match[1] ?? match[4];
  const month = Number(match[2] ?? match[3]);
  return month >= 1 && month <= 12 ? `${monthNames[month - 1]} ${year}` : year;
};

const formatDateRange = (start: string, end: string, isCurrent: boolean) => (
  [formatResumeDate(start), isCurrent ? 'Present' : formatResumeDate(end)].filter(Boolean).join(' – ')
);

const formatLocation = (...parts: Array<string | null | undefined>) => (
  parts.map((part) => part?.trim()).filter(Boolean).join(', ')
);

const toDetailLines = (value: unknown) => getRichTextPlainText(value)
  .split(/\n+/)
  .map((line) => line.replace(/^[-•]\s*/, '').trim())
  .filter(Boolean);

const safeHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
};

export const createResumeSafeViewModel = (
  profileDocument: LocalProfileDocument,
  resume: LocalResumeDraft
): ResumeSafeViewModel => {
  const { profile, education, experience, projects, skills } = profileDocument.data;
  const credentials = profileDocument.data.credentials ?? [];
  const selectedCredentials = new Set(resume.selections.credentialIds);
  const selectedEducation = new Set(resume.selections.educationIds);
  const selectedExperience = new Set(resume.selections.experienceIds);
  const selectedProjects = new Set(resume.selections.projectIds);
  const selectedSkills = new Set(resume.selections.skillIds);

  return {
    contact: {
      email: profile.email.trim(),
      links: profile.webLinks
        .map((link) => ({ label: link.name.trim(), url: safeHttpUrl(link.url.trim()) }))
        .filter((link) => link.label && link.url),
      location: formatLocation(profile.city, profile.state?.label, profile.country?.label),
      name: [profile.firstName, profile.middleName, profile.lastName].map((part) => part.trim()).filter(Boolean).join(' '),
      phone: formatPhoneNumber(profile.phone)
    },
    education: education.filter((entry) => selectedEducation.has(entry.id) && entry.isSaved).map((entry) => ({
      credential: entry.level?.label.trim() ?? '',
      dateRange: formatDateRange(entry.startDate, entry.endDate, entry.isCurrentlyEnrolled),
      details: toDetailLines(entry.additionalDetails),
      fieldOfStudy: entry.fieldOfStudy.trim(),
      gpa: entry.gpa && entry.gpaScale ? `${entry.gpa}/${entry.gpaScale}` : '',
      location: entry.isRemote ? 'Remote' : formatLocation(entry.city, entry.state?.label, entry.country?.label),
      provider: entry.provider.trim()
    })),
    credentials: credentials.filter((entry) => selectedCredentials.has(entry.id)).map((entry) => ({
      credentialId: entry.credentialId.trim(),
      credentialUrl: safeHttpUrl(entry.credentialUrl.trim()),
      dateRange: formatDateRange(entry.issueDate, entry.expirationDate, entry.doesNotExpire),
      details: entry.details.split(/\n+/).map((line) => line.trim()).filter(Boolean),
      issuer: entry.issuer.trim(),
      name: entry.name.trim(),
      type: entry.type,
    })),
    experience: experience.filter((entry) => selectedExperience.has(entry.id) && entry.isSaved).map((entry) => ({
      company: entry.company.trim(),
      dateRange: formatDateRange(entry.startDate, entry.endDate, entry.isCurrentJob),
      details: resume.contentOverrides?.experienceDetails[String(entry.id)] ?? toDetailLines(entry.description),
      employmentGroupId: entry.employmentGroupId,
      jobTitle: entry.jobTitle.trim(),
      location: formatLocation(entry.city, entry.state?.label, entry.country?.label)
    })),
    projects: projects.filter((entry) => selectedProjects.has(entry.id) && entry.isSaved).map((entry) => ({
      dateRange: formatDateRange(entry.startDate, entry.endDate, entry.isOngoing),
      details: resume.contentOverrides?.projectDetails[String(entry.id)] ?? toDetailLines(entry.description),
      name: entry.name.trim(),
      organization: entry.organization.trim(),
      projectType: entry.projectType?.label.trim() ?? '',
      projectUrl: safeHttpUrl(entry.projectUrl.trim()),
      role: entry.role.trim()
    })),
    skills: skills.filter((entry) => selectedSkills.has(entry.id)).map((entry) => entry.name.trim()).filter(Boolean),
    summary: resume.summary.trim(),
    title: resume.targetRole.trim()
  };
};

import { formatExactDateValue, normalizeExactDateValue } from '../ui/datePickerUtils';
import type { LocationOption } from '../../constants/location';
import { EMPTY_RICH_TEXT_VALUE, normalizeRichText } from '../../features/rich-text/richText';
import { apiRequest } from '../../features/api/localApiClient';
import { notifyDataChanged } from '../../features/api/dataEvents';

export type JobApplicationStatus = 'Saved' | 'Applied' | 'Interviewing' | 'Offer Received' | 'Rejected' | 'Withdrawn';
export type JobApplicationWorkplaceType = 'On-site' | 'Hybrid' | 'Remote';

export type JobApplicationFormState = {
  companyId: string;
  credentialId: string;
  companyName: string;
  jobTitle: string;
  workplaceType: JobApplicationWorkplaceType | null;
  location: string;
  city: string;
  state: LocationOption | null;
  country: LocationOption | null;
  targetJobUrl: string;
  jobDescription: string;
  status: JobApplicationStatus;
  appliedDate: string;
  notes: string;
};

export type JobApplication = JobApplicationFormState & { id: string };

export type StatusOption = { value: JobApplicationStatus; label: string };
export type WorkplaceTypeOption = { value: JobApplicationWorkplaceType; label: string };

type JobApplicationResponse = {
  companyId?: string;
  company: string;
  concurrencyToken: string;
  createdAt: string;
  details: unknown;
  id: string;
  jobTitle: string;
  status: number | string;
  targetUrl: string;
  updatedAt: string;
};

const applicationTokens = new Map<string, string>();

const backendStatus = (status: JobApplicationStatus) => ({
  Applied: 2,
  Interviewing: 3,
  'Offer Received': 4,
  Rejected: 6,
  Saved: 0,
  Withdrawn: 7,
}[status]);

const frontendStatus = (status: number | string): JobApplicationStatus => {
  if (status === 2 || status === 'Applied') return 'Applied';
  if (status === 3 || status === 'Interviewing') return 'Interviewing';
  if ([4, 5, 'Offered', 'Accepted'].includes(status)) return 'Offer Received';
  if (status === 6 || status === 'Rejected') return 'Rejected';
  if ([7, 8, 'Withdrawn', 'Archived'].includes(status)) return 'Withdrawn';
  return 'Saved';
};

export const STATUS_OPTIONS: StatusOption[] = [
  { value: 'Saved', label: 'Saved' },
  { value: 'Applied', label: 'Applied' },
  { value: 'Interviewing', label: 'Interviewing' },
  { value: 'Offer Received', label: 'Offer Received' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Withdrawn', label: 'Withdrawn' }
];

export const WORKPLACE_TYPE_OPTIONS: WorkplaceTypeOption[] = [
  { value: 'On-site', label: 'On-site' },
  { value: 'Hybrid', label: 'Hybrid' },
  { value: 'Remote', label: 'Remote' }
];

export const getStatusOption = (value: JobApplicationStatus) => (
  STATUS_OPTIONS.find((option) => option.value === value) ?? STATUS_OPTIONS[0]
);

export const getWorkplaceTypeOption = (value: JobApplicationWorkplaceType | null) => (
  WORKPLACE_TYPE_OPTIONS.find((option) => option.value === value) ?? null
);

export const formatJobApplicationLocation = (
  value: Pick<JobApplicationFormState, 'city' | 'state' | 'country' | 'location' | 'workplaceType'>
) => {
  const structuredLocation = [value.city.trim(), value.state?.value, value.country?.value]
    .filter(Boolean)
    .join(', ');

  if (structuredLocation) return structuredLocation;
  if (value.workplaceType === 'Remote') return 'Remote';
  return value.location.trim();
};

export const createEmptyApplicationForm = (defaultCountry: LocationOption | null = null): JobApplicationFormState => ({
  companyId: '',
  credentialId: '',
  companyName: '',
  jobTitle: '',
  workplaceType: null,
  location: '',
  city: '',
  state: null,
  country: defaultCountry ? { ...defaultCountry } : null,
  targetJobUrl: '',
  jobDescription: EMPTY_RICH_TEXT_VALUE,
  status: 'Applied',
  appliedDate: formatExactDateValue(new Date()),
  notes: EMPTY_RICH_TEXT_VALUE
});

export const loadApplications = async (): Promise<JobApplication[]> => {
  const response = await apiRequest<JobApplicationResponse[]>('/api/v1/job-applications?skip=0&take=100');
  return response.value.map((item) => {
    const value = typeof item.details === 'object' && item.details !== null
      ? item.details as Partial<JobApplication>
      : {};
    applicationTokens.set(item.id, item.concurrencyToken);
    return {
      ...createEmptyApplicationForm(),
      ...value,
      appliedDate: normalizeExactDateValue(value.appliedDate ?? ''),
      city: value.city ?? '',
      companyId: item.companyId ?? value.companyId ?? '',
      companyName: item.company,
      country: value.country ?? null,
      id: item.id,
      jobDescription: normalizeRichText(value.jobDescription ?? EMPTY_RICH_TEXT_VALUE),
      jobTitle: item.jobTitle,
      location: value.location ?? '',
      notes: normalizeRichText(value.notes ?? EMPTY_RICH_TEXT_VALUE),
      state: value.state ?? null,
      status: frontendStatus(item.status),
      targetJobUrl: item.targetUrl,
      workplaceType: value.workplaceType ?? null,
    };
  });
};

const saveOneApplication = async (application: JobApplication): Promise<JobApplication> => {
  if (!application.targetJobUrl.trim()) throw new Error('A job posting or application URL is required.');
  const token = applicationTokens.get(application.id);
  const response = await apiRequest<JobApplicationResponse>(token
    ? `/api/v1/job-applications/${encodeURIComponent(application.id)}`
    : '/api/v1/job-applications', {
    body: JSON.stringify({
      company: application.companyName,
      details: application,
      jobTitle: application.jobTitle,
      status: backendStatus(application.status),
      targetUrl: application.targetJobUrl,
    }),
    method: token ? 'PUT' : 'POST',
  }, token ? { concurrencyToken: token } : {});
  applicationTokens.set(response.value.id, response.value.concurrencyToken || response.etag || '');
  return {
    ...application,
    companyId: response.value.companyId ?? '',
    companyName: response.value.company,
    id: response.value.id,
  };
};

export const saveApplications = async (applications: JobApplication[]): Promise<JobApplication[]> => {
  const existing = await loadApplications();
  const desiredIds = new Set(applications.map((application) => application.id));
  for (const removed of existing.filter((application) => !desiredIds.has(application.id))) {
    const token = applicationTokens.get(removed.id);
    if (token) {
      await apiRequest<void>(`/api/v1/job-applications/${encodeURIComponent(removed.id)}`, { method: 'DELETE' }, { concurrencyToken: token });
      applicationTokens.delete(removed.id);
    }
  }

  const persisted: JobApplication[] = [];
  for (const application of applications) {
    const stored = existing.find((item) => item.id === application.id);
    persisted.push(stored && JSON.stringify(stored) === JSON.stringify(application)
      ? stored
      : await saveOneApplication(application));
  }
  notifyDataChanged('applications');
  return persisted;
};

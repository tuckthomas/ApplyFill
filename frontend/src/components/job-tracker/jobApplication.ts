import { formatExactDateValue, normalizeExactDateValue } from '../ui/datePickerUtils';
import type { LocationOption } from '../../constants/location';

export type JobApplicationStatus = 'Saved' | 'Applied' | 'Interviewing' | 'Offer Received' | 'Rejected' | 'Withdrawn';
export type JobApplicationWorkplaceType = 'On-site' | 'Hybrid' | 'Remote';

export type JobApplicationFormState = {
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

export const JOB_TRACKER_STORAGE_KEY = 'applyfill.job-tracker.v1';

export type StatusOption = { value: JobApplicationStatus; label: string };
export type WorkplaceTypeOption = { value: JobApplicationWorkplaceType; label: string };

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
  companyName: '',
  jobTitle: '',
  workplaceType: null,
  location: '',
  city: '',
  state: null,
  country: defaultCountry ? { ...defaultCountry } : null,
  targetJobUrl: '',
  jobDescription: '',
  status: 'Applied',
  appliedDate: formatExactDateValue(new Date()),
  notes: ''
});

export const loadApplications = (): JobApplication[] => {
  if (typeof window === 'undefined') return [];

  try {
    const storedValue = window.localStorage.getItem(JOB_TRACKER_STORAGE_KEY);
    if (!storedValue) return [];

    const parsed = JSON.parse(storedValue) as JobApplication[];
    return Array.isArray(parsed)
      ? parsed.map((application) => ({
        ...application,
        appliedDate: normalizeExactDateValue(application.appliedDate),
        jobDescription: application.jobDescription ?? '',
        workplaceType: application.workplaceType ?? null,
        location: application.location ?? '',
        city: application.city ?? '',
        state: application.state ?? null,
        country: application.country ?? null
      }))
      : [];
  } catch {
    return [];
  }
};

export const saveApplications = (applications: JobApplication[]) => {
  window.localStorage.setItem(JOB_TRACKER_STORAGE_KEY, JSON.stringify(applications));
};

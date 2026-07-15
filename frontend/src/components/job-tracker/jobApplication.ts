import { formatExactDateValue, normalizeExactDateValue } from '../ui/datePickerUtils';

export type JobApplicationStatus = 'Saved' | 'Applied' | 'Interviewing' | 'Offer Received' | 'Rejected' | 'Withdrawn';

export type JobApplicationFormState = {
  companyName: string;
  jobTitle: string;
  location: string;
  targetJobUrl: string;
  jobDescription: string;
  status: JobApplicationStatus;
  appliedDate: string;
  notes: string;
};

export type JobApplication = JobApplicationFormState & { id: string };

export const JOB_TRACKER_STORAGE_KEY = 'applyfill.job-tracker.v1';

export type StatusOption = { value: JobApplicationStatus; label: string };

export const STATUS_OPTIONS: StatusOption[] = [
  { value: 'Saved', label: 'Saved' },
  { value: 'Applied', label: 'Applied' },
  { value: 'Interviewing', label: 'Interviewing' },
  { value: 'Offer Received', label: 'Offer Received' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Withdrawn', label: 'Withdrawn' }
];

export const getStatusOption = (value: JobApplicationStatus) => (
  STATUS_OPTIONS.find((option) => option.value === value) ?? STATUS_OPTIONS[0]
);

export const createEmptyApplicationForm = (): JobApplicationFormState => ({
  companyName: '',
  jobTitle: '',
  location: '',
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
        jobDescription: application.jobDescription ?? ''
      }))
      : [];
  } catch {
    return [];
  }
};

export const saveApplications = (applications: JobApplication[]) => {
  window.localStorage.setItem(JOB_TRACKER_STORAGE_KEY, JSON.stringify(applications));
};

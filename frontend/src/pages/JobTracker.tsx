import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Select from '../components/ui/AppSelect';
import { ExternalLink, Trash2 } from 'lucide-react';
import { selectStyles } from '../constants/location';
import RichTextEditor from '../components/resume/RichTextEditor';
import DatePicker from '../components/ui/DatePicker';
import AddButton from '../components/ui/AddButton';
import FormModal from '../components/ui/FormModal';
import { formatExactDateValue, normalizeExactDateValue } from '../components/ui/datePickerUtils';

const JOB_TRACKER_STORAGE_KEY = 'applyfill.job-tracker.v1';
type StatusOption = {
  value: JobApplicationStatus;
  label: string;
};

type JobApplicationStatus = 'Saved' | 'Applied' | 'Interviewing' | 'Offer Received' | 'Rejected' | 'Withdrawn';

type JobApplication = {
  id: string;
  companyName: string;
  jobTitle: string;
  location: string;
  targetJobUrl: string;
  status: JobApplicationStatus;
  appliedDate: string;
  notes: string;
};

type ApplicationFormState = Omit<JobApplication, 'id'>;

const STATUS_OPTIONS: StatusOption[] = [
  { value: 'Saved', label: 'Saved' },
  { value: 'Applied', label: 'Applied' },
  { value: 'Interviewing', label: 'Interviewing' },
  { value: 'Offer Received', label: 'Offer Received' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Withdrawn', label: 'Withdrawn' }
];

const createEmptyForm = (): ApplicationFormState => ({
  companyName: '',
  jobTitle: '',
  location: '',
  targetJobUrl: '',
  status: 'Applied',
  appliedDate: formatExactDateValue(new Date()),
  notes: ''
});

const loadApplications = (): JobApplication[] => {
  if (typeof window === 'undefined') return [];

  try {
    const storedValue = window.localStorage.getItem(JOB_TRACKER_STORAGE_KEY);
    if (!storedValue) return [];

    const parsed = JSON.parse(storedValue) as JobApplication[];
    return Array.isArray(parsed)
      ? parsed.map((application) => ({
        ...application,
        appliedDate: normalizeExactDateValue(application.appliedDate)
      }))
      : [];
  } catch {
    return [];
  }
};

const formatDate = (value: string) => {
  if (!value) return 'Not recorded';

  const [month, day, year] = normalizeExactDateValue(value).split('/').map(Number);
  if (!month || !day || !year) return 'Not recorded';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(year, month - 1, day));
};

const getStatusOption = (value: JobApplicationStatus) => (
  STATUS_OPTIONS.find((option) => option.value === value) ?? STATUS_OPTIONS[0]
);

const getNotePreview = (value: string) => {
  if (!value) return '';

  const document = new DOMParser().parseFromString(value, 'text/html');
  return document.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
};

export default function JobTracker() {
  const [applications, setApplications] = useState<JobApplication[]>(loadApplications);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formState, setFormState] = useState<ApplicationFormState>(createEmptyForm);
  const [formError, setFormError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobApplicationStatus | 'All'>('All');
  const openForm = () => {
    setFormError('');
    setFormState(createEmptyForm());
    setIsFormOpen(true);
  };

  const closeForm = useCallback(() => {
    setFormError('');
    setIsFormOpen(false);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(JOB_TRACKER_STORAGE_KEY, JSON.stringify(applications));
  }, [applications]);

  const filteredApplications = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return applications
      .filter((application) => statusFilter === 'All' || application.status === statusFilter)
      .filter((application) => {
        if (!normalizedQuery) return true;

        return [application.companyName, application.jobTitle, application.location]
          .some((value) => value.toLowerCase().includes(normalizedQuery));
      })
      .sort((a, b) => b.appliedDate.localeCompare(a.appliedDate));
  }, [applications, searchQuery, statusFilter]);

  const updateFormField = <Key extends keyof ApplicationFormState>(
    key: Key,
    value: ApplicationFormState[Key]
  ) => {
    setFormState((current) => ({ ...current, [key]: value }));
  };

  const addApplication = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formState.companyName.trim() || !formState.jobTitle.trim()) {
      setFormError('Company and job title are required.');
      return;
    }

    const application: JobApplication = {
      ...formState,
      id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      companyName: formState.companyName.trim(),
      jobTitle: formState.jobTitle.trim(),
      location: formState.location.trim(),
      targetJobUrl: formState.targetJobUrl.trim(),
      notes: formState.notes.trim()
    };

    setApplications((current) => [...current, application]);
    closeForm();
  };

  const updateApplicationStatus = (id: string, status: JobApplicationStatus) => {
    setApplications((current) => current.map((application) => (
      application.id === id ? { ...application, status } : application
    )));
  };

  const removeApplication = (id: string) => {
    setApplications((current) => current.filter((application) => application.id !== id));
  };

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h2 className="page-title">Job Tracker</h2>
          <p className="page-copy">Keep a clear record of applications, interviews, offers, and outcomes.</p>
        </div>
        <AddButton onClick={openForm}>Add Application</AddButton>
      </header>

      <FormModal
        className="tracker-modal-dialog"
        closeLabel="Close add application"
        description="Capture the application once so it can later connect to resumes and application packets."
        dirtyKey={JSON.stringify(formState)}
        initialFocusId="tracker-company"
        isOpen={isFormOpen}
        onClose={closeForm}
        title="Add application"
      >
        <form className="tracker-form-grid" onSubmit={addApplication}>
              <div className="form-group">
                <label className="form-label" htmlFor="tracker-company">Company *</label>
                <input
                  id="tracker-company"
                  className="form-input"
                  type="text"
                  value={formState.companyName}
                  onChange={(event) => updateFormField('companyName', event.target.value)}
                  autoComplete="organization"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="tracker-job-title">Job title *</label>
                <input
                  id="tracker-job-title"
                  className="form-input"
                  type="text"
                  value={formState.jobTitle}
                  onChange={(event) => updateFormField('jobTitle', event.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="tracker-location">Location</label>
                <input
                  id="tracker-location"
                  className="form-input"
                  type="text"
                  placeholder="City, State or Remote"
                  value={formState.location}
                  onChange={(event) => updateFormField('location', event.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="tracker-status">Status</label>
                <Select
                  inputId="tracker-status"
                  options={STATUS_OPTIONS}
                  styles={selectStyles}
                  value={getStatusOption(formState.status)}
                  onChange={(option) => updateFormField('status', (option as StatusOption).value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="tracker-applied-date">Application date</label>
                <DatePicker
                  id="tracker-applied-date"
                  ariaLabel="Application date"
                  precision="Exact"
                  value={formState.appliedDate}
                  onChange={(value) => updateFormField('appliedDate', value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="tracker-job-url">Job posting URL</label>
                <input
                  id="tracker-job-url"
                  className="form-input"
                  type="url"
                  placeholder="https://..."
                  value={formState.targetJobUrl}
                  onChange={(event) => updateFormField('targetJobUrl', event.target.value)}
                />
              </div>
              <div className="tracker-form-full-width">
                <RichTextEditor
                  label="Notes"
                  labelId="tracker-notes-label"
                  toolbarId="tracker-notes-toolbar"
                  value={formState.notes}
                  onChange={(value) => updateFormField('notes', value)}
                  placeholder="Recruiter name, next steps, or other reminders"
                  quillClassName="rich-text-quill-tracker"
                />
              </div>
              {formError && <p className="form-error-message tracker-form-full-width" role="alert">{formError}</p>}
              <div className="toolbar-row tracker-form-actions tracker-form-full-width">
                <span className="section-copy">Required fields are marked with an asterisk.</span>
                <div className="modal-form-actions">
                  <button className="btn btn-secondary" data-modal-close type="button" onClick={closeForm}>Cancel</button>
                  <button className="btn btn-primary" type="submit">Save Application</button>
                </div>
              </div>
        </form>
      </FormModal>

      <section className="surface-panel tracker-list-panel" aria-labelledby="tracked-applications-title">
        <div className="toolbar-row tracker-list-header">
          <div>
            <h3 id="tracked-applications-title" className="section-title">Tracked applications</h3>
            <p className="section-copy">Update a status as your search progresses.</p>
          </div>
          <div className="tracker-filters">
            <label className="sr-only" htmlFor="tracker-search">Search applications</label>
            <input
              id="tracker-search"
              className="form-input tracker-search-input"
              type="search"
              placeholder="Search company or role"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <label className="sr-only" htmlFor="tracker-status-filter">Filter by status</label>
            <Select
              inputId="tracker-status-filter"
              options={[{ value: 'All', label: 'All statuses' }, ...STATUS_OPTIONS]}
              styles={selectStyles}
              value={statusFilter === 'All' ? { value: 'All', label: 'All statuses' } : getStatusOption(statusFilter)}
              onChange={(option) => setStatusFilter((option as { value: JobApplicationStatus | 'All' }).value)}
              isSearchable={false}
            />
          </div>
        </div>

        {applications.length === 0 ? (
          <div className="empty-state tracker-empty-state">
            <h3 className="section-title">No applications tracked</h3>
            <p className="section-copy" style={{ maxWidth: '420px' }}>
              Add an application to start tracking your job search in one place.
            </p>
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="empty-state tracker-filter-empty">
            <h3 className="section-title">No matching applications</h3>
            <p className="section-copy">Adjust the search or status filter to see other applications.</p>
          </div>
        ) : (
          <div className="tracker-table-wrap">
            <table className="tracker-table">
              <caption className="sr-only">Tracked job applications</caption>
              <thead>
                <tr>
                  <th scope="col">Role</th>
                  <th scope="col">Location</th>
                  <th scope="col">Applied</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.map((application) => (
                  <tr key={application.id}>
                    <td>
                      <div className="tracker-role-cell">
                        <strong>{application.jobTitle}</strong>
                        <span>{application.companyName}</span>
                        {getNotePreview(application.notes) && <small>{getNotePreview(application.notes)}</small>}
                        {application.targetJobUrl && (
                          <a href={application.targetJobUrl} target="_blank" rel="noreferrer">
                            Open job posting <ExternalLink size={14} aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td>{application.location || 'Not recorded'}</td>
                    <td>{formatDate(application.appliedDate)}</td>
                    <td>
                      <label className="sr-only" htmlFor={`application-status-${application.id}`}>
                        Status for {application.jobTitle} at {application.companyName}
                      </label>
                      <Select
                        inputId={`application-status-${application.id}`}
                        options={STATUS_OPTIONS}
                        styles={selectStyles}
                        value={getStatusOption(application.status)}
                        onChange={(option) => updateApplicationStatus(application.id, (option as StatusOption).value)}
                        isSearchable={false}
                      />
                    </td>
                    <td className="tracker-action-cell">
                      <button
                        className="icon-button icon-button-danger"
                        type="button"
                        onClick={() => removeApplication(application.id)}
                        aria-label={`Remove ${application.jobTitle} at ${application.companyName}`}
                        data-tooltip="Remove application"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

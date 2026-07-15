import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Select from '../components/ui/AppSelect';
import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { selectStyles } from '../constants/location';
import AddButton from '../components/ui/AddButton';
import { normalizeExactDateValue } from '../components/ui/datePickerUtils';
import { getStatusOption, loadApplications, saveApplications, STATUS_OPTIONS } from '../components/job-tracker/jobApplication';
import type { JobApplication, JobApplicationStatus } from '../components/job-tracker/jobApplication';

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

const getNotePreview = (value: string) => {
  if (!value) return '';

  const document = new DOMParser().parseFromString(value, 'text/html');
  return document.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
};

export default function JobTracker() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<JobApplication[]>(loadApplications);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobApplicationStatus | 'All'>('All');

  useEffect(() => {
    saveApplications(applications);
  }, [applications]);

  const filteredApplications = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return applications
      .filter((application) => statusFilter === 'All' || application.status === statusFilter)
      .filter((application) => !normalizedQuery || [application.companyName, application.jobTitle, application.location]
        .some((value) => value.toLowerCase().includes(normalizedQuery)))
      .sort((a, b) => b.appliedDate.localeCompare(a.appliedDate));
  }, [applications, searchQuery, statusFilter]);

  const updateApplicationStatus = (id: string, status: JobApplicationStatus) => {
    setApplications((current) => current.map((application) => (
      application.id === id ? { ...application, status } : application
    )));
  };

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h2 className="page-title">Job Tracker</h2>
          <p className="page-copy">Keep a clear record of applications, interviews, offers, and outcomes.</p>
        </div>
      </header>

      <section className="surface-panel tracker-list-panel" aria-labelledby="tracked-applications-title">
        <div className="toolbar-row tracker-list-header">
          <div>
            <h3 id="tracked-applications-title" className="section-title">Tracked applications</h3>
            <p className="section-copy">Update a status as your search progresses.</p>
          </div>
          <div className="tracker-filters">
            <label className="sr-only" htmlFor="tracker-search">Search applications</label>
            <input id="tracker-search" className="form-input tracker-search-input" type="search" placeholder="Search company or role" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
            <label className="sr-only" htmlFor="tracker-status-filter">Filter by status</label>
            <Select
              className="tracker-status-filter"
              inputId="tracker-status-filter"
              options={[{ value: 'All', label: 'All statuses' }, ...STATUS_OPTIONS]}
              styles={selectStyles}
              value={statusFilter === 'All' ? { value: 'All', label: 'All statuses' } : getStatusOption(statusFilter)}
              onChange={(option) => setStatusFilter((option as { value: JobApplicationStatus | 'All' }).value)}
              isSearchable={false}
            />
            <AddButton onClick={() => navigate('/job-tracker/new')}>Add Application</AddButton>
          </div>
        </div>

        {applications.length === 0 ? (
          <div className="empty-state tracker-empty-state">
            <h3 className="section-title">No applications tracked</h3>
            <p className="section-copy" style={{ maxWidth: '420px' }}>Add an application to start tracking your job search in one place.</p>
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
                <tr><th scope="col">Role</th><th scope="col">Location</th><th scope="col">Applied</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {filteredApplications.map((application) => (
                  <tr key={application.id}>
                    <td>
                      <div className="tracker-role-cell">
                        <strong>{application.jobTitle}</strong>
                        <span>{application.companyName}</span>
                        {getNotePreview(application.notes) && <small>{getNotePreview(application.notes)}</small>}
                        {application.targetJobUrl && <a href={application.targetJobUrl} target="_blank" rel="noreferrer">Open job posting <ExternalLink size={14} aria-hidden="true" /></a>}
                      </div>
                    </td>
                    <td>{application.location || 'Not recorded'}</td>
                    <td>{formatDate(application.appliedDate)}</td>
                    <td>
                      <label className="sr-only" htmlFor={`application-status-${application.id}`}>Status for {application.jobTitle} at {application.companyName}</label>
                      <Select inputId={`application-status-${application.id}`} options={STATUS_OPTIONS} styles={selectStyles} value={getStatusOption(application.status)} onChange={(option) => updateApplicationStatus(application.id, (option as { value: JobApplicationStatus }).value)} isSearchable={false} />
                    </td>
                    <td className="tracker-action-cell">
                      <button className="icon-button" type="button" onClick={() => navigate(`/job-tracker/${application.id}/edit`)} aria-label={`Edit ${application.jobTitle} at ${application.companyName}`} data-tooltip="Edit application"><Pencil size={18} /></button>
                      <button className="icon-button icon-button-danger" type="button" onClick={() => setApplications((current) => current.filter((currentApplication) => currentApplication.id !== application.id))} aria-label={`Remove ${application.jobTitle} at ${application.companyName}`} data-tooltip="Remove application"><Trash2 size={18} /></button>
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

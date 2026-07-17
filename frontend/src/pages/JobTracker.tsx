import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
import AddButton from '../components/ui/AddButton';
import DataTable from '../components/ui/DataTable';
import type { DataTableColumn, DataTableFilter } from '../components/ui/DataTable';
import { formatExactDateForDisplay, normalizeExactDateValue } from '../components/ui/datePickerUtils';
import { useDateFormatPreference } from '../features/preferences/dateFormatPreference';
import type { DateFormatPreference } from '../features/preferences/dateFormatPreference';
import { loadApplications, saveApplications, STATUS_OPTIONS } from '../components/job-tracker/jobApplication';
import type { JobApplication } from '../components/job-tracker/jobApplication';
import { getRichTextPlainText } from '../features/rich-text/richText';

const formatDate = (value: string, dateFormat: DateFormatPreference) => {
  if (!value) return 'Not recorded';

  const [month, day, year] = normalizeExactDateValue(value).split('/').map(Number);
  if (!month || !day || !year) return 'Not recorded';

  return formatExactDateForDisplay(value, dateFormat);
};

const getNotePreview = (value: string) => getRichTextPlainText(value);

export default function JobTracker() {
  const navigate = useNavigate();
  const { dateFormat } = useDateFormatPreference();
  const [applications, setApplications] = useState<JobApplication[]>(loadApplications);

  useEffect(() => {
    saveApplications(applications);
  }, [applications]);

  const columns = useMemo<Array<DataTableColumn<JobApplication>>>(() => [
    {
      id: 'organization',
      header: 'Organization',
      searchValue: (application) => application.companyName,
      sortValue: (application) => application.companyName,
      cell: (application) => (
        <div className="tracker-company-cell">
          <strong>{application.companyName || 'Not recorded'}</strong>
        </div>
      )
    },
    {
      id: 'jobTitle',
      header: 'Job Title',
      searchValue: (application) => application.jobTitle,
      sortValue: (application) => application.jobTitle,
      cell: (application) => (
        <div className="tracker-job-title-cell">
          <strong>{application.jobTitle}</strong>
          {getNotePreview(application.notes) && <small>{getNotePreview(application.notes)}</small>}
          {application.targetJobUrl && <a href={application.targetJobUrl} target="_blank" rel="noreferrer">Open job posting <ExternalLink size={14} aria-hidden="true" /></a>}
        </div>
      )
    },
    {
      id: 'location',
      header: 'Location',
      hideOnMobile: true,
      searchValue: (application) => application.location,
      sortValue: (application) => application.location,
      cell: (application) => application.location || 'Not recorded'
    },
    {
      id: 'applied',
      header: 'Applied',
      className: 'tracker-applied-cell',
      sortValue: (application) => {
        const [month, day, year] = normalizeExactDateValue(application.appliedDate).split('/').map(Number);
        return month && day && year ? new Date(year, month - 1, day).getTime() : null;
      },
      cell: (application) => formatDate(application.appliedDate, dateFormat)
    },
    {
      id: 'status',
      header: 'Status',
      className: 'tracker-status-cell',
      sortValue: (application) => application.status,
      cell: (application) => application.status
    },
    {
      id: 'actions',
      header: 'Controls',
      className: 'data-table-actions-cell',
      cell: (application) => (
        <div className="data-table-action-group">
          <button className="icon-button" type="button" onClick={() => navigate(`/job-tracker/${application.id}/edit`)} aria-label={`Edit ${application.jobTitle} at ${application.companyName}`} data-tooltip="Edit application"><Pencil size={18} /></button>
          <button className="icon-button icon-button-danger" type="button" onClick={() => setApplications((current) => current.filter((currentApplication) => currentApplication.id !== application.id))} aria-label={`Remove ${application.jobTitle} at ${application.companyName}`} data-tooltip="Remove application"><Trash2 size={18} /></button>
        </div>
      )
    }
  ], [dateFormat, navigate]);

  const filters = useMemo<Array<DataTableFilter<JobApplication>>>(() => [
    {
      id: 'organization',
      label: 'Organization',
      getValue: (application) => application.companyName,
      placeholder: 'Filter companies or organizations',
      type: 'text'
    },
    {
      id: 'jobTitle',
      label: 'Job title',
      getValue: (application) => application.jobTitle,
      placeholder: 'Filter job titles',
      type: 'text'
    },
    {
      id: 'location',
      label: 'Location',
      getValue: (application) => application.location || 'Not recorded',
      placeholder: 'Filter locations',
      type: 'text'
    },
    {
      id: 'applied',
      label: 'Applied date',
      getValue: (application) => formatDate(application.appliedDate, dateFormat),
      placeholder: 'Filter applied dates',
      type: 'text'
    },
    {
      id: 'status',
      label: 'Status',
      getValue: (application) => application.status,
      options: STATUS_OPTIONS,
      type: 'options'
    }
  ], [dateFormat]);

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h2 className="page-title">Job Tracker</h2>
          <p className="page-copy">Keep a clear record of applications, interviews, offers, and outcomes.</p>
        </div>
      </header>

      <section className="surface-panel tracker-list-panel">
        <DataTable
          caption="Tracked job applications"
          columns={columns}
          description="Update a status as your search progresses."
          emptyContent={(
            <>
              <h3 className="section-title">No applications tracked</h3>
              <p className="section-copy">Add an application to start tracking your job search in one place.</p>
            </>
          )}
          filters={filters}
          getRowId={(application) => application.id}
          initialSort={{ columnId: 'applied', direction: 'desc' }}
          noResultsContent={(
            <>
              <h3 className="section-title">No matching applications</h3>
              <p className="section-copy">Adjust the search or filters to see other applications.</p>
            </>
          )}
          rows={applications}
          searchPlaceholder="Search organization, job title, or location"
          title="Tracked applications"
          toolbarAction={<AddButton onClick={() => navigate('/job-tracker/new')}>Add Application</AddButton>}
        />
      </section>
    </div>
  );
}

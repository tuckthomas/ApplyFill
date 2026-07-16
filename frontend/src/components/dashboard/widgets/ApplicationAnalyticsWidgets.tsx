import { useMemo } from 'react';
import { normalizeExactDateValue } from '../../ui/datePickerUtils';
import { STATUS_OPTIONS } from '../../job-tracker/jobApplication';
import type { JobApplication, JobApplicationStatus } from '../../job-tracker/jobApplication';

type ApplicationWidgetProps = {
  applications: JobApplication[];
};

const statusClassName = (status: JobApplicationStatus) => status.toLowerCase().replaceAll(' ', '-');

const getStatusCount = (applications: JobApplication[], status: JobApplicationStatus) => (
  applications.filter((application) => application.status === status).length
);

export function ApplicationSnapshotWidget({ applications }: ApplicationWidgetProps) {
  const activeCount = getStatusCount(applications, 'Applied') + getStatusCount(applications, 'Interviewing');
  const interviewCount = getStatusCount(applications, 'Interviewing');
  const offerCount = getStatusCount(applications, 'Offer Received');

  return (
    <div className="application-snapshot-widget" aria-label="Application search snapshot">
      <div className="application-snapshot-stat">
        <span>Tracked</span>
        <strong>{applications.length}</strong>
      </div>
      <div className="application-snapshot-stat">
        <span>In progress</span>
        <strong>{activeCount}</strong>
      </div>
      <div className="application-snapshot-stat">
        <span>Interviewing</span>
        <strong>{interviewCount}</strong>
      </div>
      <div className="application-snapshot-stat is-offer">
        <span>Offers</span>
        <strong>{offerCount}</strong>
      </div>
    </div>
  );
}

export function StatusDistributionWidget({ applications }: ApplicationWidgetProps) {
  const largestCount = Math.max(1, ...STATUS_OPTIONS.map(({ value }) => getStatusCount(applications, value)));

  return (
    <div className="status-distribution-widget" aria-label="Application status distribution">
      <div className="status-distribution-total">
        <strong>{applications.length}</strong>
        <span>Total applications</span>
      </div>
      <ul className="status-distribution-list">
        {STATUS_OPTIONS.map(({ value: status }) => {
          const count = getStatusCount(applications, status);
          return (
            <li key={status}>
              <div className="status-distribution-label">
                <span className={`status-distribution-dot status-${statusClassName(status)}`} aria-hidden="true" />
                <span>{status}</span>
                <strong>{count}</strong>
              </div>
              <div className="status-distribution-track" aria-hidden="true">
                <span className={`status-distribution-fill status-${statusClassName(status)}`} style={{ width: `${(count / largestCount) * 100}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type ActivityMonth = {
  count: number;
  key: string;
  label: string;
};

const createActivityMonths = (applications: JobApplication[]): ActivityMonth[] => {
  const today = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - (5 - index), 1);
    return {
      count: 0,
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: new Intl.DateTimeFormat(undefined, { month: 'short' }).format(date)
    };
  });
  const counts = new Map(months.map((month) => [month.key, 0]));

  applications.forEach(({ appliedDate }) => {
    const [month, day, year] = normalizeExactDateValue(appliedDate).split('/').map(Number);
    if (!month || !day || !year) return;
    const key = `${year}-${month - 1}`;
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return months.map((month) => ({ ...month, count: counts.get(month.key) ?? 0 }));
};

export function ApplicationActivityWidget({ applications }: ApplicationWidgetProps) {
  const months = useMemo(() => createActivityMonths(applications), [applications]);
  const largestCount = Math.max(1, ...months.map(({ count }) => count));

  return (
    <div className="application-activity-widget" aria-label="Applications submitted over the last six months">
      <p className="application-activity-description">Applications submitted over the last six months</p>
      <div className="application-activity-chart" role="list">
        {months.map(({ count, key, label }) => (
          <div className="application-activity-month" key={key} role="listitem">
            <span className="application-activity-count">{count}</span>
            <div className="application-activity-bar-track" aria-hidden="true">
              <span className="application-activity-bar" style={{ height: `${count ? Math.max(10, (count / largestCount) * 100) : 0}%` }} />
            </div>
            <span className="application-activity-label">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

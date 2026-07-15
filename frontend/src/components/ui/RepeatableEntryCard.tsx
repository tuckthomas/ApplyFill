import type { ReactNode } from 'react';
import { Pencil, Trash2 } from 'lucide-react';

type RepeatableEntryCardProps = {
  editLabel: string;
  onEdit: () => void;
  onRemove: () => void;
  removeLabel: string;
  subtitle?: ReactNode;
  title: string;
};

export default function RepeatableEntryCard({
  editLabel,
  onEdit,
  onRemove,
  removeLabel,
  subtitle,
  title
}: RepeatableEntryCardProps) {
  return (
    <section className="field-card repeatable-entry-card">
      <div className="job-summary-header">
        <div className="job-summary-identity">
          <h5 className="job-summary-title">{title}</h5>
          {subtitle ? <div className="job-summary-company">{subtitle}</div> : null}
        </div>
        <div className="job-summary-actions">
          <button
            aria-label={editLabel}
            className="icon-button"
            data-tooltip="Edit"
            onClick={onEdit}
            type="button"
          >
            <Pencil size={18} aria-hidden="true" />
          </button>
          <button
            aria-label={removeLabel}
            className="icon-button icon-button-danger"
            data-tooltip="Delete"
            onClick={onRemove}
            type="button"
          >
            <Trash2 size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}

import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Download, Loader2 } from 'lucide-react';
import Select from '../ui/AppSelect';
import RichTextEditor from '../resume/RichTextEditor';
import DatePicker from '../ui/DatePicker';
import { selectStyles } from '../../constants/location';
import { getStatusOption, STATUS_OPTIONS } from './jobApplication';
import type { JobApplicationFormState, StatusOption } from './jobApplication';

type JobApplicationFormProps = {
  error: string;
  mode: 'add' | 'edit';
  onCancel: () => void;
  onChange: <Key extends keyof JobApplicationFormState>(key: Key, value: JobApplicationFormState[Key]) => void;
  onImportJobDescription: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isImportingJobDescription: boolean;
  jobDescriptionError: string;
  value: JobApplicationFormState;
};

export default function JobApplicationForm({
  error,
  isImportingJobDescription,
  jobDescriptionError,
  mode,
  onCancel,
  onChange,
  onImportJobDescription,
  onSubmit,
  value
}: JobApplicationFormProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'notes'>('details');
  const idPrefix = useId().replace(/:/g, '');
  useEffect(() => {
    if (mode === 'add') setActiveTab('details');
  }, [mode]);

  return (
    <section className="surface-panel tracker-form-panel" aria-label="Application form">
      <form noValidate onSubmit={onSubmit}>
        <div className="tracker-form-tabs" role="tablist" aria-label="Application form sections">
          <button
            id={`${idPrefix}-details-tab`}
            className={`tracker-form-tab${activeTab === 'details' ? ' is-active' : ''}`}
            type="button"
            role="tab"
            aria-controls={`${idPrefix}-details-panel`}
            aria-selected={activeTab === 'details'}
            onClick={() => setActiveTab('details')}
          >
            Application details
          </button>
          {mode === 'add' ? (
            <span
              className="tracker-disabled-tab-tooltip"
              data-tooltip="Save the application before adding notes."
              tabIndex={0}
              role="note"
              aria-label="Notes unavailable. Save the application before adding notes."
            >
              <button
                id={`${idPrefix}-notes-tab`}
                className="tracker-form-tab"
                type="button"
                role="tab"
                aria-controls={`${idPrefix}-notes-panel`}
                aria-selected={false}
                disabled
              >
                Notes
              </button>
            </span>
          ) : (
            <button
              id={`${idPrefix}-notes-tab`}
              className={`tracker-form-tab${activeTab === 'notes' ? ' is-active' : ''}`}
              type="button"
              role="tab"
              aria-controls={`${idPrefix}-notes-panel`}
              aria-selected={activeTab === 'notes'}
              onClick={() => setActiveTab('notes')}
            >
              Notes
            </button>
          )}
        </div>

        <div
          id={`${idPrefix}-details-panel`}
          role="tabpanel"
          aria-labelledby={`${idPrefix}-details-tab`}
          hidden={activeTab !== 'details'}
          className="tracker-form-grid"
        >
          <div className="form-group">
            <label className="form-label" htmlFor={`${idPrefix}-company`}>Company *</label>
            <input id={`${idPrefix}-company`} className="form-input" type="text" value={value.companyName} onChange={(event) => onChange('companyName', event.target.value)} autoComplete="organization" required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={`${idPrefix}-job-title`}>Job title *</label>
            <input id={`${idPrefix}-job-title`} className="form-input" type="text" value={value.jobTitle} onChange={(event) => onChange('jobTitle', event.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={`${idPrefix}-location`}>Location</label>
            <input id={`${idPrefix}-location`} className="form-input" type="text" placeholder="City, State or Remote" value={value.location} onChange={(event) => onChange('location', event.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={`${idPrefix}-status`}>Status</label>
            <Select inputId={`${idPrefix}-status`} options={STATUS_OPTIONS} styles={selectStyles} value={getStatusOption(value.status)} onChange={(option) => onChange('status', (option as StatusOption).value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={`${idPrefix}-applied-date`}>Application date</label>
            <DatePicker id={`${idPrefix}-applied-date`} ariaLabel="Application date" precision="Exact" value={value.appliedDate} onChange={(nextValue) => onChange('appliedDate', nextValue)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={`${idPrefix}-job-url`}>Job posting URL</label>
            <input id={`${idPrefix}-job-url`} className="form-input" type="url" placeholder="https://..." value={value.targetJobUrl} onChange={(event) => onChange('targetJobUrl', event.target.value)} />
          </div>
          <div className="tracker-form-full-width">
            <RichTextEditor
              label="Job Description"
              labelAction={(
                <button
                  className="btn btn-secondary tracker-import-description-button"
                  type="button"
                  onClick={onImportJobDescription}
                  disabled={isImportingJobDescription || !value.targetJobUrl.trim()}
                >
                  {isImportingJobDescription ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
                  {isImportingJobDescription ? 'Importing…' : 'Open & import posting'}
                </button>
              )}
              labelId={`${idPrefix}-job-description-label`}
              toolbarId={`${idPrefix}-job-description-toolbar`}
              value={value.jobDescription}
              onChange={(nextValue) => onChange('jobDescription', nextValue)}
              placeholder="Paste or import the job posting details"
              quillClassName="rich-text-quill-tracker"
            />
            {jobDescriptionError && <p className="form-error-message" role="alert">{jobDescriptionError}</p>}
          </div>
        </div>

        <div id={`${idPrefix}-notes-panel`} role="tabpanel" aria-labelledby={`${idPrefix}-notes-tab`} hidden={activeTab !== 'notes'}>
          <RichTextEditor label="Notes" labelId={`${idPrefix}-notes-label`} toolbarId={`${idPrefix}-notes-toolbar`} value={value.notes} onChange={(nextValue) => onChange('notes', nextValue)} placeholder="Recruiter name, next steps, or other reminders" quillClassName="rich-text-quill-tracker" />
        </div>

        {error && <p className="form-error-message" role="alert">{error}</p>}
        <div className="toolbar-row tracker-form-actions">
          <span className="section-copy">Required fields are marked with an asterisk.</span>
          <div className="modal-form-actions">
            <button className="btn btn-secondary" type="button" onClick={onCancel}>Cancel</button>
            <button className="btn btn-primary" type="submit">{mode === 'add' ? 'Save Application' : 'Save Changes'}</button>
          </div>
        </div>
      </form>
    </section>
  );
}

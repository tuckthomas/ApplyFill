import { useEffect, useId, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Download, Loader2 } from 'lucide-react';
import Select from '../ui/AppSelect';
import RichTextEditor from '../resume/RichTextEditor';
import DatePicker from '../ui/DatePicker';
import TabbedForm from '../ui/TabbedForm';
import AddressFlow from '../ui/AddressFlow';
import type { AddressValue } from '../ui/AddressFlow';
import { selectStyles } from '../../constants/location';
import {
  getStatusOption,
  getWorkplaceTypeOption,
  STATUS_OPTIONS,
  WORKPLACE_TYPE_OPTIONS
} from './jobApplication';
import type {
  JobApplicationFormState,
  StatusOption,
  WorkplaceTypeOption
} from './jobApplication';

type JobApplicationFormProps = {
  agentContent?: ReactNode;
  error: string;
  mode: 'add' | 'edit';
  onCancel: () => void;
  onChange: <Key extends keyof JobApplicationFormState>(key: Key, value: JobApplicationFormState[Key]) => void;
  onImportJobDescription: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isImportingJobDescription: boolean;
  initialTab?: 'agent' | 'details' | 'notes';
  jobDescriptionError: string;
  value: JobApplicationFormState;
};

export default function JobApplicationForm({
  agentContent,
  error,
  isImportingJobDescription,
  initialTab = 'details',
  jobDescriptionError,
  mode,
  onCancel,
  onChange,
  onImportJobDescription,
  onSubmit,
  value
}: JobApplicationFormProps) {
  const allowedInitialTab = mode === 'add' ? 'details' : initialTab;
  const [activeTab, setActiveTab] = useState<'agent' | 'details' | 'notes'>(allowedInitialTab);
  const idPrefix = useId().replace(/:/g, '');
  useEffect(() => {
    setActiveTab(allowedInitialTab);
  }, [allowedInitialTab]);

  return (
    <div className="tracker-form-panel" aria-label="Application form">
      <TabbedForm
        activeTab={activeTab}
        ariaLabel="Application form sections"
        onTabChange={(tabId) => setActiveTab(tabId as 'agent' | 'details' | 'notes')}
        tabs={[
          { id: 'details', label: 'Application Details' },
          { id: 'notes', label: 'Notes', disabled: mode === 'add', disabledReason: mode === 'add' ? 'Save the application before adding notes.' : undefined },
          ...(agentContent ? [{
            id: 'agent',
            label: 'Agentic AI',
            disabled: mode === 'add',
            disabledReason: mode === 'add' ? 'Save the application before using Agentic AI.' : undefined,
          }] : [])
        ]}
        footer={activeTab !== 'agent' ? (
          <>
            {error && <p className="form-error-message" role="alert">{error}</p>}
            <div className="toolbar-row tracker-form-actions">
              <span className="section-copy">Required fields are marked with an asterisk.</span>
              <div className="modal-form-actions">
                <button className="btn btn-secondary" type="button" onClick={onCancel}>Cancel</button>
                <button className="btn btn-primary" form={`${idPrefix}-application-form`} type="submit">{mode === 'add' ? 'Save Application' : 'Save Changes'}</button>
              </div>
            </div>
          </>
        ) : null}
      >
        {({ activeTab: selectedTab, panelId, tabId }) => selectedTab === 'agent' ? (
          <div id={panelId} role="tabpanel" aria-labelledby={tabId}>{agentContent}</div>
        ) : (
          <form id={`${idPrefix}-application-form`} noValidate onSubmit={onSubmit}>
          {selectedTab === 'details' ? (
          <div id={panelId} role="tabpanel" aria-labelledby={tabId} className="tracker-form-grid">
          <div className="form-group">
            <label className="form-label" htmlFor={`${idPrefix}-applied-date`}>Application date</label>
            <DatePicker id={`${idPrefix}-applied-date`} ariaLabel="Application date" precision="Exact" value={value.appliedDate} onChange={(nextValue) => onChange('appliedDate', nextValue)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={`${idPrefix}-job-url`}>Job posting URL</label>
            <input id={`${idPrefix}-job-url`} className="form-input" type="url" placeholder="https://..." value={value.targetJobUrl} onChange={(event) => onChange('targetJobUrl', event.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={`${idPrefix}-company`}>Company *</label>
            <input id={`${idPrefix}-company`} className="form-input" type="text" value={value.companyName} onChange={(event) => onChange('companyName', event.target.value)} autoComplete="organization" required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={`${idPrefix}-job-title`}>Job title *</label>
            <input id={`${idPrefix}-job-title`} className="form-input" type="text" value={value.jobTitle} onChange={(event) => onChange('jobTitle', event.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={`${idPrefix}-workplace-type`}>Workplace type</label>
            <Select<WorkplaceTypeOption>
              inputId={`${idPrefix}-workplace-type`}
              isSearchable={false}
              onChange={(option) => onChange('workplaceType', option?.value ?? null)}
              options={WORKPLACE_TYPE_OPTIONS}
              placeholder="Select workplace type"
              styles={selectStyles}
              value={getWorkplaceTypeOption(value.workplaceType)}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={`${idPrefix}-status`}>Status</label>
            <Select inputId={`${idPrefix}-status`} options={STATUS_OPTIONS} styles={selectStyles} value={getStatusOption(value.status)} onChange={(option) => onChange('status', (option as StatusOption).value)} />
          </div>
          <div className="tracker-form-full-width tracker-location-section">
            <div>
              <h3 className="section-title">Location</h3>
              <hr className="subtle-divider" />
            </div>
            <AddressFlow
              idPrefix={`${idPrefix}-application-location`}
              mode="locality"
              onChange={(field, nextValue) => onChange(
                field as keyof JobApplicationFormState,
                nextValue as JobApplicationFormState[keyof JobApplicationFormState]
              )}
              value={value as AddressValue}
            />
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
              editorClassName="rich-text-editor-tracker"
            />
            {jobDescriptionError && <p className="form-error-message" role="alert">{jobDescriptionError}</p>}
          </div>
          </div>
        ) : (
          <div id={panelId} role="tabpanel" aria-labelledby={tabId}>
            <RichTextEditor label="Notes" labelId={`${idPrefix}-notes-label`} toolbarId={`${idPrefix}-notes-toolbar`} value={value.notes} onChange={(nextValue) => onChange('notes', nextValue)} placeholder="Recruiter name, next steps, or other reminders" editorClassName="rich-text-editor-tracker" />
          </div>
        )}
          </form>
        )}
      </TabbedForm>
    </div>
  );
}

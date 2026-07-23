import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import Select from '../ui/AppSelect';
import { ExternalLink, Pencil, Trash2 } from 'lucide-react';

import { selectStyles } from '../../constants/location';
import DatePicker from '../ui/DatePicker';
import RichTextEditor from './RichTextEditor';
import ValidationDialog from '../ui/ValidationDialog';
import Checkbox from '../ui/Checkbox';
import FormModal from '../ui/FormModal';
import RepeatableSectionHeader from '../ui/RepeatableSectionHeader';
import RepeatableEmptyState from '../ui/RepeatableEmptyState';
import { useDateFormatPreference } from '../../features/preferences/dateFormatPreference';
import type { DateFormatPreference } from '../../features/preferences/dateFormatPreference';
import { formatExactDateForDisplay } from '../ui/datePickerUtils';
import { EMPTY_RICH_TEXT_VALUE } from '../../features/rich-text/richText';

type SelectOption = {
  value: string;
  label: string;
};

type ProjectDatePrecision = 'Exact' | 'Estimated';
type ProjectDateField = 'startDate' | 'endDate';

export type ProjectEntry = {
  id: number;
  name: string;
  projectType: SelectOption | null;
  role: string;
  organization: string;
  projectUrl: string;
  startDate: string;
  startDatePrecision: ProjectDatePrecision;
  endDate: string;
  endDatePrecision: ProjectDatePrecision;
  isOngoing: boolean;
  description: string;
  isEditing: boolean;
  isSaved: boolean;
  rewriteMessage: string;
};

type ProjectsSectionProps = {
  projects: ProjectEntry[];
  onChange: Dispatch<SetStateAction<ProjectEntry[]>>;
};

type ValidationDialogState = {
  projectLabel: string;
  messages: string[];
};

const PROJECT_TYPE_OPTIONS: SelectOption[] = [
  { value: 'Open source', label: 'Open source' },
  { value: 'Professional', label: 'Professional' },
  { value: 'Personal', label: 'Personal' },
  { value: 'Academic', label: 'Academic' },
  { value: 'Volunteer', label: 'Volunteer' },
  { value: 'Other', label: 'Other' }
];

const DATE_PRECISION_OPTIONS: Array<{ value: ProjectDatePrecision; label: string }> = [
  { value: 'Exact', label: 'Exact' },
  { value: 'Estimated', label: 'Estimated' }
];

const createProject = (id: number): ProjectEntry => ({
  id,
  name: '',
  projectType: null,
  role: '',
  organization: '',
  projectUrl: '',
  startDate: '',
  startDatePrecision: 'Exact',
  endDate: '',
  endDatePrecision: 'Exact',
  isOngoing: false,
  description: EMPTY_RICH_TEXT_VALUE,
  isEditing: true,
  isSaved: false,
  rewriteMessage: ''
});

const isValidProjectUrl = (value: string) => {
  if (!value.trim()) return true;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const parseProjectDateValue = (
  value: string,
  precision: ProjectDatePrecision,
  isStartDate: boolean
) => {
  if (!value) return { isValid: true, time: null as number | null };

  if (precision === 'Estimated') {
    const match = /^(0[1-9]|1[0-2])\/(\d{4})$/.exec(value);
    if (!match) return { isValid: false, time: null as number | null };

    const month = Number(match[1]);
    const year = Number(match[2]);
    const day = isStartDate ? 1 : new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { isValid: true, time: Date.UTC(year, month - 1, day) };
  }

  const match = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(\d{4})$/.exec(value);
  if (!match) return { isValid: false, time: null as number | null };

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  const isValid = date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;

  return { isValid, time: isValid ? time : null };
};

export default function ProjectsSection({ projects, onChange }: ProjectsSectionProps) {
  const { dateFormat } = useDateFormatPreference();
  const [validationDialog, setValidationDialog] = useState<ValidationDialogState | null>(null);

  const updateProject = <Key extends keyof ProjectEntry>(
    id: number,
    key: Key,
    value: ProjectEntry[Key]
  ) => {
    onChange((current) => current.map((project) => (
      project.id === id ? { ...project, [key]: value } : project
    )));
  };

  const addProject = () => {
    onChange((current) => [
      ...current.map((project) => ({ ...project, isEditing: false })),
      createProject(Date.now())
    ]);
  };

  const removeProject = (id: number) => {
    onChange((current) => current.filter((project) => project.id !== id));
  };

  const updateDatePrecision = (
    id: number,
    field: ProjectDateField,
    precision: ProjectDatePrecision
  ) => {
    const precisionKey = field === 'startDate' ? 'startDatePrecision' : 'endDatePrecision';
    onChange((current) => current.map((project) => (
      project.id === id ? { ...project, [field]: '', [precisionKey]: precision } : project
    )));
  };

  const updateOngoing = (id: number, checked: boolean) => {
    onChange((current) => current.map((project) => (
      project.id === id
        ? {
          ...project,
          isOngoing: checked,
          endDate: checked ? '' : project.endDate,
          endDatePrecision: checked ? 'Exact' : project.endDatePrecision
        }
        : project
    )));
  };

  const getValidationMessages = (project: ProjectEntry) => {
    const messages: string[] = [];
    const startDate = parseProjectDateValue(project.startDate, project.startDatePrecision, true);
    const endDate = parseProjectDateValue(project.endDate, project.endDatePrecision, false);

    if (!project.name.trim()) messages.push('Project name is required.');
    if (!isValidProjectUrl(project.projectUrl)) {
      messages.push('Project URL must be a valid HTTP or HTTPS address.');
    }
    if (project.startDate && !startDate.isValid) {
      messages.push(getDateValidationMessage('Start Date', project.startDatePrecision, dateFormat));
    }
    if (!project.isOngoing && project.endDate && !endDate.isValid) {
      messages.push(getDateValidationMessage('End Date', project.endDatePrecision, dateFormat));
    }
    if (!project.isOngoing && startDate.time !== null && endDate.time !== null && endDate.time < startDate.time) {
      messages.push('End Date cannot be before Start Date.');
    }

    return messages;
  };

  const saveProject = (id: number) => {
    const project = projects.find((entry) => entry.id === id);
    if (!project) return;

    const messages = getValidationMessages(project);
    if (messages.length > 0) {
      setValidationDialog({
        projectLabel: project.name.trim() || 'this project',
        messages
      });
      return;
    }

    setValidationDialog(null);
    onChange((current) => current.map((entry) => (
      entry.id === id
        ? {
          ...entry,
          endDate: entry.isOngoing ? '' : entry.endDate,
          endDatePrecision: entry.isOngoing ? 'Exact' : entry.endDatePrecision,
          isEditing: false,
          isSaved: true,
          rewriteMessage: ''
        }
        : entry
    )));
  };

  const expandProject = (id: number) => {
    onChange((current) => current.map((project) => ({
      ...project,
      isEditing: project.id === id
    })));
  };

  const closeProjectForm = (project: ProjectEntry) => {
    setValidationDialog(null);
    if (project.isSaved) {
      updateProject(project.id, 'isEditing', false);
    } else {
      removeProject(project.id);
    }
  };

  const formatDisplayDate = (value: string, precision: ProjectDatePrecision) => {
    if (!value) return '';
    return precision === 'Estimated' ? `Estimated ${value}` : formatExactDateForDisplay(value, dateFormat);
  };

  const formatDateRange = (project: ProjectEntry) => {
    if (!project.startDate && !project.endDate && !project.isOngoing) return 'Dates not set';

    const startDate = formatDisplayDate(project.startDate, project.startDatePrecision) || 'Start not set';
    const endDate = project.isOngoing
      ? 'Present'
      : formatDisplayDate(project.endDate, project.endDatePrecision) || 'End not set';
    return `${startDate} - ${endDate}`;
  };

  const getDateHint = (fieldLabel: string, precision: ProjectDatePrecision) => {
    if (precision === 'Exact') return `${fieldLabel} will be used exactly as entered.`;
    return fieldLabel === 'Start Date'
      ? 'Estimated start dates use the first day of the selected month for autofill.'
      : 'Estimated end dates use the last day of the selected month for autofill.';
  };

  return (
    <div className="page-stack">
      {validationDialog ? (
        <ValidationDialog
          closeLabel="Close project validation message"
          description={`Fix these items for ${validationDialog.projectLabel} before saving.`}
          messages={validationDialog.messages}
          onClose={() => setValidationDialog(null)}
          title="Missing or Invalid Project Information"
          titleId="project-validation-title"
        />
      ) : null}

      <RepeatableSectionHeader
        actionLabel="Add Project"
        description="Add open-source, professional, academic, volunteer, or personal projects for targeted resumes."
        onAdd={addProject}
        title="Projects"
      />

      {projects.length === 0 ? (
        <RepeatableEmptyState title="No Projects Added" />
      ) : null}

      {projects.map((project, index) => {
        const prefix = `project-${project.id}`;
        const projectTitle = project.name.trim() || 'Untitled project';
        const contextLabel = project.organization.trim() || project.projectType?.label || 'Project';
        const removeLabel = project.name.trim() ? `Remove ${project.name}` : `Remove project ${index + 1}`;

        if (project.isSaved && !project.isEditing) {
          return (
            <section className="field-card job-transition-card" key={project.id} aria-labelledby={`${prefix}-summary-title`}>
              <div className="job-summary">
                <div className="job-summary-header">
                  <div className="job-summary-identity">
                    <h4 className="job-summary-title" id={`${prefix}-summary-title`}>{projectTitle}</h4>
                    <p className="job-summary-company">{contextLabel}</p>
                  </div>
                  <div className="job-summary-actions">
                    <button className="icon-button" type="button" onClick={() => expandProject(project.id)} aria-label={`Edit ${projectTitle}`} aria-controls={`${prefix}-details-panel`} data-tooltip={`Edit ${projectTitle}`}>
                      <Pencil size={18} aria-hidden="true" />
                    </button>
                    <button className="icon-button icon-button-danger" type="button" onClick={() => removeProject(project.id)} aria-label={removeLabel}>
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <dl className="summary-list">
                  <div><dt>Role</dt><dd>{project.role || 'Not set'}</dd></div>
                  <div><dt>Dates</dt><dd>{formatDateRange(project)}</dd></div>
                  <div>
                    <dt>Project URL</dt>
                    <dd>
                      {project.projectUrl ? (
                        <a className="project-summary-link" href={project.projectUrl} target="_blank" rel="noreferrer">
                          Open project <ExternalLink size={14} aria-hidden="true" />
                        </a>
                      ) : 'Not set'}
                    </dd>
                  </div>
                </dl>
              </div>
            </section>
          );
        }

        return (
          <FormModal
            className="project-modal-dialog"
            closeLabel={project.isSaved ? `Close edit ${projectTitle}` : 'Close add project'}
            description="Add the project details once so they can be reused in targeted resumes."
            dirtyKey={JSON.stringify(project)}
            initialFocusId={`${prefix}-name`}
            isOpen={!validationDialog}
            key={project.id}
            onClose={() => closeProjectForm(project)}
            title={project.isSaved ? `Edit ${projectTitle}` : 'Add project'}
          >
            <form
              className="page-stack project-modal-form"
              onSubmit={(event) => {
                event.preventDefault();
                saveProject(project.id);
              }}
            >
                <div className="form-grid">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor={`${prefix}-name`}>Project Name *</label>
                    <input id={`${prefix}-name`} className="form-input" type="text" value={project.name} onChange={(event) => updateProject(project.id, 'name', event.target.value)} placeholder="Enter project name" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor={`${prefix}-type`}>Project Type</label>
                    <Select inputId={`${prefix}-type`} options={PROJECT_TYPE_OPTIONS} styles={selectStyles} value={project.projectType} onChange={(option) => updateProject(project.id, 'projectType', option as SelectOption | null)} placeholder="Select project type" isClearable />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor={`${prefix}-role`}>Your Role</label>
                    <input id={`${prefix}-role`} className="form-input" type="text" value={project.role} onChange={(event) => updateProject(project.id, 'role', event.target.value)} placeholder="e.g. Creator and Developer" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor={`${prefix}-organization`}>Organization or Client</label>
                    <input id={`${prefix}-organization`} className="form-input" type="text" value={project.organization} onChange={(event) => updateProject(project.id, 'organization', event.target.value)} placeholder="Optional" />
                  </div>
                  <div className="form-group form-grid-full" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor={`${prefix}-url`}>Project URL</label>
                    <input id={`${prefix}-url`} className="form-input" type="url" value={project.projectUrl} onChange={(event) => updateProject(project.id, 'projectUrl', event.target.value)} placeholder="https://github.com/..." />
                  </div>
                </div>

                <div className="employment-date-row employment-start-date-row">
                  <div className="form-group employment-date-field" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor={`${prefix}-start-date`}>Start Date</label>
                    <div className="date-input-row">
                      <Select aria-label="Start Date Precision" className="date-precision-select" inputId={`${prefix}-start-date-precision`} options={DATE_PRECISION_OPTIONS} styles={selectStyles} value={DATE_PRECISION_OPTIONS.find((option) => option.value === project.startDatePrecision)} onChange={(option) => updateDatePrecision(project.id, 'startDate', option?.value ?? 'Exact')} isSearchable={false} />
                      <DatePicker id={`${prefix}-start-date`} ariaLabel="Start Date" value={project.startDate} precision={project.startDatePrecision} onChange={(value) => updateProject(project.id, 'startDate', value)} />
                    </div>
                    <p className="field-hint">{getDateHint('Start Date', project.startDatePrecision)}</p>
                  </div>
                </div>

                <div className="employment-date-row">
                  <div className="form-group employment-date-field" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor={`${prefix}-end-date`}>End Date</label>
                    <div className="date-input-row">
                      <Select aria-label="End Date Precision" className="date-precision-select" inputId={`${prefix}-end-date-precision`} options={DATE_PRECISION_OPTIONS} styles={selectStyles} value={DATE_PRECISION_OPTIONS.find((option) => option.value === project.endDatePrecision)} onChange={(option) => updateDatePrecision(project.id, 'endDate', option?.value ?? 'Exact')} isDisabled={project.isOngoing} isSearchable={false} />
                      <DatePicker id={`${prefix}-end-date`} ariaLabel="End Date" value={project.endDate} precision={project.endDatePrecision} onChange={(value) => updateProject(project.id, 'endDate', value)} disabled={project.isOngoing} />
                    </div>
                    <p className="field-hint">{getDateHint('End Date', project.endDatePrecision)}</p>
                  </div>
                  <div className="form-group current-job-field" style={{ marginBottom: 0 }}>
                    <span className="form-label" aria-hidden="true">Ongoing Project</span>
                    <Checkbox
                      checked={project.isOngoing}
                      label="This project is ongoing"
                      onChange={(event) => updateOngoing(project.id, event.target.checked)}
                    />
                  </div>
                </div>

                <RichTextEditor
                  label="Project Details"
                  labelId={`${prefix}-details-label`}
                  onChange={(value) => updateProject(project.id, 'description', value)}
                  placeholder="Describe the problem, your contribution, technologies used, and measurable results..."
                  editorClassName="rich-text-editor-project"
                  toolbarId={`${prefix}-toolbar`}
                  value={project.description}
                />

                <div className="toolbar-row project-modal-actions">
                  {project.rewriteMessage ? <p className="section-copy" role="status">{project.rewriteMessage}</p> : <span />}
                  <div className="modal-form-actions">
                    <button className="btn btn-secondary" data-modal-close type="button" onClick={() => closeProjectForm(project)}>Cancel</button>
                    <button className="btn btn-primary" type="submit">Save Project</button>
                  </div>
                </div>
            </form>
          </FormModal>
        );
      })}
    </div>
  );
}

function getDateValidationMessage(
  fieldLabel: string,
  precision: ProjectDatePrecision,
  dateFormat: DateFormatPreference
) {
  return precision === 'Estimated'
    ? `${fieldLabel} must use MM/YYYY when Estimated is selected.`
    : `${fieldLabel} must use ${dateFormat} when Exact is selected.`;
}

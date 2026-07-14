import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react';
import Select from 'react-select';

import { COUNTRY_OPTIONS, STATE_OPTIONS, selectStyles } from '../../constants/location';
import RichTextEditor from './RichTextEditor';

type SelectOption = {
  value: string;
  label: string;
};

type EmploymentDatePrecision = 'Exact' | 'Estimated';
type EmploymentDateField = 'startDate' | 'endDate';
type RichTextField = 'description' | 'reasonForLeaving';

export type ExperienceEntry = {
  id: number;
  jobTitle: string;
  company: string;
  startDate: string;
  startDatePrecision: EmploymentDatePrecision;
  endDate: string;
  endDatePrecision: EmploymentDatePrecision;
  isCurrentJob: boolean;
  address1: string;
  address2: string;
  city: string;
  state: SelectOption | null;
  postalCode: string;
  country: SelectOption | null;
  companyPhone: string;
  supervisorName: string;
  mayContactSupervisor: boolean;
  description: string;
  reasonForLeaving: string;
  rewriteMessage: string;
  validationMessage: string;
  isEditing: boolean;
  isSaved: boolean;
};

type ValidationDialogState = {
  jobLabel: string;
  messages: string[];
};

const createExperience = (id: number): ExperienceEntry => ({
  id,
  jobTitle: '',
  company: '',
  startDate: '',
  startDatePrecision: 'Exact',
  endDate: '',
  endDatePrecision: 'Exact',
  isCurrentJob: false,
  address1: '',
  address2: '',
  city: '',
  state: null,
  postalCode: '',
  country: COUNTRY_OPTIONS.find((option) => option.value === 'United States') ?? null,
  companyPhone: '',
  supervisorName: '',
  mayContactSupervisor: false,
  description: '',
  reasonForLeaving: '',
  rewriteMessage: '',
  validationMessage: '',
  isEditing: true,
  isSaved: false
});

const JOB_DETAILS_COLLAPSE_MS = 320;
const DATE_PRECISION_OPTIONS: Array<{ value: EmploymentDatePrecision; label: string }> = [
  { value: 'Exact', label: 'Exact' },
  { value: 'Estimated', label: 'Estimated' }
];

type ExperienceSectionProps = {
  experiences: ExperienceEntry[];
  onChange: Dispatch<SetStateAction<ExperienceEntry[]>>;
};

export default function ExperienceSection({ experiences, onChange }: ExperienceSectionProps) {
  const [enhancingField, setEnhancingField] = useState<{ id: number; field: RichTextField } | null>(null);
  const [collapsingIds, setCollapsingIds] = useState<Set<number>>(() => new Set());
  const [validationDialog, setValidationDialog] = useState<ValidationDialogState | null>(null);
  const setExperiences = onChange;

  const updateExperience = <Key extends keyof ExperienceEntry>(
    id: number,
    key: Key,
    value: ExperienceEntry[Key]
  ) => {
    setExperiences((current) => current.map((experience) => (
      experience.id === id ? { ...experience, [key]: value } : experience
    )));
  };

  const addExperience = () => {
    const experience = createExperience(Date.now());
    setExperiences((current) => [...current, experience]);
  };

  const saveExperience = (id: number) => {
    const experience = experiences.find((entry) => entry.id === id);
    if (!experience) {
      return;
    }

    const validationMessages = getExperienceValidationMessages(experience);
    if (validationMessages.length > 0) {
      setValidationDialog({
        jobLabel: getExperienceTitle(experience),
        messages: validationMessages
      });
      updateExperience(id, 'isEditing', true);
      return;
    }

    setValidationDialog(null);
    setExperiences((current) => current.map((experience) => (
      experience.id === id ? validateAndSaveExperience(experience) : experience
    )));
  };

  const getExperienceValidationMessages = (experience: ExperienceEntry) => {
    const startDate = parseEmploymentDateValue(experience.startDate, experience.startDatePrecision, true);
    const endDate = parseEmploymentDateValue(experience.endDate, experience.endDatePrecision, false);
    const messages: string[] = [];

    if (!experience.jobTitle.trim()) {
      messages.push('Job Title is required.');
    }

    if (!experience.company.trim()) {
      messages.push('Company is required.');
    }

    if (!experience.startDate.trim()) {
      messages.push('Start Date is required.');
    } else if (!startDate.isValid) {
      messages.push(getDateValidationMessage('Start Date', experience.startDatePrecision));
    }

    if (!experience.isCurrentJob && !experience.endDate.trim()) {
      messages.push('End Date is required unless "I currently work here" is checked.');
    } else if (!experience.isCurrentJob && !endDate.isValid) {
      messages.push(getDateValidationMessage('End Date', experience.endDatePrecision));
    }

    if (!experience.isCurrentJob && startDate.time !== null && endDate.time !== null && endDate.time < startDate.time) {
      messages.push('End Date cannot be before Start Date.');
    }

    return messages;
  };

  const validateAndSaveExperience = (experience: ExperienceEntry): ExperienceEntry => {
    return {
      ...experience,
      endDate: experience.isCurrentJob ? '' : experience.endDate,
      endDatePrecision: experience.isCurrentJob ? 'Exact' : experience.endDatePrecision,
      isEditing: false,
      isSaved: true,
      validationMessage: ''
    };
  };

  const expandExperience = (id: number) => {
    setCollapsingIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    updateExperience(id, 'isEditing', true);
  };

  const collapseExperience = (id: number) => {
    setCollapsingIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });

    window.setTimeout(() => {
      setExperiences((current) => current.map((experience) => (
        experience.id === id ? { ...experience, isEditing: false } : experience
      )));
      setCollapsingIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }, JOB_DETAILS_COLLAPSE_MS);
  };

  const removeExperience = (id: number) => {
    setExperiences((current) => current.filter((experience) => experience.id !== id));
    setCollapsingIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const setRewriteMessage = (id: number, message: string) => {
    updateExperience(id, 'rewriteMessage', message);
  };

  const updateCurrentJob = (id: number, checked: boolean) => {
    setExperiences((current) => current.map((experience) => (
      experience.id === id
        ? {
          ...experience,
          isCurrentJob: checked,
          endDate: checked ? '' : experience.endDate,
          endDatePrecision: checked ? 'Exact' : experience.endDatePrecision,
          validationMessage: checked ? '' : experience.validationMessage
        }
        : experience
    )));
  };

  const handleAiEnhance = async (experience: ExperienceEntry, field: RichTextField) => {
    const sourceText = experience[field];
    const fieldLabel = field === 'description' ? 'experience details' : 'reason for leaving';

    if (!sourceText.trim()) {
      setRewriteMessage(experience.id, `Add ${fieldLabel} before rewriting.`);
      return;
    }

    setEnhancingField({ id: experience.id, field });
    try {
      const response = await fetch('http://localhost:5033/api/ai/enhance-experience', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: sourceText })
      });

      if (response.status === 503) {
        setRewriteMessage(experience.id, 'AI rewrite is not configured yet.');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to enhance experience');
      }

      const data = await response.json();
      updateExperience(experience.id, field, data.enhancedDescription);
      setRewriteMessage(experience.id, `${field === 'description' ? 'Experience details' : 'Reason for leaving'} rewritten.`);
    } catch (error) {
      console.error(error);
      setRewriteMessage(experience.id, 'Rewrite failed. Try again after the API is available.');
    } finally {
      setEnhancingField(null);
    }
  };

  const getExperienceTitle = (experience: ExperienceEntry) => {
    return experience.jobTitle.trim() || 'this job';
  };

  const updateDatePrecision = (
    id: number,
    field: EmploymentDateField,
    precision: EmploymentDatePrecision
  ) => {
    const dateKey = field;
    const precisionKey = field === 'startDate' ? 'startDatePrecision' : 'endDatePrecision';

    setExperiences((current) => current.map((experience) => (
      experience.id === id
        ? { ...experience, [dateKey]: '', [precisionKey]: precision }
        : experience
    )));
  };

  const formatDateRange = (experience: ExperienceEntry) => {
    if (!experience.startDate && !experience.endDate && !experience.isCurrentJob) {
      return 'Dates not set';
    }

    const endDate = experience.isCurrentJob ? 'Present' : formatDisplayDate(experience.endDate, experience.endDatePrecision);
    return `${formatDisplayDate(experience.startDate, experience.startDatePrecision) || 'Start not set'} - ${endDate || 'End not set'}`;
  };

  const formatDisplayDate = (value: string, precision: EmploymentDatePrecision) => {
    if (!value) {
      return '';
    }

    return precision === 'Estimated' ? `Estimated ${value}` : value;
  };

  const parseEmploymentDateValue = (
    value: string,
    precision: EmploymentDatePrecision,
    isStartDate: boolean
  ) => {
    if (!value) {
      return { isValid: true, time: null };
    }

    if (precision === 'Estimated') {
      const estimatedMatch = /^(0[1-9]|1[0-2])\/(\d{4})$/.exec(value);

      if (!estimatedMatch) {
        return { isValid: false, time: null };
      }

      const month = Number(estimatedMatch[1]);
      const year = Number(estimatedMatch[2]);
      const day = isStartDate ? 1 : new Date(Date.UTC(year, month, 0)).getUTCDate();

      return {
        isValid: true,
        time: Date.UTC(year, month - 1, day)
      };
    }

    const match = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(\d{4})$/.exec(value);

    if (!match) {
      return { isValid: false, time: null };
    }

    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = Number(match[3]);
    const time = Date.UTC(year, month - 1, day);
    const date = new Date(time);
    const isValid = (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );

    return { isValid, time: isValid ? time : null };
  };

  const getDatePlaceholder = (precision: EmploymentDatePrecision) => {
    return precision === 'Estimated' ? 'MM/YYYY' : 'MM/DD/YYYY';
  };

  const getDateHint = (fieldLabel: string, precision: EmploymentDatePrecision) => {
    if (precision === 'Exact') {
      return `${fieldLabel} will be used exactly as entered.`;
    }

    return fieldLabel === 'Start Date'
      ? 'Estimated start dates use the first day of the selected month for autofill.'
      : 'Estimated end dates use the last day of the selected month for autofill.';
  };

  const getDateValidationMessage = (fieldLabel: string, precision: EmploymentDatePrecision) => {
    return precision === 'Estimated'
      ? `${fieldLabel} must use MM/YYYY when Estimated is selected.`
      : `${fieldLabel} must use MM/DD/YYYY when Exact is selected.`;
  };

  const formatLocation = (experience: ExperienceEntry) => {
    const locationParts = [
      experience.city,
      experience.state?.value,
      experience.country?.value
    ].filter(Boolean);

    return locationParts.length > 0 ? locationParts.join(', ') : 'Location not set';
  };

  return (
    <div className="page-stack">
      {validationDialog ? (
        <div className="validation-dialog-backdrop" role="presentation" onClick={() => setValidationDialog(null)}>
          <section
            aria-labelledby="experience-validation-title"
            aria-modal="true"
            className="validation-dialog"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="validation-dialog-header">
              <div className="validation-dialog-heading">
                <AlertCircle size={22} aria-hidden="true" />
                <h4 id="experience-validation-title">Missing or Invalid Job Information</h4>
              </div>
              <button
                aria-label="Close validation message"
                className="icon-button"
                type="button"
                onClick={() => setValidationDialog(null)}
              >
                <X size={20} />
              </button>
            </div>
            <p className="section-copy">
              Fix these items for {validationDialog.jobLabel} before saving.
            </p>
            <ul className="validation-dialog-list">
              {validationDialog.messages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
            <div className="validation-dialog-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setValidationDialog(null)}>
                Review Fields
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <div className="toolbar-row">
        <div>
          <h3 className="section-title">Work Experience</h3>
          <p className="section-copy">
            Add each role from your work history, starting with the most recent.
          </p>
        </div>
        <button className="btn btn-secondary btn-add-action" type="button" onClick={addExperience}>
          <Plus size={18} />
          Add Job
        </button>
      </div>

      {experiences.length === 0 ? (
        <section className="field-card job-empty-state" aria-label="No jobs added">
          <h4 className="section-title">No jobs added</h4>
        </section>
      ) : null}

      {experiences.map((experience, index) => {
        const prefix = `experience-${experience.id}`;
        const toolbarId = `${prefix}-toolbar`;
        const reasonToolbarId = `${prefix}-reason-toolbar`;
        const isEnhancingDescription = enhancingField?.id === experience.id && enhancingField.field === 'description';
        const isEnhancingReason = enhancingField?.id === experience.id && enhancingField.field === 'reasonForLeaving';
        const isSaved = experience.isSaved;
        const isCollapsing = collapsingIds.has(experience.id);
        const experienceTitle = experience.jobTitle.trim() || 'Untitled role';
        const companyLabel = experience.company.trim() || 'Company not set';
        const removeLabel = experience.jobTitle.trim()
          ? `Remove ${experience.jobTitle}`
          : `Remove job ${index + 1}`;

        if (isSaved && !experience.isEditing) {
          return (
            <section className="field-card job-transition-card" key={experience.id} aria-labelledby={`${prefix}-summary-title`}>
              <div className="job-summary">
                <div className="job-summary-header">
                  <div className="job-summary-identity">
                    <h4 className="job-summary-title" id={`${prefix}-summary-title`}>{experienceTitle}</h4>
                    <p className="job-summary-company">{companyLabel}</p>
                  </div>
                  <div className="job-summary-actions">
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => expandExperience(experience.id)}
                      aria-expanded="false"
                      aria-controls={`${prefix}-details-panel`}
                      aria-label={`Expand ${experienceTitle}`}
                      data-tooltip={`Expand ${experienceTitle}`}
                    >
                      <ChevronDown size={20} />
                    </button>
                    <button
                      className="icon-button icon-button-danger"
                      type="button"
                      onClick={() => removeExperience(experience.id)}
                      aria-label={removeLabel}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                <dl className="summary-list">
                  <div>
                    <dt>Dates</dt>
                    <dd>{formatDateRange(experience)}</dd>
                  </div>
                  <div>
                    <dt>Location</dt>
                    <dd>{formatLocation(experience)}</dd>
                  </div>
                  <div>
                    <dt>Supervisor</dt>
                    <dd>{experience.supervisorName || 'Not set'}</dd>
                  </div>
                </dl>
              </div>
            </section>
          );
        }

        return (
          <section
            className={`field-card job-transition-card ${isSaved ? 'job-expanded-card' : 'job-draft-card'}`}
            key={experience.id}
            aria-labelledby={isSaved ? `${prefix}-title` : undefined}
            id={`${prefix}-details-panel`}
          >
            <div className={isSaved ? 'job-summary-header' : 'job-draft-actions'}>
              {isSaved ? (
                <div className="job-summary-identity">
                  <h4 className="job-summary-title" id={`${prefix}-title`}>
                    {experienceTitle}
                  </h4>
                  <p className="job-summary-company">
                    {companyLabel}
                  </p>
                </div>
              ) : null}
              <div className="job-summary-actions">
                {isSaved ? (
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => collapseExperience(experience.id)}
                    aria-expanded="true"
                    aria-controls={`${prefix}-details-panel`}
                    aria-label={`Collapse ${experienceTitle}`}
                    data-tooltip={`Collapse ${experienceTitle}`}
                    disabled={isCollapsing}
                  >
                    <ChevronUp size={20} />
                  </button>
                ) : null}
                <button
                  className="icon-button icon-button-danger"
                  type="button"
                  onClick={() => removeExperience(experience.id)}
                  aria-label={removeLabel}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className={`job-details-motion ${isCollapsing ? 'job-details-exit' : ''}`}>
              <div className="job-details-content page-stack">
                <div className="form-grid">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor={`${prefix}-job-title`}>Job Title</label>
                <input
                  id={`${prefix}-job-title`}
                  type="text"
                  className="form-input"
                  value={experience.jobTitle}
                  onChange={(event) => updateExperience(experience.id, 'jobTitle', event.target.value)}
                  placeholder="e.g. Software Engineer"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor={`${prefix}-company`}>Company</label>
                <input
                  id={`${prefix}-company`}
                  type="text"
                  className="form-input"
                  value={experience.company}
                  onChange={(event) => updateExperience(experience.id, 'company', event.target.value)}
                  placeholder="e.g. Tech Corp"
                />
              </div>
            </div>

            <div className="employment-date-row employment-start-date-row">
              <div className="form-group employment-date-field" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor={`${prefix}-start-date`}>Start Date</label>
                <div className="date-input-row">
                  <Select
                    aria-label="Start Date Precision"
                    className="date-precision-select"
                    inputId={`${prefix}-start-date-precision`}
                    options={DATE_PRECISION_OPTIONS}
                    styles={selectStyles}
                    value={DATE_PRECISION_OPTIONS.find((option) => option.value === experience.startDatePrecision)}
                    onChange={(option) => updateDatePrecision(
                      experience.id,
                      'startDate',
                      option?.value ?? 'Exact'
                    )}
                    isSearchable={false}
                  />
                  <input
                    id={`${prefix}-start-date`}
                    type="text"
                    className="form-input"
                    value={experience.startDate}
                    onChange={(event) => updateExperience(experience.id, 'startDate', event.target.value)}
                    inputMode="numeric"
                    placeholder={getDatePlaceholder(experience.startDatePrecision)}
                  />
                </div>
                <p className="field-hint">{getDateHint('Start Date', experience.startDatePrecision)}</p>
              </div>
            </div>

            <div className="employment-date-row">
              <div className="form-group employment-date-field" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor={`${prefix}-end-date`}>End Date</label>
                <div className="date-input-row">
                  <Select
                    aria-label="End Date Precision"
                    className="date-precision-select"
                    inputId={`${prefix}-end-date-precision`}
                    options={DATE_PRECISION_OPTIONS}
                    styles={selectStyles}
                    value={DATE_PRECISION_OPTIONS.find((option) => option.value === experience.endDatePrecision)}
                    onChange={(option) => updateDatePrecision(
                      experience.id,
                      'endDate',
                      option?.value ?? 'Exact'
                    )}
                    isDisabled={experience.isCurrentJob}
                    isSearchable={false}
                  />
                  <input
                    id={`${prefix}-end-date`}
                    type="text"
                    className="form-input"
                    value={experience.endDate}
                    onChange={(event) => updateExperience(experience.id, 'endDate', event.target.value)}
                    disabled={experience.isCurrentJob}
                    aria-required={!experience.isCurrentJob}
                    inputMode="numeric"
                    placeholder={getDatePlaceholder(experience.endDatePrecision)}
                  />
                </div>
                <p className="field-hint">{getDateHint('End Date', experience.endDatePrecision)}</p>
              </div>
              <div className="form-group current-job-field" style={{ marginBottom: 0 }}>
                <span className="form-label" aria-hidden="true">Current Job</span>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={experience.isCurrentJob}
                    onChange={(event) => updateCurrentJob(experience.id, event.target.checked)}
                  />
                  I currently work here
                </label>
              </div>
            </div>

            <div>
              <h5 className="section-title">Location & Contact</h5>
              <hr className="subtle-divider" />
            </div>

            <div className="form-grid">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor={`${prefix}-address-1`}>Address Line 1</label>
                <input
                  id={`${prefix}-address-1`}
                  type="text"
                  className="form-input"
                  value={experience.address1}
                  onChange={(event) => updateExperience(experience.id, 'address1', event.target.value)}
                  placeholder="123 Main St"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor={`${prefix}-address-2`}>Address Line 2 (Optional)</label>
                <input
                  id={`${prefix}-address-2`}
                  type="text"
                  className="form-input"
                  value={experience.address2}
                  onChange={(event) => updateExperience(experience.id, 'address2', event.target.value)}
                  placeholder="Suite 100"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor={`${prefix}-city`}>City</label>
                <input
                  id={`${prefix}-city`}
                  type="text"
                  className="form-input"
                  value={experience.city}
                  onChange={(event) => updateExperience(experience.id, 'city', event.target.value)}
                />
              </div>
              <div className="form-grid">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor={`${prefix}-state`}>State/Province</label>
                  <Select
                    inputId={`${prefix}-state`}
                    options={STATE_OPTIONS}
                    styles={selectStyles}
                    value={experience.state}
                    onChange={(option) => updateExperience(experience.id, 'state', option as SelectOption | null)}
                    placeholder="Select State"
                    isClearable
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor={`${prefix}-postal-code`}>ZIP/Postal Code</label>
                  <input
                    id={`${prefix}-postal-code`}
                    type="text"
                    className="form-input"
                    value={experience.postalCode}
                    onChange={(event) => updateExperience(experience.id, 'postalCode', event.target.value)}
                  />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor={`${prefix}-country`}>Country</label>
                <Select
                  inputId={`${prefix}-country`}
                  options={COUNTRY_OPTIONS}
                  styles={selectStyles}
                  value={experience.country}
                  onChange={(option) => updateExperience(experience.id, 'country', option as SelectOption | null)}
                  isClearable
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor={`${prefix}-company-phone`}>Company Phone</label>
                <input
                  id={`${prefix}-company-phone`}
                  type="tel"
                  className="form-input"
                  value={experience.companyPhone}
                  onChange={(event) => updateExperience(experience.id, 'companyPhone', event.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor={`${prefix}-supervisor`}>Supervisor Name</label>
                <input
                  id={`${prefix}-supervisor`}
                  type="text"
                  className="form-input"
                  value={experience.supervisorName}
                  onChange={(event) => updateExperience(experience.id, 'supervisorName', event.target.value)}
                  placeholder="Jane Doe"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <span className="form-label" aria-hidden="true">Contact Permission</span>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={experience.mayContactSupervisor}
                    onChange={(event) => updateExperience(experience.id, 'mayContactSupervisor', event.target.checked)}
                  />
                  May prospective employer contact?
                </label>
              </div>
            </div>

            <RichTextEditor
              aiLabel="Rewrite experience details with AI"
              isAiEnhancing={isEnhancingDescription}
              label="Experience Details"
              labelId={`${prefix}-details-label`}
              onAiEnhance={() => handleAiEnhance(experience, 'description')}
              onChange={(value) => updateExperience(experience.id, 'description', value)}
              placeholder="Write your experience in a paragraph or as bullet points..."
              quillClassName="rich-text-quill-experience"
              toolbarId={toolbarId}
              value={experience.description}
            />

            <RichTextEditor
              aiLabel="Rewrite reason for leaving with AI"
              disabled={experience.isCurrentJob}
              isAiEnhancing={isEnhancingReason}
              label="Reason for Leaving"
              labelId={`${prefix}-reason-label`}
              onAiEnhance={() => handleAiEnhance(experience, 'reasonForLeaving')}
              onChange={(value) => updateExperience(experience.id, 'reasonForLeaving', value)}
              placeholder={experience.isCurrentJob ? 'Disabled for current job' : 'Explain why this job ended, if an application asks for it...'}
              quillClassName="rich-text-quill-reason"
              toolbarId={reasonToolbarId}
              value={experience.reasonForLeaving}
            />

                <div className="toolbar-row">
              {experience.rewriteMessage ? (
                <p className="section-copy" role="status">
                  {experience.rewriteMessage}
                </p>
              ) : (
                <span />
              )}
              <button className="btn btn-secondary" type="button" onClick={() => saveExperience(experience.id)}>
                Save Job
              </button>
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

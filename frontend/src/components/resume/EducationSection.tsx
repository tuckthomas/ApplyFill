import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import Select from 'react-select';
import { AlertCircle, ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react';

import { COUNTRY_OPTIONS, STATE_OPTIONS, selectStyles } from '../../constants/location';

export type SelectOption = {
  value: string;
  label: string;
};

type EducationDatePrecision = 'Exact' | 'Estimated';
type EducationDateField = 'startDate' | 'endDate';

export type EducationEntry = {
  id: number;
  level: SelectOption | null;
  fieldOfStudy: string;
  provider: string;
  country: SelectOption | null;
  city: string;
  state: SelectOption | null;
  isRemote: boolean;
  isCurrentlyEnrolled: boolean;
  startDate: string;
  startDatePrecision: EducationDatePrecision;
  endDate: string;
  endDatePrecision: EducationDatePrecision;
  additionalDetails: string;
  isEditing: boolean;
  isSaved: boolean;
};

type ValidationDialogState = {
  educationLabel: string;
  messages: string[];
};

const EDUCATION_LEVEL_OPTIONS: SelectOption[] = [
  { value: 'High school diploma or GED', label: 'High school diploma or GED' },
  { value: 'Associate degree', label: 'Associate degree' },
  { value: 'Bachelor of Arts', label: 'Bachelor of Arts' },
  { value: 'Bachelor of Science', label: 'Bachelor of Science' },
  { value: 'Master of Arts', label: 'Master of Arts' },
  { value: 'Master of Science', label: 'Master of Science' },
  { value: 'MBA', label: 'MBA' },
  { value: 'Doctorate', label: 'Doctorate' },
  { value: 'Certificate', label: 'Certificate' },
  { value: 'Vocational training', label: 'Vocational training' },
  { value: 'Online course', label: 'Online course' },
  { value: 'Other', label: 'Other' }
];

const DATE_PRECISION_OPTIONS: Array<{ value: EducationDatePrecision; label: string }> = [
  { value: 'Exact', label: 'Exact' },
  { value: 'Estimated', label: 'Estimated' }
];

const createEducation = (id: number): EducationEntry => ({
  id,
  level: null,
  fieldOfStudy: '',
  provider: '',
  country: COUNTRY_OPTIONS.find((option) => option.value === 'United States') ?? null,
  city: '',
  state: null,
  isRemote: false,
  isCurrentlyEnrolled: false,
  startDate: '',
  startDatePrecision: 'Exact',
  endDate: '',
  endDatePrecision: 'Exact',
  additionalDetails: '',
  isEditing: true,
  isSaved: false
});

type EducationSectionProps = {
  educations: EducationEntry[];
  onChange: Dispatch<SetStateAction<EducationEntry[]>>;
};

export default function EducationSection({ educations, onChange }: EducationSectionProps) {
  const [validationDialog, setValidationDialog] = useState<ValidationDialogState | null>(null);
  const setEducations = onChange;

  const addEducation = () => {
    setEducations((current) => [...current, createEducation(Date.now())]);
  };

  const removeEducation = (id: number) => {
    setEducations((current) => current.filter((education) => education.id !== id));
  };

  const updateEducation = <Key extends keyof EducationEntry>(
    id: number,
    key: Key,
    value: EducationEntry[Key]
  ) => {
    setEducations((current) => current.map((education) => (
      education.id === id ? { ...education, [key]: value } : education
    )));
  };

  const updateDatePrecision = (
    id: number,
    field: EducationDateField,
    precision: EducationDatePrecision
  ) => {
    const precisionKey = field === 'startDate' ? 'startDatePrecision' : 'endDatePrecision';
    setEducations((current) => current.map((education) => (
      education.id === id ? { ...education, [field]: '', [precisionKey]: precision } : education
    )));
  };

  const updateCurrentEnrollment = (id: number, checked: boolean) => {
    setEducations((current) => current.map((education) => (
      education.id === id
        ? {
          ...education,
          isCurrentlyEnrolled: checked,
          endDate: checked ? '' : education.endDate,
          endDatePrecision: checked ? 'Exact' : education.endDatePrecision
        }
        : education
    )));
  };

  const saveEducation = (id: number) => {
    const education = educations.find((entry) => entry.id === id);
    if (!education) {
      return;
    }

    const messages = getEducationValidationMessages(education);
    if (messages.length > 0) {
      setValidationDialog({
        educationLabel: getEducationTitle(education),
        messages
      });
      updateEducation(id, 'isEditing', true);
      return;
    }

    setValidationDialog(null);
    setEducations((current) => current.map((education) => (
      education.id === id
        ? {
          ...education,
          endDate: education.isCurrentlyEnrolled ? '' : education.endDate,
          endDatePrecision: education.isCurrentlyEnrolled ? 'Exact' : education.endDatePrecision,
          isEditing: false,
          isSaved: true
        }
        : education
    )));
  };

  const getEducationValidationMessages = (education: EducationEntry) => {
    const startDate = parseEducationDateValue(education.startDate, education.startDatePrecision, true);
    const endDate = parseEducationDateValue(education.endDate, education.endDatePrecision, false);
    const messages: string[] = [];

    if (!education.level) {
      messages.push('Level of education is required.');
    }

    if (!education.provider.trim()) {
      messages.push('School or training provider is required.');
    }

    if (!education.startDate.trim()) {
      messages.push('From date is required.');
    } else if (!startDate.isValid) {
      messages.push(getDateValidationMessage('From date', education.startDatePrecision));
    }

    if (!education.isCurrentlyEnrolled && !education.endDate.trim()) {
      messages.push('To date is required unless Currently enrolled is checked.');
    } else if (!education.isCurrentlyEnrolled && !endDate.isValid) {
      messages.push(getDateValidationMessage('To date', education.endDatePrecision));
    }

    if (!education.isCurrentlyEnrolled && startDate.time !== null && endDate.time !== null && endDate.time < startDate.time) {
      messages.push('To date cannot be before From date.');
    }

    return messages;
  };

  const expandEducation = (id: number) => {
    updateEducation(id, 'isEditing', true);
  };

  const collapseEducation = (id: number) => {
    updateEducation(id, 'isEditing', false);
  };

  const getEducationTitle = (education: EducationEntry) => {
    return education.level?.label || 'this education entry';
  };

  const formatDateRange = (education: EducationEntry) => {
    if (!education.startDate && !education.endDate && !education.isCurrentlyEnrolled) {
      return 'Dates not set';
    }

    const endDate = education.isCurrentlyEnrolled ? 'Present' : formatDisplayDate(education.endDate, education.endDatePrecision);
    return `${formatDisplayDate(education.startDate, education.startDatePrecision) || 'From not set'} - ${endDate || 'To not set'}`;
  };

  const formatDisplayDate = (value: string, precision: EducationDatePrecision) => {
    if (!value) {
      return '';
    }

    return precision === 'Estimated' ? `Estimated ${value}` : value;
  };

  const formatLocation = (education: EducationEntry) => {
    if (education.isRemote) {
      return 'Remote';
    }

    const locationParts = [
      education.city,
      education.state?.value,
      education.country?.value
    ].filter(Boolean);

    return locationParts.length > 0 ? locationParts.join(', ') : 'Location not set';
  };

  const parseEducationDateValue = (
    value: string,
    precision: EducationDatePrecision,
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

    const exactMatch = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(\d{4})$/.exec(value);

    if (!exactMatch) {
      return { isValid: false, time: null };
    }

    const month = Number(exactMatch[1]);
    const day = Number(exactMatch[2]);
    const year = Number(exactMatch[3]);
    const time = Date.UTC(year, month - 1, day);
    const date = new Date(time);
    const isValid = (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );

    return { isValid, time: isValid ? time : null };
  };

  const getDatePlaceholder = (precision: EducationDatePrecision) => {
    return precision === 'Estimated' ? 'MM/YYYY' : 'MM/DD/YYYY';
  };

  const getDateHint = (fieldLabel: string, precision: EducationDatePrecision) => {
    if (precision === 'Exact') {
      return `${fieldLabel} will be used exactly as entered.`;
    }

    return fieldLabel === 'From'
      ? 'Estimated from dates use the first day of the selected month for autofill.'
      : 'Estimated to dates use the last day of the selected month for autofill.';
  };

  const getDateValidationMessage = (fieldLabel: string, precision: EducationDatePrecision) => {
    return precision === 'Estimated'
      ? `${fieldLabel} must use MM/YYYY when Estimated is selected.`
      : `${fieldLabel} must use MM/DD/YYYY when Exact is selected.`;
  };

  return (
    <div className="page-stack">
      {validationDialog ? (
        <div className="validation-dialog-backdrop" role="presentation" onClick={() => setValidationDialog(null)}>
          <section
            aria-labelledby="education-validation-title"
            aria-modal="true"
            className="validation-dialog"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="validation-dialog-header">
              <div className="validation-dialog-heading">
                <AlertCircle size={22} aria-hidden="true" />
                <h4 id="education-validation-title">Missing or Invalid Education Information</h4>
              </div>
              <button
                aria-label="Close education validation message"
                className="icon-button"
                type="button"
                onClick={() => setValidationDialog(null)}
              >
                <X size={20} />
              </button>
            </div>
            <p className="section-copy">
              Fix these items for {validationDialog.educationLabel} before saving.
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
          <h3 className="section-title">Education</h3>
          <p className="section-copy">
            Add degrees, diplomas, online courses, and vocational training used for job applications.
          </p>
        </div>
        <button className="btn btn-secondary btn-add-action" type="button" onClick={addEducation}>
          <Plus size={18} />
          Add Education
        </button>
      </div>

      {educations.length === 0 ? (
        <section className="field-card job-empty-state" aria-label="No education added">
          <h4 className="section-title">No education added</h4>
        </section>
      ) : null}

      {educations.map((education, index) => {
        const prefix = `education-${education.id}`;
        const educationTitle = getEducationTitle(education);
        const providerLabel = education.provider.trim() || 'Provider not set';
        const removeLabel = education.provider.trim()
          ? `Remove ${education.provider}`
          : `Remove education ${index + 1}`;

        if (education.isSaved && !education.isEditing) {
          return (
            <section className="field-card job-transition-card" key={education.id} aria-labelledby={`${prefix}-summary-title`}>
              <div className="job-summary">
                <div className="job-summary-header">
                  <div className="job-summary-identity">
                    <h4 className="job-summary-title" id={`${prefix}-summary-title`}>{educationTitle}</h4>
                    <p className="job-summary-company">{providerLabel}</p>
                  </div>
                  <div className="job-summary-actions">
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => expandEducation(education.id)}
                      aria-expanded="false"
                      aria-controls={`${prefix}-details-panel`}
                      aria-label={`Expand ${educationTitle}`}
                      data-tooltip={`Expand ${educationTitle}`}
                    >
                      <ChevronDown size={20} />
                    </button>
                    <button
                      className="icon-button icon-button-danger"
                      type="button"
                      onClick={() => removeEducation(education.id)}
                      aria-label={removeLabel}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                <dl className="summary-list">
                  <div>
                    <dt>Field</dt>
                    <dd>{education.fieldOfStudy || 'Not set'}</dd>
                  </div>
                  <div>
                    <dt>Dates</dt>
                    <dd>{formatDateRange(education)}</dd>
                  </div>
                  <div>
                    <dt>Location</dt>
                    <dd>{formatLocation(education)}</dd>
                  </div>
                </dl>
              </div>
            </section>
          );
        }

        return (
          <section
            className={`field-card job-transition-card ${education.isSaved ? 'job-expanded-card' : 'job-draft-card'}`}
            key={education.id}
            aria-labelledby={education.isSaved ? `${prefix}-title` : undefined}
            id={`${prefix}-details-panel`}
          >
            <div className={education.isSaved ? 'job-summary-header' : 'job-draft-actions'}>
              {education.isSaved ? (
                <div className="job-summary-identity">
                  <h4 className="job-summary-title" id={`${prefix}-title`}>{educationTitle}</h4>
                  <p className="job-summary-company">{providerLabel}</p>
                </div>
              ) : null}
              <div className="job-summary-actions">
                {education.isSaved ? (
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => collapseEducation(education.id)}
                    aria-expanded="true"
                    aria-controls={`${prefix}-details-panel`}
                    aria-label={`Collapse ${educationTitle}`}
                    data-tooltip={`Collapse ${educationTitle}`}
                  >
                    <ChevronUp size={20} />
                  </button>
                ) : null}
                <button
                  className="icon-button icon-button-danger"
                  type="button"
                  onClick={() => removeEducation(education.id)}
                  aria-label={removeLabel}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className="page-stack">
              <div className="form-grid">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor={`${prefix}-level`}>Level of Education</label>
                  <Select
                    inputId={`${prefix}-level`}
                    options={EDUCATION_LEVEL_OPTIONS}
                    styles={selectStyles}
                    value={education.level}
                    onChange={(option) => updateEducation(education.id, 'level', option as SelectOption | null)}
                    placeholder="Select level"
                    isClearable
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor={`${prefix}-field`}>Field of Study</label>
                  <input
                    id={`${prefix}-field`}
                    className="form-input"
                    type="text"
                    value={education.fieldOfStudy}
                    onChange={(event) => updateEducation(education.id, 'fieldOfStudy', event.target.value)}
                    placeholder="e.g. Finance"
                  />
                </div>
                <div className="form-group form-grid-full" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor={`${prefix}-provider`}>School or Training Provider</label>
                  <input
                    id={`${prefix}-provider`}
                    className="form-input"
                    type="text"
                    value={education.provider}
                    onChange={(event) => updateEducation(education.id, 'provider', event.target.value)}
                    placeholder="e.g. Ball State University"
                  />
                </div>
              </div>

              <div>
                <h5 className="section-title">Location</h5>
                <hr className="subtle-divider" />
              </div>

              <div className="form-grid">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor={`${prefix}-country`}>Country</label>
                  <Select
                    inputId={`${prefix}-country`}
                    options={COUNTRY_OPTIONS}
                    styles={selectStyles}
                    value={education.country}
                    onChange={(option) => updateEducation(education.id, 'country', option as SelectOption | null)}
                    isClearable
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <span className="form-label" aria-hidden="true">Remote Learning</span>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={education.isRemote}
                      onChange={(event) => updateEducation(education.id, 'isRemote', event.target.checked)}
                    />
                    This was remote
                  </label>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor={`${prefix}-city`}>City</label>
                  <input
                    id={`${prefix}-city`}
                    className="form-input"
                    type="text"
                    value={education.city}
                    onChange={(event) => updateEducation(education.id, 'city', event.target.value)}
                    placeholder="Use remote if this was remote"
                    disabled={education.isRemote}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor={`${prefix}-state`}>State/Province</label>
                  <Select
                    inputId={`${prefix}-state`}
                    options={STATE_OPTIONS}
                    styles={selectStyles}
                    value={education.state}
                    onChange={(option) => updateEducation(education.id, 'state', option as SelectOption | null)}
                    placeholder="Select State"
                    isClearable
                    isDisabled={education.isRemote}
                  />
                </div>
              </div>

              <div>
                <h5 className="section-title">Time Period</h5>
                <hr className="subtle-divider" />
              </div>

              <div className="employment-date-row employment-start-date-row">
                <div className="form-group employment-date-field" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor={`${prefix}-start-date`}>From</label>
                  <div className="date-input-row">
                    <Select
                      aria-label="From Date Precision"
                      className="date-precision-select"
                      inputId={`${prefix}-start-date-precision`}
                      options={DATE_PRECISION_OPTIONS}
                      styles={selectStyles}
                      value={DATE_PRECISION_OPTIONS.find((option) => option.value === education.startDatePrecision)}
                      onChange={(option) => updateDatePrecision(education.id, 'startDate', option?.value ?? 'Exact')}
                      isSearchable={false}
                    />
                    <input
                      id={`${prefix}-start-date`}
                      type="text"
                      className="form-input"
                      value={education.startDate}
                      onChange={(event) => updateEducation(education.id, 'startDate', event.target.value)}
                      inputMode="numeric"
                      placeholder={getDatePlaceholder(education.startDatePrecision)}
                    />
                  </div>
                  <p className="field-hint">{getDateHint('From', education.startDatePrecision)}</p>
                </div>
              </div>

              <div className="employment-date-row">
                <div className="form-group employment-date-field" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor={`${prefix}-end-date`}>To</label>
                  <div className="date-input-row">
                    <Select
                      aria-label="To Date Precision"
                      className="date-precision-select"
                      inputId={`${prefix}-end-date-precision`}
                      options={DATE_PRECISION_OPTIONS}
                      styles={selectStyles}
                      value={DATE_PRECISION_OPTIONS.find((option) => option.value === education.endDatePrecision)}
                      onChange={(option) => updateDatePrecision(education.id, 'endDate', option?.value ?? 'Exact')}
                      isDisabled={education.isCurrentlyEnrolled}
                      isSearchable={false}
                    />
                    <input
                      id={`${prefix}-end-date`}
                      type="text"
                      className="form-input"
                      value={education.endDate}
                      onChange={(event) => updateEducation(education.id, 'endDate', event.target.value)}
                      disabled={education.isCurrentlyEnrolled}
                      aria-required={!education.isCurrentlyEnrolled}
                      inputMode="numeric"
                      placeholder={getDatePlaceholder(education.endDatePrecision)}
                    />
                  </div>
                  <p className="field-hint">{getDateHint('To', education.endDatePrecision)}</p>
                </div>
                <div className="form-group current-job-field" style={{ marginBottom: 0 }}>
                  <span className="form-label" aria-hidden="true">Currently Enrolled</span>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={education.isCurrentlyEnrolled}
                      onChange={(event) => updateCurrentEnrollment(education.id, event.target.checked)}
                    />
                    I am currently enrolled
                  </label>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label className="form-label" htmlFor={`${prefix}-details`}>Additional Details</label>
                <textarea
                  id={`${prefix}-details`}
                  className="form-input"
                  value={education.additionalDetails}
                  onChange={(event) => updateEducation(education.id, 'additionalDetails', event.target.value)}
                  placeholder="Include relevant projects, achievements, affiliations, coursework, or honors."
                  rows={5}
                />
              </div>

              <div className="toolbar-row">
                <span />
                <button className="btn btn-secondary" type="button" onClick={() => saveEducation(education.id)}>
                  Save Education
                </button>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

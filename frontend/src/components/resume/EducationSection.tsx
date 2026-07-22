import { useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import Select from '../ui/AppSelect';
import { ChevronDown, Trash2 } from 'lucide-react';

import { selectStyles } from '../../constants/location';
import DatePicker from '../ui/DatePicker';
import ValidationDialog from '../ui/ValidationDialog';
import Checkbox from '../ui/Checkbox';
import FormModal from '../ui/FormModal';
import RepeatableSectionHeader from '../ui/RepeatableSectionHeader';
import RepeatableEmptyState from '../ui/RepeatableEmptyState';
import EntrySortControl from '../ui/EntrySortControl';
import { readEntrySortOrder, sortEntries } from '../ui/entrySorting';
import type { EntrySortOrder } from '../ui/entrySorting';
import AddressFlow from '../ui/AddressFlow';
import type { AddressValue } from '../ui/AddressFlow';
import RichTextEditor from './RichTextEditor';
import { useDateFormatPreference } from '../../features/preferences/dateFormatPreference';
import { formatExactDateForDisplay } from '../ui/datePickerUtils';

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
  gpa: string;
  gpaScale: string;
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

const createEducation = (id: number, defaultCountry: SelectOption | null): EducationEntry => ({
  id,
  level: null,
  fieldOfStudy: '',
  provider: '',
  country: defaultCountry ? { ...defaultCountry } : null,
  city: '',
  state: null,
  isRemote: false,
  isCurrentlyEnrolled: false,
  startDate: '',
  startDatePrecision: 'Exact',
  endDate: '',
  endDatePrecision: 'Exact',
  gpa: '',
  gpaScale: '',
  additionalDetails: '',
  isEditing: true,
  isSaved: false
});

type EducationSectionProps = {
  defaultCountry: SelectOption | null;
  educations: EducationEntry[];
  onChange: Dispatch<SetStateAction<EducationEntry[]>>;
};

export default function EducationSection({ defaultCountry, educations, onChange }: EducationSectionProps) {
  const { dateFormat } = useDateFormatPreference();
  const [validationDialog, setValidationDialog] = useState<ValidationDialogState | null>(null);
  const [sortOrder, setSortOrder] = useState<EntrySortOrder>(() => readEntrySortOrder('applyfill.education-sort'));
  const setEducations = onChange;

  const addEducation = () => {
    setEducations((current) => [
      ...current.map((education) => ({ ...education, isEditing: false })),
      createEducation(Date.now(), defaultCountry)
    ]);
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
          gpa: formatGpaDecimal(education.gpa),
          gpaScale: formatGpaDecimal(education.gpaScale),
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

    const hasGpa = education.gpa.trim().length > 0;
    const hasGpaScale = education.gpaScale.trim().length > 0;
    const gpa = Number(education.gpa);
    const gpaScale = Number(education.gpaScale);

    if (hasGpa !== hasGpaScale) {
      messages.push('Enter both GPA and GPA scale, or leave both blank.');
    } else if (hasGpa && (!Number.isFinite(gpa) || gpa < 0 || gpa > 100)) {
      messages.push('GPA must be a number from 0 to 100.');
    } else if (hasGpaScale && (!Number.isFinite(gpaScale) || gpaScale <= 0 || gpaScale > 100)) {
      messages.push('GPA scale must be greater than zero and no more than 100.');
    } else if (hasGpa && hasGpaScale && gpa > gpaScale) {
      messages.push('GPA cannot be greater than the GPA scale.');
    }

    return messages;
  };

  const expandEducation = (id: number) => {
    setEducations((current) => current.map((education) => ({
      ...education,
      isEditing: education.id === id
    })));
  };

  const collapseEducation = (id: number) => {
    updateEducation(id, 'isEditing', false);
  };

  const closeEducationForm = (education: EducationEntry) => {
    setValidationDialog(null);
    if (education.isSaved) {
      collapseEducation(education.id);
    } else {
      removeEducation(education.id);
    }
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

    return precision === 'Estimated' ? `Estimated ${value}` : formatExactDateForDisplay(value, dateFormat);
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

  const formatGpaDecimal = (value: string) => {
    if (!value.trim()) return '';
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(2) : value;
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

  const sortedEducations = useMemo(() => sortEntries(educations, sortOrder, {
    getEndTime: (education) => education.isCurrentlyEnrolled
      ? Number.MAX_SAFE_INTEGER
      : parseEducationDateValue(education.endDate, education.endDatePrecision, false).time,
    getLabel: (education) => education.provider,
    getStartTime: (education) => parseEducationDateValue(
      education.startDate,
      education.startDatePrecision,
      true
    ).time,
    isDraft: (education) => !education.isSaved
  }), [educations, sortOrder]);

  const changeSortOrder = (order: EntrySortOrder) => {
    setSortOrder(order);
    localStorage.setItem('applyfill.education-sort', order);
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
      : `${fieldLabel} must use ${dateFormat} when Exact is selected.`;
  };

  return (
    <div className="page-stack">
      {validationDialog ? (
        <ValidationDialog
          closeLabel="Close education validation message"
          description={`Fix these items for ${validationDialog.educationLabel} before saving.`}
          messages={validationDialog.messages}
          onClose={() => setValidationDialog(null)}
          title="Missing or Invalid Education Information"
          titleId="education-validation-title"
        />
      ) : null}

      <RepeatableSectionHeader
        actionLabel="Add Education"
        description="Add degrees, diplomas, online courses, and vocational training used for job applications."
        onAdd={addEducation}
        title="Education"
      />

      {educations.filter((education) => education.isSaved).length > 1 ? (
        <div className="entry-sort-toolbar">
          <EntrySortControl
            alphaLabel="School"
            inputId="education-sort"
            onChange={changeSortOrder}
            value={sortOrder}
          />
        </div>
      ) : null}

      {educations.length === 0 ? (
        <RepeatableEmptyState title="No Education Added" />
      ) : null}

      {sortedEducations.map((education, index) => {
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
                  <div>
                    <dt>GPA</dt>
                    <dd>{education.gpa && education.gpaScale ? `${education.gpa} / ${education.gpaScale}` : 'Not set'}</dd>
                  </div>
                </dl>
              </div>
            </section>
          );
        }

        return (
          <FormModal
            className="education-modal-dialog"
            closeLabel={education.isSaved ? `Close edit ${educationTitle}` : 'Close add education'}
            description="Add the education details once so they can be reused in applications and generated resumes."
            dirtyKey={JSON.stringify(education)}
            initialFocusId={`${prefix}-level`}
            isOpen={!validationDialog}
            key={education.id}
            onClose={() => closeEducationForm(education)}
            title={education.isSaved ? `Edit ${educationTitle}` : 'Add education'}
          >
            <form
              autoComplete="on"
              className="page-stack education-modal-form"
              onSubmit={(event) => {
                event.preventDefault();
                saveEducation(education.id);
              }}
            >
              <div>
                <h5 className="section-title">Education Details</h5>
                <hr className="subtle-divider" />
              </div>

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

              <AddressFlow
                idPrefix={prefix}
                mode="locality"
                onChange={(field, value) => updateEducation(
                  education.id,
                  field as keyof EducationEntry,
                  value as EducationEntry[keyof EducationEntry]
                )}
                remoteControl={{
                  checked: education.isRemote,
                  label: 'This was remote',
                  onChange: (checked) => updateEducation(education.id, 'isRemote', checked)
                }}
                value={education as AddressValue}
              />

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
                    <DatePicker
                      id={`${prefix}-start-date`}
                      ariaLabel="From date"
                      value={education.startDate}
                      precision={education.startDatePrecision}
                      onChange={(value) => updateEducation(education.id, 'startDate', value)}
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
                    <DatePicker
                      id={`${prefix}-end-date`}
                      ariaLabel="To date"
                      value={education.endDate}
                      precision={education.endDatePrecision}
                      onChange={(value) => updateEducation(education.id, 'endDate', value)}
                      disabled={education.isCurrentlyEnrolled}
                      required={!education.isCurrentlyEnrolled}
                    />
                  </div>
                  <p className="field-hint">{getDateHint('To', education.endDatePrecision)}</p>
                </div>
                <div className="form-group current-job-field" style={{ marginBottom: 0 }}>
                  <span className="form-label" aria-hidden="true">Currently Enrolled</span>
                  <Checkbox
                    checked={education.isCurrentlyEnrolled}
                    label="I am currently enrolled"
                    onChange={(event) => updateCurrentEnrollment(education.id, event.target.checked)}
                  />
                </div>
              </div>

              <div>
                <h5 className="section-title">Academic Performance</h5>
                <hr className="subtle-divider" />
              </div>

              <div className="form-grid">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor={`${prefix}-gpa`}>GPA (Optional)</label>
                  <input
                    className="form-input"
                    id={`${prefix}-gpa`}
                    inputMode="decimal"
                    max="100"
                    min="0"
                    onBlur={() => updateEducation(education.id, 'gpa', formatGpaDecimal(education.gpa))}
                    onChange={(event) => updateEducation(education.id, 'gpa', event.target.value)}
                    placeholder="e.g. 3.75"
                    step="0.01"
                    type="number"
                    value={education.gpa}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor={`${prefix}-gpa-scale`}>GPA Scale (Optional)</label>
                  <input
                    className="form-input"
                    id={`${prefix}-gpa-scale`}
                    inputMode="decimal"
                    max="100"
                    min="0.01"
                    onBlur={() => updateEducation(education.id, 'gpaScale', formatGpaDecimal(education.gpaScale))}
                    onChange={(event) => updateEducation(education.id, 'gpaScale', event.target.value)}
                    placeholder="e.g. 4.00"
                    step="0.01"
                    type="number"
                    value={education.gpaScale}
                  />
                </div>
                <p className="field-hint form-grid-full">Enter the grading scale used by the school, such as 4.00, 5.00, 10.00, or 100.00.</p>
              </div>

              <RichTextEditor
                label="Additional Details"
                labelId={`${prefix}-details-label`}
                onChange={(value) => updateEducation(education.id, 'additionalDetails', value)}
                placeholder="Include relevant projects, achievements, affiliations, coursework, or honors."
                toolbarId={`${prefix}-details-toolbar`}
                value={education.additionalDetails}
              />

              <div className="modal-form-actions">
                <button className="btn btn-secondary" data-modal-close type="button" onClick={() => closeEducationForm(education)}>
                  Cancel
                </button>
                <button className="btn btn-primary" type="submit">Save Education</button>
              </div>
            </form>
          </FormModal>
        );
      })}
    </div>
  );
}

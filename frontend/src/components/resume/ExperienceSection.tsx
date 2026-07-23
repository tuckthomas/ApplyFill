import { useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import Select from '../ui/AppSelect';

import { selectStyles } from '../../constants/location';
import RichTextEditor from './RichTextEditor';
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
import { useDateFormatPreference } from '../../features/preferences/dateFormatPreference';
import { formatExactDateForDisplay } from '../ui/datePickerUtils';
import {
  formatPhoneNumber,
  normalizePhoneNumber
} from '../../features/profile/phoneNumber';
import { EMPTY_RICH_TEXT_VALUE } from '../../features/rich-text/richText';

type SelectOption = {
  value: string;
  label: string;
};

type EmploymentDatePrecision = 'Exact' | 'Estimated';
type EmploymentDateField = 'startDate' | 'endDate';

export type ExperienceEntry = {
  id: number;
  employmentGroupId: number;
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

const createExperience = (id: number, defaultCountry: SelectOption | null): ExperienceEntry => ({
  id,
  employmentGroupId: id,
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
  country: defaultCountry ? { ...defaultCountry } : null,
  companyPhone: '',
  supervisorName: '',
  mayContactSupervisor: false,
  description: EMPTY_RICH_TEXT_VALUE,
  reasonForLeaving: EMPTY_RICH_TEXT_VALUE,
  rewriteMessage: '',
  validationMessage: '',
  isEditing: true,
  isSaved: false
});

const DATE_PRECISION_OPTIONS: Array<{ value: EmploymentDatePrecision; label: string }> = [
  { value: 'Exact', label: 'Exact' },
  { value: 'Estimated', label: 'Estimated' }
];

type ExperienceSectionProps = {
  defaultCountry: SelectOption | null;
  experiences: ExperienceEntry[];
  onChange: Dispatch<SetStateAction<ExperienceEntry[]>>;
};

export default function ExperienceSection({ defaultCountry, experiences, onChange }: ExperienceSectionProps) {
  const { dateFormat } = useDateFormatPreference();
  const [validationDialog, setValidationDialog] = useState<ValidationDialogState | null>(null);
  const [sortOrder, setSortOrder] = useState<EntrySortOrder>(() => readEntrySortOrder('applyfill.experience-sort'));
  const [companyPhoneDrafts, setCompanyPhoneDrafts] = useState<Record<number, string>>({});
  const setExperiences = onChange;
  const employerFields = new Set<keyof ExperienceEntry>([
    'company', 'address1', 'address2', 'city', 'state', 'postalCode', 'country',
    'companyPhone', 'supervisorName', 'mayContactSupervisor', 'reasonForLeaving'
  ]);

  const updateExperience = <Key extends keyof ExperienceEntry>(
    id: number,
    key: Key,
    value: ExperienceEntry[Key]
  ) => {
    setExperiences((current) => {
      const target = current.find((experience) => experience.id === id);
      if (!target) return current;
      return current.map((experience) => {
        if (
          experience.id === id
          || (employerFields.has(key) && experience.employmentGroupId === target.employmentGroupId)
        ) {
          return { ...experience, [key]: value };
        }

        const isFollowingRole = experience.employmentGroupId === target.employmentGroupId
          && experience.startDate === target.endDate
          && experience.startDatePrecision === target.endDatePrecision;
        if (key === 'endDate' && isFollowingRole) {
          return { ...experience, startDate: value as string };
        }
        if (key === 'endDatePrecision' && isFollowingRole) {
          return { ...experience, startDatePrecision: value as EmploymentDatePrecision };
        }
        const isPreviousRole = experience.employmentGroupId === target.employmentGroupId
          && experience.endDate === target.startDate
          && experience.endDatePrecision === target.startDatePrecision;
        if (key === 'startDate' && isPreviousRole) {
          return { ...experience, endDate: value as string };
        }
        if (key === 'startDatePrecision' && isPreviousRole) {
          return { ...experience, endDatePrecision: value as EmploymentDatePrecision };
        }
        return experience;
      });
    });
  };

  const addExperience = () => {
    const experience = createExperience(Date.now(), defaultCountry);
    setExperiences((current) => [
      ...current.map((entry) => ({ ...entry, isEditing: false })),
      experience
    ]);
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
    setCompanyPhoneDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
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

    const roles = experiences
      .filter((entry) => entry.employmentGroupId === experience.employmentGroupId)
      .sort((left, right) => (
        (parseEmploymentDateValue(left.startDate, left.startDatePrecision, true).time ?? 0)
        - (parseEmploymentDateValue(right.startDate, right.startDatePrecision, true).time ?? 0)
      ));
    const roleIndex = roles.findIndex((entry) => entry.id === experience.id);
    const previousRole = roles[roleIndex - 1];
    const nextRole = roles[roleIndex + 1];
    if (previousRole && (
      experience.startDate !== previousRole.endDate
      || experience.startDatePrecision !== previousRole.endDatePrecision
    )) {
      messages.push('This role’s Start Date must match the previous role’s End Date.');
    }
    if (nextRole && (
      experience.endDate !== nextRole.startDate
      || experience.endDatePrecision !== nextRole.startDatePrecision
    )) {
      messages.push('This role’s End Date must match the next role’s Start Date.');
    }
    if (experience.isCurrentJob && nextRole) {
      messages.push('Only the most recent role at an employer can be current.');
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
    setExperiences((current) => current.map((experience) => ({
      ...experience,
      isEditing: experience.id === id
    })));
  };

  const removeExperience = (id: number) => {
    setExperiences((current) => {
      const removed = current.find((experience) => experience.id === id);
      if (!removed) return current;
      const roles = current
        .filter((experience) => experience.employmentGroupId === removed.employmentGroupId)
        .sort((left, right) => (
          (parseEmploymentDateValue(left.startDate, left.startDatePrecision, true).time ?? 0)
          - (parseEmploymentDateValue(right.startDate, right.startDatePrecision, true).time ?? 0)
        ));
      const removedIndex = roles.findIndex((experience) => experience.id === id);
      const previous = roles[removedIndex - 1];
      const next = roles[removedIndex + 1];
      return current
        .filter((experience) => experience.id !== id)
        .map((experience) => experience.id === next?.id && previous
          ? {
              ...experience,
              startDate: previous.endDate,
              startDatePrecision: previous.endDatePrecision,
            }
          : experience);
    });
  };

  const removeEmployer = (employmentGroupId: number) => {
    setExperiences((current) => current.filter((experience) => experience.employmentGroupId !== employmentGroupId));
  };

  const addRole = (employmentGroupId: number) => {
    const group = experiences.filter((experience) => experience.employmentGroupId === employmentGroupId);
    const previous = [...group].sort((left, right) => {
      const leftTime = parseEmploymentDateValue(left.endDate || left.startDate, left.endDatePrecision, false).time ?? 0;
      const rightTime = parseEmploymentDateValue(right.endDate || right.startDate, right.endDatePrecision, false).time ?? 0;
      return rightTime - leftTime;
    })[0];
    if (!previous?.endDate || previous.isCurrentJob) return;
    const next = {
      ...createExperience(Date.now(), defaultCountry),
      employmentGroupId,
      company: previous.company,
      address1: previous.address1,
      address2: previous.address2,
      city: previous.city,
      state: previous.state,
      postalCode: previous.postalCode,
      country: previous.country,
      companyPhone: previous.companyPhone,
      supervisorName: previous.supervisorName,
      mayContactSupervisor: previous.mayContactSupervisor,
      reasonForLeaving: previous.reasonForLeaving,
      startDate: previous.endDate,
      startDatePrecision: previous.endDatePrecision,
    };
    setExperiences((current) => [
      ...current.map((experience) => ({ ...experience, isEditing: false })),
      next,
    ]);
  };

  const closeExperienceForm = (experience: ExperienceEntry) => {
    setValidationDialog(null);
    if (experience.isSaved) {
      updateExperience(experience.id, 'isEditing', false);
    } else {
      removeExperience(experience.id);
    }
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

    return precision === 'Estimated' ? `Estimated ${value}` : formatExactDateForDisplay(value, dateFormat);
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

  const sortedExperiences = useMemo(() => sortEntries(experiences, sortOrder, {
    getEndTime: (experience) => experience.isCurrentJob
      ? Number.MAX_SAFE_INTEGER
      : parseEmploymentDateValue(experience.endDate, experience.endDatePrecision, false).time,
    getLabel: (experience) => experience.jobTitle,
    getStartTime: (experience) => parseEmploymentDateValue(
      experience.startDate,
      experience.startDatePrecision,
      true
    ).time,
    isDraft: (experience) => !experience.isSaved
  }), [experiences, sortOrder]);

  const changeSortOrder = (order: EntrySortOrder) => {
    setSortOrder(order);
    localStorage.setItem('applyfill.experience-sort', order);
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
      : `${fieldLabel} must use ${dateFormat} when Exact is selected.`;
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
        <ValidationDialog
          closeLabel="Close job validation message"
          description={`Fix these items for ${validationDialog.jobLabel} before saving.`}
          messages={validationDialog.messages}
          onClose={() => setValidationDialog(null)}
          title="Missing or Invalid Job Information"
          titleId="experience-validation-title"
        />
      ) : null}

      <RepeatableSectionHeader
        actionLabel="Add Employer"
        onAdd={addExperience}
        title="Work Experience"
      />

      {experiences.filter((experience) => experience.isSaved).length > 1 ? (
        <div className="entry-sort-toolbar">
          <EntrySortControl
            alphaLabel="Job title"
            inputId="experience-sort"
            onChange={changeSortOrder}
            value={sortOrder}
          />
        </div>
      ) : null}

      {experiences.length === 0 ? (
        <RepeatableEmptyState title="No Work Experience Added" />
      ) : null}

      {sortedExperiences.map((experience) => {
        const prefix = `experience-${experience.id}`;
        const toolbarId = `${prefix}-toolbar`;
        const reasonToolbarId = `${prefix}-reason-toolbar`;
        const isSaved = experience.isSaved;
        const experienceTitle = experience.jobTitle.trim() || 'Untitled role';
        const companyLabel = experience.company.trim() || 'Company not set';
        const groupRoles = experiences
          .filter((entry) => entry.employmentGroupId === experience.employmentGroupId)
          .sort((left, right) => (
            (parseEmploymentDateValue(left.startDate, left.startDatePrecision, true).time ?? 0)
            - (parseEmploymentDateValue(right.startDate, right.startDatePrecision, true).time ?? 0)
          ));
        const isGroupCard = groupRoles[0]?.id === experience.id;
        const latestRole = groupRoles.at(-1);
        const canAddRole = Boolean(latestRole?.endDate) && !latestRole?.isCurrentJob;

        if (isSaved && !experience.isEditing) {
          if (!isGroupCard) return null;
          return (
            <section className="field-card job-transition-card" key={experience.id} aria-labelledby={`${prefix}-summary-title`}>
              <div className="job-summary">
                <div className="job-summary-header">
                  <div className="job-summary-identity">
                    <h4 className="job-summary-title" id={`${prefix}-summary-title`}>{companyLabel}</h4>
                    <p className="job-summary-company">{groupRoles.length} {groupRoles.length === 1 ? 'role' : 'roles'}</p>
                  </div>
                  <div className="job-summary-actions">
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => expandExperience(latestRole?.id ?? experience.id)}
                      aria-label={`Edit ${companyLabel}`}
                      data-tooltip={`Edit ${companyLabel}`}
                    >
                      <Pencil aria-hidden="true" size={18} />
                    </button>
                    <button
                      className="icon-button icon-button-danger"
                      type="button"
                      onClick={() => removeEmployer(experience.employmentGroupId)}
                      aria-label={`Remove ${companyLabel} and all of its roles`}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                <div className="page-stack" aria-label={`Roles at ${companyLabel}`}>
                  {groupRoles.map((role) => (
                    <div className="toolbar-row" key={role.id}>
                      <button className="job-role-edit-button" onClick={() => expandExperience(role.id)} type="button">
                        <strong>{role.jobTitle || 'Untitled role'}</strong>
                        <p className="field-hint">{formatDateRange(role)}</p>
                      </button>
                      <div className="job-summary-actions">
                        {groupRoles.length > 1 ? (
                          <button className="icon-button icon-button-danger" onClick={() => removeExperience(role.id)} aria-label={`Remove ${role.jobTitle || 'role'} from ${companyLabel}`} type="button">
                            <Trash2 aria-hidden="true" size={18} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
                <dl className="summary-list">
                  <div><dt>Location</dt><dd>{formatLocation(experience)}</dd></div>
                  <div><dt>Supervisor</dt><dd>{experience.supervisorName || 'Not set'}</dd></div>
                </dl>
              </div>
            </section>
          );
        }

        return (
          <FormModal
            className="experience-modal-dialog"
            closeLabel={isSaved ? `Close edit ${experienceTitle}` : 'Close add job'}
            description="Save the complete role once so it can be reused in applications and targeted resumes."
            dirtyKey={JSON.stringify(experience)}
            initialFocusId={`${prefix}-job-title`}
            isOpen={!validationDialog}
            key={experience.id}
            onClose={() => closeExperienceForm(experience)}
            title={isSaved ? `Edit ${experienceTitle}` : groupRoles.length > 1 ? 'Add Role' : 'Add Employer'}
          >
            <form
              autoComplete="on"
              className="page-stack experience-modal-form"
              onSubmit={(event) => {
                event.preventDefault();
                saveExperience(experience.id);
              }}
            >
              <div>
                <h5 className="section-title">Job Details</h5>
                <hr className="subtle-divider" />
              </div>

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

            <div>
              <h5 className="section-title">Time Period</h5>
              <hr className="subtle-divider" />
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
                  <DatePicker
                    id={`${prefix}-start-date`}
                    ariaLabel="Start Date"
                    value={experience.startDate}
                    precision={experience.startDatePrecision}
                    onChange={(value) => updateExperience(experience.id, 'startDate', value)}
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
                  <DatePicker
                    id={`${prefix}-end-date`}
                    ariaLabel="End Date"
                    value={experience.endDate}
                    precision={experience.endDatePrecision}
                    onChange={(value) => updateExperience(experience.id, 'endDate', value)}
                    disabled={experience.isCurrentJob}
                    required={!experience.isCurrentJob}
                  />
                </div>
                <p className="field-hint">{getDateHint('End Date', experience.endDatePrecision)}</p>
              </div>
              <div className="form-group current-job-field" style={{ marginBottom: 0 }}>
                <span className="form-label" aria-hidden="true">Current Job</span>
                <Checkbox
                  checked={experience.isCurrentJob}
                  label="I currently work here"
                  onChange={(event) => updateCurrentJob(experience.id, event.target.checked)}
                />
              </div>
            </div>

            <div>
              <h5 className="section-title">Location & Contact</h5>
              <hr className="subtle-divider" />
            </div>

            <AddressFlow
              idPrefix={prefix}
              onChange={(field, value) => updateExperience(
                experience.id,
                field as keyof ExperienceEntry,
                value as ExperienceEntry[keyof ExperienceEntry]
              )}
              value={experience as AddressValue}
            />
            <div className="form-grid">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor={`${prefix}-company-phone`}>Company Phone</label>
                <input
                  id={`${prefix}-company-phone`}
                  type="tel"
                  className="form-input"
                  inputMode="tel"
                  maxLength={17}
                  pattern="\+\d \(\d{3}\) \d{3}-\d{4}"
                  value={companyPhoneDrafts[experience.id] ?? formatPhoneNumber(experience.companyPhone)}
                  onChange={(event) => {
                    const formatted = formatPhoneNumber(event.target.value);
                    setCompanyPhoneDrafts((current) => ({ ...current, [experience.id]: formatted }));
                    updateExperience(experience.id, 'companyPhone', normalizePhoneNumber(formatted));
                  }}
                  placeholder="+1 (555) 123-4567"
                />
                <p className="field-hint">Include the one-digit country code. Stored as + followed by 11 digits.</p>
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
                <Checkbox
                  checked={experience.mayContactSupervisor}
                  label="May prospective employer contact?"
                  onChange={(event) => updateExperience(experience.id, 'mayContactSupervisor', event.target.checked)}
                />
              </div>
            </div>

            <div>
              <h5 className="section-title">Narrative</h5>
              <hr className="subtle-divider" />
            </div>

            <RichTextEditor
              label="Experience Details"
              labelId={`${prefix}-details-label`}
              onChange={(value) => updateExperience(experience.id, 'description', value)}
              placeholder="Write your experience in a paragraph or as bullet points..."
              editorClassName="rich-text-editor-experience"
              toolbarId={toolbarId}
              value={experience.description}
            />

            <RichTextEditor
              disabled={experience.isCurrentJob}
              label="Reason for Leaving"
              labelId={`${prefix}-reason-label`}
              onChange={(value) => updateExperience(experience.id, 'reasonForLeaving', value)}
              placeholder={experience.isCurrentJob ? 'Disabled for current job' : 'Explain why this job ended, if an application asks for it...'}
              editorClassName="rich-text-editor-reason"
              toolbarId={reasonToolbarId}
              value={experience.reasonForLeaving}
            />

                <div className="toolbar-row experience-modal-actions">
              {experience.rewriteMessage ? (
                <p className="section-copy" role="status">
                  {experience.rewriteMessage}
                </p>
              ) : (
                <span />
              )}
              <div className="modal-form-actions">
                {isSaved && canAddRole ? (
                  <button className="btn btn-secondary" onClick={() => addRole(experience.employmentGroupId)} type="button">
                    <Plus aria-hidden="true" size={17} /> Add Role
                  </button>
                ) : null}
                <button className="btn btn-secondary" data-modal-close type="button" onClick={() => closeExperienceForm(experience)}>
                  Cancel
                </button>
                <button className="btn btn-primary" type="submit">
                  {groupRoles.length > 1 ? 'Save Role' : 'Save Employer'}
                </button>
              </div>
                </div>
            </form>
          </FormModal>
        );
      })}
    </div>
  );
}

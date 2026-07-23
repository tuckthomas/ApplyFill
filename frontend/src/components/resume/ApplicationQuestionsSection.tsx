import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import Select from '../ui/AppSelect';
import { Eye, EyeOff, Info, ShieldAlert } from 'lucide-react';
import { COUNTRY_OPTIONS, selectStyles } from '../../constants/location';
import type { LocationOption } from '../../constants/location';
import FormModal from '../ui/FormModal';
import RepeatableEmptyState from '../ui/RepeatableEmptyState';
import RepeatableEntryCard from '../ui/RepeatableEntryCard';
import RepeatableSectionHeader from '../ui/RepeatableSectionHeader';
import {
  maskGovernmentIdentifier
} from '../../features/profile/applicationQuestions';
import type {
  ApplicationAnswer,
  ApplicationQuestionsData,
  GovernmentIdentifier,
  WorkAuthorization
} from '../../features/profile/applicationQuestions';

export type { ApplicationQuestionsData } from '../../features/profile/applicationQuestions';

type QuestionOption = {
  value: string;
  label: string;
};

const RACE_ETHNICITY_OPTIONS: QuestionOption[] = [
  { value: 'American Indian or Alaska Native', label: 'American Indian or Alaska Native' },
  { value: 'Asian', label: 'Asian' },
  { value: 'Black or African American', label: 'Black or African American' },
  { value: 'Hispanic or Latino', label: 'Hispanic or Latino' },
  { value: 'Native Hawaiian or Other Pacific Islander', label: 'Native Hawaiian or Other Pacific Islander' },
  { value: 'White', label: 'White' },
  { value: 'Two or more races', label: 'Two or more races' },
  { value: 'Prefer not to answer', label: 'Prefer not to answer' }
];

const VETERAN_STATUS_OPTIONS: QuestionOption[] = [
  { value: 'I am a protected veteran', label: 'I am a protected veteran' },
  { value: 'I am not a protected veteran', label: 'I am not a protected veteran' },
  { value: 'I am a veteran, but do not fall under a protected category', label: 'I am a veteran, but do not fall under a protected category' },
  { value: 'Prefer not to answer', label: 'Prefer not to answer' }
];

const DISABILITY_STATUS_OPTIONS: QuestionOption[] = [
  { value: 'Yes, I have a disability or history of a disability', label: 'Yes, I have a disability or history of a disability' },
  { value: 'No, I do not have a disability', label: 'No, I do not have a disability' },
  { value: 'Prefer not to answer', label: 'Prefer not to answer' }
];

const YES_NO_UNSURE_OPTIONS: QuestionOption[] = [
  { value: 'Yes', label: 'Yes' },
  { value: 'No', label: 'No' },
  { value: 'Unsure', label: 'Unsure' }
];

const DISABILITY_EXAMPLES = [
  'Alcohol or other substance use disorder (not currently using illegal drugs)',
  'Autoimmune disorders such as lupus, fibromyalgia, rheumatoid arthritis, or HIV/AIDS',
  'Blindness or low vision',
  'Cancer, past or present',
  'Cardiovascular or heart disease',
  'Celiac disease',
  'Cerebral palsy',
  'Deafness or serious difficulty hearing',
  'Diabetes',
  'Disfigurement caused by burns, wounds, accidents, or congenital disorders',
  'Epilepsy or another seizure disorder',
  'Gastrointestinal disorders such as Crohn\'s disease or irritable bowel syndrome',
  'Intellectual or developmental disability',
  'Mental health conditions such as depression, bipolar disorder, anxiety disorder, schizophrenia, or PTSD',
  'Missing or partially missing limbs',
  'Mobility impairment requiring a wheelchair, scooter, walker, leg brace, or other support',
  'Nervous system conditions such as migraines, Parkinson\'s disease, or multiple sclerosis',
  'Neurodivergence such as ADHD, autism spectrum disorder, dyslexia, dyspraxia, or other learning disabilities',
  'Partial or complete paralysis',
  'Pulmonary or respiratory conditions such as asthma or emphysema',
  'Short stature',
  'Traumatic brain injury'
];

type ApplicationQuestionsSectionProps = {
  data: ApplicationQuestionsData;
  onChange: Dispatch<SetStateAction<ApplicationQuestionsData>>;
};

export default function ApplicationQuestionsSection({ data, onChange }: ApplicationQuestionsSectionProps) {
  const [governmentIdentifierDraft, setGovernmentIdentifierDraft] = useState<GovernmentIdentifier | null>(null);
  const [workAuthorizationDraft, setWorkAuthorizationDraft] = useState<WorkAuthorization | null>(null);
  const [isIdentifierVisible, setIsIdentifierVisible] = useState(false);

  const updateField = <Key extends keyof ApplicationQuestionsData>(
    key: Key,
    value: ApplicationQuestionsData[Key]
  ) => {
    onChange((current) => ({ ...current, [key]: value }));
  };

  const getSelectedOption = (options: QuestionOption[], value: string | null) => (
    options.find((option) => option.value === value) ?? null
  );

  const saveGovernmentIdentifier = () => {
    if (!governmentIdentifierDraft?.country || !governmentIdentifierDraft.identifierType.trim() || !governmentIdentifierDraft.value.trim()) return;
    const saved = {
      ...governmentIdentifierDraft,
      identifierType: governmentIdentifierDraft.identifierType.trim(),
      value: governmentIdentifierDraft.value.trim()
    };
    updateField('governmentIdentifiers', data.governmentIdentifiers.some((entry) => entry.id === saved.id)
      ? data.governmentIdentifiers.map((entry) => entry.id === saved.id ? saved : entry)
      : [...data.governmentIdentifiers, saved]);
    setGovernmentIdentifierDraft(null);
    setIsIdentifierVisible(false);
  };

  const saveWorkAuthorization = () => {
    if (!workAuthorizationDraft?.country) return;
    updateField('workAuthorizations', data.workAuthorizations.some((entry) => entry.id === workAuthorizationDraft.id)
      ? data.workAuthorizations.map((entry) => entry.id === workAuthorizationDraft.id ? workAuthorizationDraft : entry)
      : [...data.workAuthorizations, workAuthorizationDraft]);
    setWorkAuthorizationDraft(null);
  };

  return (
    <div className="page-stack">
      <div>
        <h3 className="section-title">Application Questions</h3>
        <p className="section-copy">
          Save optional answers commonly requested by job applications.
        </p>
      </div>

      <aside className="application-questions-notice" aria-label="How application questions are used">
        <Info size={20} aria-hidden="true" />
        <p>
          These questions are optional and are never included in generated resumes. ApplyFill protects them separately in its database on this computer for application workflows you choose to use. It does not collect your date of birth, citizenship, or specific immigration status.
        </p>
      </aside>

      <FormModal
        className="repeatable-entry-modal"
        closeLabel="Close government identifier form"
        description="Add an identifier only if you expect a legitimate application or onboarding process to require it."
        dirtyKey={governmentIdentifierDraft ? JSON.stringify(governmentIdentifierDraft) : undefined}
        initialFocusId="government-identifier-country"
        isOpen={Boolean(governmentIdentifierDraft)}
        onClose={() => { setGovernmentIdentifierDraft(null); setIsIdentifierVisible(false); }}
        title={data.governmentIdentifiers.some((entry) => entry.id === governmentIdentifierDraft?.id) ? 'Edit government identifier' : 'Add government identifier'}
      >
        {governmentIdentifierDraft ? (
          <form className="page-stack repeatable-entry-modal-form" onSubmit={(event) => { event.preventDefault(); saveGovernmentIdentifier(); }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="government-identifier-country">Issuing Country *</label>
              <Select
                inputId="government-identifier-country"
                options={COUNTRY_OPTIONS}
                placeholder="Select issuing country"
                styles={selectStyles}
                value={governmentIdentifierDraft.country}
                onChange={(option) => setGovernmentIdentifierDraft((current) => current ? { ...current, country: option as LocationOption } : current)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="government-identifier-type">Identifier Type *</label>
              <input
                autoComplete="off"
                className="form-input"
                id="government-identifier-type"
                maxLength={80}
                onChange={(event) => setGovernmentIdentifierDraft((current) => current ? { ...current, identifierType: event.target.value } : current)}
                placeholder="e.g. Social Security number, SIN, NIN"
                required
                type="text"
                value={governmentIdentifierDraft.identifierType}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="government-identifier-value">Identifier *</label>
              <div className="sensitive-input-wrap">
                <input
                  autoComplete="off"
                  className="form-input"
                  id="government-identifier-value"
                  maxLength={128}
                  onChange={(event) => setGovernmentIdentifierDraft((current) => current ? { ...current, value: event.target.value } : current)}
                  placeholder="Enter the identifier"
                  required
                  spellCheck={false}
                  type={isIdentifierVisible ? 'text' : 'password'}
                  value={governmentIdentifierDraft.value}
                />
                <button
                  aria-label={isIdentifierVisible ? 'Hide identifier' : 'Show identifier'}
                  aria-pressed={isIdentifierVisible}
                  className="icon-button sensitive-input-toggle"
                  onClick={() => setIsIdentifierVisible((visible) => !visible)}
                  type="button"
                >
                  {isIdentifierVisible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
            </div>
            <p className="field-hint sensitive-field-warning"><ShieldAlert size={17} aria-hidden="true" /> Stored as plain data in this browser. Anyone with access to this browser profile, an exported backup, or your clipboard may be able to read it.</p>
            <div className="modal-form-actions">
              <button className="btn btn-secondary" data-modal-close type="button">Cancel</button>
              <button className="btn btn-primary" type="submit">Save Identifier</button>
            </div>
          </form>
        ) : null}
      </FormModal>

      <FormModal
        className="repeatable-entry-modal"
        closeLabel="Close work authorization form"
        description="Save the two questions employers commonly ask without recording citizenship or a specific immigration status."
        dirtyKey={workAuthorizationDraft ? JSON.stringify(workAuthorizationDraft) : undefined}
        initialFocusId="work-authorization-country"
        isOpen={Boolean(workAuthorizationDraft)}
        onClose={() => setWorkAuthorizationDraft(null)}
        title={data.workAuthorizations.some((entry) => entry.id === workAuthorizationDraft?.id) ? 'Edit work authorization' : 'Add work authorization'}
      >
        {workAuthorizationDraft ? (
          <form className="page-stack repeatable-entry-modal-form" onSubmit={(event) => { event.preventDefault(); saveWorkAuthorization(); }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="work-authorization-country">Country *</label>
              <Select
                inputId="work-authorization-country"
                options={COUNTRY_OPTIONS}
                placeholder="Select country"
                styles={selectStyles}
                value={workAuthorizationDraft.country}
                onChange={(option) => setWorkAuthorizationDraft((current) => current ? { ...current, country: option as LocationOption } : current)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="authorized-to-work">Are you currently authorized to work in this country? (Optional)</label>
              <Select
                inputId="authorized-to-work"
                isClearable
                options={YES_NO_UNSURE_OPTIONS}
                placeholder="Select an answer"
                styles={selectStyles}
                value={getSelectedOption(YES_NO_UNSURE_OPTIONS, workAuthorizationDraft.authorizedToWork)}
                onChange={(option) => setWorkAuthorizationDraft((current) => current ? { ...current, authorizedToWork: ((option as QuestionOption | null)?.value as ApplicationAnswer | undefined) ?? null } : current)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="requires-sponsorship">Will you now or in the future require employer sponsorship to work in this country? (Optional)</label>
              <Select
                inputId="requires-sponsorship"
                isClearable
                options={YES_NO_UNSURE_OPTIONS}
                placeholder="Select an answer"
                styles={selectStyles}
                value={getSelectedOption(YES_NO_UNSURE_OPTIONS, workAuthorizationDraft.requiresSponsorship)}
                onChange={(option) => setWorkAuthorizationDraft((current) => current ? { ...current, requiresSponsorship: ((option as QuestionOption | null)?.value as ApplicationAnswer | undefined) ?? null } : current)}
              />
            </div>
            <div className="modal-form-actions">
              <button className="btn btn-secondary" data-modal-close type="button">Cancel</button>
              <button className="btn btn-primary" type="submit">Save Authorization</button>
            </div>
          </form>
        ) : null}
      </FormModal>

      <section className="page-stack application-question-section" aria-label="Work authorization">
        <RepeatableSectionHeader
          actionLabel="Add Authorization"
          description="Record authorization and present-or-future sponsorship answers separately for each country where you apply."
          headingLevel={4}
          onAdd={() => setWorkAuthorizationDraft({ id: Date.now(), country: data.workAuthorizations[0]?.country ?? data.governmentIdentifiers[0]?.country ?? COUNTRY_OPTIONS.find((country) => country.value === 'United States')!, authorizedToWork: null, requiresSponsorship: null })}
          title="Work Authorization"
        />
        {data.workAuthorizations.length ? data.workAuthorizations.map((entry) => (
          <RepeatableEntryCard
            editLabel={`Edit work authorization for ${entry.country.label}`}
            key={entry.id}
            onEdit={() => setWorkAuthorizationDraft({ ...entry })}
            onRemove={() => updateField('workAuthorizations', data.workAuthorizations.filter((item) => item.id !== entry.id))}
            removeLabel={`Delete work authorization for ${entry.country.label}`}
            subtitle={`Authorized: ${entry.authorizedToWork ?? 'Not answered'} · Sponsorship: ${entry.requiresSponsorship ?? 'Not answered'}`}
            title={entry.country.label}
          />
        )) : <RepeatableEmptyState title="No work authorization answers saved." />}
      </section>

      <section className="page-stack application-question-section" aria-label="Government identifiers">
        <RepeatableSectionHeader
          actionLabel="Add Identifier"
          description="Optional application or onboarding identifiers such as a U.S. SSN, Canadian SIN, U.K. NIN, or another country-specific equivalent."
          headingLevel={4}
          onAdd={() => { setGovernmentIdentifierDraft({ id: Date.now(), country: data.governmentIdentifiers[0]?.country ?? data.workAuthorizations[0]?.country ?? COUNTRY_OPTIONS.find((country) => country.value === 'United States')!, identifierType: '', value: '' }); setIsIdentifierVisible(false); }}
          title="Government Identifiers"
        />
        <p className="field-hint sensitive-field-warning"><ShieldAlert size={17} aria-hidden="true" /> Most applications should not need this information. Verify who is requesting it and why before using it.</p>
        {data.governmentIdentifiers.length ? data.governmentIdentifiers.map((entry) => (
          <RepeatableEntryCard
            editLabel={`Edit ${entry.identifierType}`}
            key={entry.id}
            onEdit={() => { setGovernmentIdentifierDraft({ ...entry }); setIsIdentifierVisible(false); }}
            onRemove={() => updateField('governmentIdentifiers', data.governmentIdentifiers.filter((item) => item.id !== entry.id))}
            removeLabel={`Delete ${entry.identifierType}`}
            subtitle={`${entry.country.label} · ${maskGovernmentIdentifier(entry.value)}`}
            title={entry.identifierType}
          />
        )) : <RepeatableEmptyState title="No government identifiers saved." />}
      </section>

      <div className="application-questions-grid">
        <div className="form-group">
          <label className="form-label" htmlFor="application-race-ethnicity">Race or ethnicity (Optional)</label>
          <Select
            inputId="application-race-ethnicity"
            options={RACE_ETHNICITY_OPTIONS}
            styles={selectStyles}
            placeholder="Select an answer"
            value={getSelectedOption(RACE_ETHNICITY_OPTIONS, data.raceEthnicity)}
            onChange={(option) => updateField('raceEthnicity', (option as QuestionOption | null)?.value ?? null)}
            isClearable
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="application-veteran-status">Veteran status (Optional)</label>
          <Select
            inputId="application-veteran-status"
            options={VETERAN_STATUS_OPTIONS}
            styles={selectStyles}
            placeholder="Select an answer"
            value={getSelectedOption(VETERAN_STATUS_OPTIONS, data.veteranStatus)}
            onChange={(option) => updateField('veteranStatus', (option as QuestionOption | null)?.value ?? null)}
            isClearable
          />
        </div>

        <div className="form-group application-question-full-width">
          <label className="form-label" htmlFor="application-disability-status">Disability status (Optional)</label>
          <Select
            inputId="application-disability-status"
            options={DISABILITY_STATUS_OPTIONS}
            styles={selectStyles}
            placeholder="Select an answer"
            value={getSelectedOption(DISABILITY_STATUS_OPTIONS, data.disabilityStatus)}
            onChange={(option) => updateField('disabilityStatus', (option as QuestionOption | null)?.value ?? null)}
            isClearable
          />
          <div className="disability-examples" aria-labelledby="disability-examples-title">
            <h4 id="disability-examples-title">Examples included on standardized self-identification forms</h4>
            <p className="field-hint">
              This list is guidance only. You do not need to identify a specific condition to save a status answer.
            </p>
            <ul>
              {DISABILITY_EXAMPLES.map((example) => <li key={example}>{example}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

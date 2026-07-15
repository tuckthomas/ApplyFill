import type { Dispatch, SetStateAction } from 'react';
import Select from '../ui/AppSelect';
import { Info } from 'lucide-react';
import { selectStyles } from '../../constants/location';

export type ApplicationQuestionsData = {
  raceEthnicity: string | null;
  veteranStatus: string | null;
  disabilityStatus: string | null;
};

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
  const updateField = <Key extends keyof ApplicationQuestionsData>(
    key: Key,
    value: ApplicationQuestionsData[Key]
  ) => {
    onChange((current) => ({ ...current, [key]: value }));
  };

  const getSelectedOption = (options: QuestionOption[], value: string | null) => (
    options.find((option) => option.value === value) ?? null
  );

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
          These questions are optional. Your answers are never included in generated resumes. They are stored here only so ApplyFill can provide them to an agent-assisted job application workflow when you choose to use one.
        </p>
      </aside>

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

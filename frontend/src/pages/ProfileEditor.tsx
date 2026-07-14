import { useEffect, useState } from 'react';
import type { SetStateAction } from 'react';
import ProfileSection from '../components/resume/ProfileSection';
import type { ProfileSectionData } from '../components/resume/ProfileSection';
import SummarySection from '../components/resume/SummarySection';
import ExperienceSection from '../components/resume/ExperienceSection';
import type { ExperienceEntry } from '../components/resume/ExperienceSection';
import EducationSection from '../components/resume/EducationSection';
import type { EducationEntry } from '../components/resume/EducationSection';
import SkillsSection from '../components/resume/SkillsSection';
import type { SkillEntry } from '../components/resume/SkillsSection';
import { COUNTRY_OPTIONS } from '../constants/location';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';

const STEPS = [
  { id: 'profile', label: 'Personal Info' },
  { id: 'education', label: 'Education' },
  { id: 'summary', label: 'Professional Summary' },
  { id: 'experience', label: 'Work Experience' },
  { id: 'skills', label: 'Skills' }
];

const PROFILE_BUILDER_STORAGE_KEY = 'applyfill.profile-builder.v1';

type ProfileBuilderData = {
  profile: ProfileSectionData;
  education: EducationEntry[];
  summary: string;
  experience: ExperienceEntry[];
  skills: SkillEntry[];
};

type ProfileBuilderState = {
  activeStep: number;
  data: ProfileBuilderData;
};

const DEFAULT_PROFILE_SECTION_DATA: ProfileSectionData = {
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  phone: '',
  alternativeNames: [],
  address1: '',
  address2: '',
  city: '',
  state: null,
  postalCode: '',
  country: COUNTRY_OPTIONS.find((option) => option.value === 'United States') ?? null,
  webLinks: [{ id: 1, name: '', url: '' }]
};

const DEFAULT_PROFILE_BUILDER_DATA: ProfileBuilderData = {
  profile: DEFAULT_PROFILE_SECTION_DATA,
  education: [],
  summary: '',
  experience: [],
  skills: []
};

const DEFAULT_PROFILE_BUILDER_STATE: ProfileBuilderState = {
  activeStep: 0,
  data: DEFAULT_PROFILE_BUILDER_DATA
};

const resolveSetStateAction = <Value,>(
  action: SetStateAction<Value>,
  current: Value
): Value => (typeof action === 'function' ? (action as (value: Value) => Value)(current) : action);

const normalizeProfileBuilderData = (data: Partial<ProfileBuilderData> | undefined): ProfileBuilderData => ({
  profile: {
    ...DEFAULT_PROFILE_SECTION_DATA,
    ...(data?.profile ?? {}),
    alternativeNames: data?.profile?.alternativeNames ?? DEFAULT_PROFILE_SECTION_DATA.alternativeNames,
    webLinks: data?.profile?.webLinks ?? DEFAULT_PROFILE_SECTION_DATA.webLinks
  },
  education: data?.education ?? [],
  summary: data?.summary ?? '',
  experience: data?.experience ?? [],
  skills: data?.skills ?? []
});

const loadProfileBuilderState = (): ProfileBuilderState => {
  if (typeof window === 'undefined') {
    return DEFAULT_PROFILE_BUILDER_STATE;
  }

  try {
    const storedValue = window.localStorage.getItem(PROFILE_BUILDER_STORAGE_KEY);
    if (!storedValue) {
      return DEFAULT_PROFILE_BUILDER_STATE;
    }

    const parsed = JSON.parse(storedValue) as Partial<ProfileBuilderState>;
    const activeStep = Number.isInteger(parsed.activeStep)
      ? Math.min(Math.max(parsed.activeStep ?? 0, 0), STEPS.length - 1)
      : 0;

    return {
      activeStep,
      data: normalizeProfileBuilderData(parsed.data)
    };
  } catch {
    return DEFAULT_PROFILE_BUILDER_STATE;
  }
};

export default function ProfileEditor() {
  const [profileBuilderState, setProfileBuilderState] = useState<ProfileBuilderState>(loadProfileBuilderState);
  const navigate = useNavigate();
  const { activeStep, data } = profileBuilderState;

  useEffect(() => {
    window.localStorage.setItem(PROFILE_BUILDER_STORAGE_KEY, JSON.stringify(profileBuilderState));
  }, [profileBuilderState]);

  const setActiveStep = (step: number) => {
    setProfileBuilderState((current) => ({
      ...current,
      activeStep: Math.min(Math.max(step, 0), STEPS.length - 1)
    }));
  };

  const updateProfile = (action: SetStateAction<ProfileSectionData>) => {
    setProfileBuilderState((current) => ({
      ...current,
      data: {
        ...current.data,
        profile: resolveSetStateAction(action, current.data.profile)
      }
    }));
  };

  const updateEducation = (action: SetStateAction<EducationEntry[]>) => {
    setProfileBuilderState((current) => ({
      ...current,
      data: {
        ...current.data,
        education: resolveSetStateAction(action, current.data.education)
      }
    }));
  };

  const updateSummary = (summary: string) => {
    setProfileBuilderState((current) => ({
      ...current,
      data: {
        ...current.data,
        summary
      }
    }));
  };

  const updateExperience = (action: SetStateAction<ExperienceEntry[]>) => {
    setProfileBuilderState((current) => ({
      ...current,
      data: {
        ...current.data,
        experience: resolveSetStateAction(action, current.data.experience)
      }
    }));
  };

  const updateSkills = (action: SetStateAction<SkillEntry[]>) => {
    setProfileBuilderState((current) => ({
      ...current,
      data: {
        ...current.data,
        skills: resolveSetStateAction(action, current.data.skills)
      }
    }));
  };

  const handleNext = () => {
    if (activeStep < STEPS.length - 1) setActiveStep(activeStep + 1);
  };

  const handleBack = () => {
    if (activeStep > 0) setActiveStep(activeStep - 1);
  };

  const renderStep = () => {
    switch (activeStep) {
      case 0: return <ProfileSection data={data.profile} onChange={updateProfile} />;
      case 1: return <EducationSection educations={data.education} onChange={updateEducation} />;
      case 2: return <SummarySection summary={data.summary} onChange={updateSummary} />;
      case 3: return <ExperienceSection experiences={data.experience} onChange={updateExperience} />;
      case 4: return <SkillsSection skills={data.skills} onChange={updateSkills} />;
      default: return null;
    }
  };

  return (
    <div className="page-stack" style={{ maxWidth: '920px', margin: '0 auto', width: '100%' }}>
      <header className="page-header">
        <div>
          <h2 className="page-title">Profile Builder</h2>
          <p className="page-copy">Create the reusable source profile used to assemble targeted resumes.</p>
        </div>
      </header>

      <section className="surface-panel" style={{ padding: '32px' }} aria-label="Profile builder steps">
        <div className="page-stack">
          <nav className="wizard-progress-meter" aria-label="Profile builder progress">
            {STEPS.map((step, index) => {
              const isComplete = index < activeStep;
              const isCurrent = index === activeStep;
              const segmentState = isCurrent ? 'current' : isComplete ? 'complete' : 'upcoming';

              return (
                <button
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={`Step ${index + 1} of ${STEPS.length}: ${step.label}`}
                  className={`wizard-progress-step wizard-progress-step-${segmentState}`}
                key={step.id}
                onClick={() => setActiveStep(index)}
                  type="button"
                >
                  <span className="wizard-progress-track" aria-hidden="true" />
                  <span className="wizard-progress-label">{step.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="animate-fade-in" style={{ minHeight: '300px' }}>
            {renderStep()}
          </div>

          <div className="toolbar-row wizard-navigation">
            <button
              className="btn btn-secondary"
              onClick={handleBack}
              disabled={activeStep === 0}
              type="button"
            >
              <ArrowLeft size={18} />
              Previous
            </button>
            <button
              className="btn btn-primary"
              onClick={activeStep === STEPS.length - 1 ? () => navigate('/') : handleNext}
              type="button"
            >
              {activeStep === STEPS.length - 1 ? 'Finish' : 'Next Step'}
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

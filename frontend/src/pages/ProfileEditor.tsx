import { useEffect, useRef, useState } from 'react';
import type { SetStateAction } from 'react';
import ProfileSection from '../components/resume/ProfileSection';
import type { ProfileSectionData } from '../components/resume/ProfileSection';
import ExperienceSection from '../components/resume/ExperienceSection';
import type { ExperienceEntry } from '../components/resume/ExperienceSection';
import ProjectsSection from '../components/resume/ProjectsSection';
import type { ProjectEntry } from '../components/resume/ProjectsSection';
import EducationSection from '../components/resume/EducationSection';
import type { EducationEntry } from '../components/resume/EducationSection';
import SkillsSection from '../components/resume/SkillsSection';
import type { SkillEntry } from '../components/resume/SkillsSection';
import ApplicationQuestionsSection from '../components/resume/ApplicationQuestionsSection';
import type { ApplicationQuestionsData } from '../components/resume/ApplicationQuestionsSection';
import ProfileIntroductionSection from '../components/resume/ProfileIntroductionSection';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { loadProfileBuilderState, PROFILE_BUILDER_STEPS, PROFILE_BUILDER_STORAGE_KEY } from '../features/profile/profileBuilder';
import type { ProfileBuilderState } from '../features/profile/profileBuilder';
import {
  EMPTY_PROFILE_AUTOMATION_CONSENT,
  hasCurrentProfileAutomationConsent,
  PROFILE_AUTOMATION_CONSENT_VERSION
} from '../features/profile/profileConsent';
import type { ProfileAutomationConsent } from '../features/profile/profileConsent';

const resolveSetStateAction = <Value,>(
  action: SetStateAction<Value>,
  current: Value
): Value => (typeof action === 'function' ? (action as (value: Value) => Value)(current) : action);

export default function ProfileEditor() {
  const [profileBuilderState, setProfileBuilderState] = useState<ProfileBuilderState>(loadProfileBuilderState);
  const [hasAcknowledgedConsent, setHasAcknowledgedConsent] = useState(false);
  const [isConsentStatusLoaded, setIsConsentStatusLoaded] = useState(false);
  const [isSavingConsent, setIsSavingConsent] = useState(false);
  const [consentError, setConsentError] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeStep, data } = profileBuilderState;
  const hasCurrentConsent = isConsentStatusLoaded
    && hasCurrentProfileAutomationConsent(data.automationConsent);
  const hasCurrentConsentRef = useRef(hasCurrentConsent);
  hasCurrentConsentRef.current = hasCurrentConsent;
  const requestedStep = PROFILE_BUILDER_STEPS.findIndex((step) => step.id === searchParams.get('section'));

  useEffect(() => {
    window.localStorage.setItem(PROFILE_BUILDER_STORAGE_KEY, JSON.stringify(profileBuilderState));
  }, [profileBuilderState]);

  useEffect(() => {
    if (requestedStep < 0 || !isConsentStatusLoaded) return;

    if (requestedStep > 0 && !hasCurrentConsentRef.current) {
      setConsentError('Read and accept the disclosure before continuing to the profile fields.');
      setProfileBuilderState((current) => ({ ...current, activeStep: 0 }));
      return;
    }

    setProfileBuilderState((current) => ({ ...current, activeStep: requestedStep }));
  }, [isConsentStatusLoaded, requestedStep]);

  useEffect(() => {
    const controller = new AbortController();

    const verifyConsent = async () => {
      try {
        const response = await fetch('http://localhost:5033/api/profile-consents/current', {
          signal: controller.signal
        });

        if (response.ok) {
          const consent = await response.json() as ProfileAutomationConsent;
          setProfileBuilderState((current) => ({
            ...current,
            data: { ...current.data, automationConsent: consent }
          }));
        } else {
          setProfileBuilderState((current) => ({
            ...current,
            activeStep: 0,
            data: { ...current.data, automationConsent: EMPTY_PROFILE_AUTOMATION_CONSENT }
          }));
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setConsentError('The consent service is unavailable. Profile fields remain locked until verification succeeds.');
        setProfileBuilderState((current) => ({
          ...current,
          activeStep: 0,
          data: { ...current.data, automationConsent: EMPTY_PROFILE_AUTOMATION_CONSENT }
        }));
      } finally {
        if (!controller.signal.aborted) setIsConsentStatusLoaded(true);
      }
    };

    void verifyConsent();
    return () => controller.abort();
  }, []);

  const setActiveStep = (step: number) => {
    if (step > 0 && !hasCurrentConsent) {
      setConsentError('Read and accept the disclosure before continuing to the profile fields.');
      step = 0;
    }

    setProfileBuilderState((current) => ({
      ...current,
      activeStep: Math.min(Math.max(step, 0), PROFILE_BUILDER_STEPS.length - 1)
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

  const updateExperience = (action: SetStateAction<ExperienceEntry[]>) => {
    setProfileBuilderState((current) => ({
      ...current,
      data: {
        ...current.data,
        experience: resolveSetStateAction(action, current.data.experience)
      }
    }));
  };

  const updateProjects = (action: SetStateAction<ProjectEntry[]>) => {
    setProfileBuilderState((current) => ({
      ...current,
      data: {
        ...current.data,
        projects: resolveSetStateAction(action, current.data.projects)
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

  const updateApplicationQuestions = (action: SetStateAction<ApplicationQuestionsData>) => {
    setProfileBuilderState((current) => ({
      ...current,
      data: {
        ...current.data,
        applicationQuestions: resolveSetStateAction(action, current.data.applicationQuestions)
      }
    }));
  };

  const handleNext = () => {
    if (activeStep < PROFILE_BUILDER_STEPS.length - 1) setActiveStep(activeStep + 1);
  };

  const recordConsent = async () => {
    if (!hasAcknowledgedConsent || isSavingConsent) return;

    setConsentError('');
    setIsSavingConsent(true);

    try {
      const response = await fetch('http://localhost:5033/api/profile-consents', {
        body: JSON.stringify({ accepted: true, disclosureVersion: PROFILE_AUTOMATION_CONSENT_VERSION }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST'
      });

      if (!response.ok) throw new Error(await response.text());

      const consent = await response.json() as ProfileAutomationConsent;
      setProfileBuilderState((current) => ({
        ...current,
        activeStep: 1,
        data: { ...current.data, automationConsent: consent }
      }));
      setIsConsentStatusLoaded(true);
      setHasAcknowledgedConsent(false);
    } catch {
      setConsentError('Consent could not be securely recorded. Check the local API connection and try again.');
    } finally {
      setIsSavingConsent(false);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) setActiveStep(activeStep - 1);
  };

  const finishProfile = () => {
    const completedState = { ...profileBuilderState, isComplete: true };
    window.localStorage.setItem(PROFILE_BUILDER_STORAGE_KEY, JSON.stringify(completedState));
    setProfileBuilderState(completedState);
    navigate('/job-profile');
  };

  const renderStep = () => {
    switch (activeStep) {
      case 0: return (
        <ProfileIntroductionSection
          consentedAtUtc={data.automationConsent.consentedAtUtc}
          consentError={consentError}
          hasAcknowledged={hasAcknowledgedConsent}
          hasCurrentConsent={hasCurrentConsent}
          onAcknowledgedChange={(acknowledged) => {
            setHasAcknowledgedConsent(acknowledged);
            if (acknowledged) setConsentError('');
          }}
        />
      );
      case 1: return <ProfileSection data={data.profile} onChange={updateProfile} />;
      case 2: return <EducationSection defaultCountry={data.profile.country} educations={data.education} onChange={updateEducation} />;
      case 3: return <ExperienceSection defaultCountry={data.profile.country} experiences={data.experience} onChange={updateExperience} />;
      case 4: return <ProjectsSection projects={data.projects} onChange={updateProjects} />;
      case 5: return <SkillsSection skills={data.skills} onChange={updateSkills} />;
      case 6: return <ApplicationQuestionsSection data={data.applicationQuestions} onChange={updateApplicationQuestions} />;
      default: return null;
    }
  };

  return (
    <div className="page-stack" style={{ maxWidth: '920px', margin: '0 auto', width: '100%' }}>
      <header className="page-header">
        <div>
          <h2 className="page-title">Job Profile Builder</h2>
          <p className="page-copy">Create the reusable source profile used to assemble targeted resumes.</p>
        </div>
      </header>

      <section className="surface-panel" style={{ padding: '32px' }} aria-label="Job profile builder steps">
        <div className="page-stack">
          <nav
            className="wizard-progress-meter"
            aria-label="Job profile builder progress"
            style={{ gridTemplateColumns: `repeat(${PROFILE_BUILDER_STEPS.length}, minmax(0, 1fr))` }}
          >
            {PROFILE_BUILDER_STEPS.map((step, index) => {
              const isComplete = index < activeStep;
              const isCurrent = index === activeStep;
              const segmentState = isCurrent ? 'current' : isComplete ? 'complete' : 'upcoming';

              return (
                <button
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={`Step ${index + 1} of ${PROFILE_BUILDER_STEPS.length}: ${step.label}`}
                className={`wizard-progress-step wizard-progress-step-${segmentState}`}
                  key={step.id}
                  disabled={index > 0 && !hasCurrentConsent}
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
              disabled={!isConsentStatusLoaded
                || (activeStep === 0 && !hasCurrentConsent && (!hasAcknowledgedConsent || isSavingConsent))}
              onClick={activeStep === 0 && !hasCurrentConsent
                ? recordConsent
                : activeStep === PROFILE_BUILDER_STEPS.length - 1
                  ? finishProfile
                  : handleNext}
              type="button"
            >
              {!isConsentStatusLoaded
                ? 'Verifying Consent...'
                : isSavingConsent
                ? 'Recording Consent...'
                : activeStep === 0 && !hasCurrentConsent
                  ? 'Agree and Continue'
                  : activeStep === PROFILE_BUILDER_STEPS.length - 1
                    ? 'Finish'
                    : 'Next Step'}
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

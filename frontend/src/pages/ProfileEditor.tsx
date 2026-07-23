import { useCallback, useEffect, useRef, useState } from 'react';
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
import ProfileResumeImportSection from '../components/resume/ProfileResumeImportSection';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { createDefaultProfileBuilderState, PROFILE_BUILDER_STEPS } from '../features/profile/profileBuilder';
import type { ProfileBuilderState } from '../features/profile/profileBuilder';
import { loadProfileBuilderState, saveProfileBuilderState } from '../features/profile/profileBuilder';
import {
  hasCurrentProfileAutomationConsent,
  PROFILE_AUTOMATION_CONSENT_VERSION
} from '../features/profile/profileConsent';
import { mergeProfileImportProposal } from '../features/profile/resumeImport';
import type { ProfileImportProposal, ProfileImportSelection } from '../features/profile/resumeImport';

const resolveSetStateAction = <Value,>(
  action: SetStateAction<Value>,
  current: Value
): Value => (typeof action === 'function' ? (action as (value: Value) => Value)(current) : action);

export default function ProfileEditor() {
  const [profileBuilderState, setProfileBuilderState] = useState<ProfileBuilderState>(createDefaultProfileBuilderState);
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileReloadKey, setProfileReloadKey] = useState(0);
  const [isResumeImportBusy, setIsResumeImportBusy] = useState(false);
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
  const pendingResumeImportRef = useRef<{
    proposal: ProfileImportProposal;
    selection: ProfileImportSelection;
  } | null>(null);
  hasCurrentConsentRef.current = hasCurrentConsent;
  const requestedStep = PROFILE_BUILDER_STEPS.findIndex((step) => step.id === searchParams.get('section'));

  useEffect(() => {
    if (requestedStep < 0 || !isConsentStatusLoaded || !isProfileLoaded) return;

    if (requestedStep > 0 && !hasCurrentConsentRef.current) {
      setConsentError('Read and accept the disclosure before continuing to the profile fields.');
      setProfileBuilderState((current) => ({ ...current, activeStep: 0 }));
      return;
    }

    setProfileBuilderState((current) => ({ ...current, activeStep: requestedStep }));
  }, [isConsentStatusLoaded, isProfileLoaded, requestedStep]);

  useEffect(() => {
    let isCurrent = true;

    const loadProfile = async () => {
      setIsProfileLoaded(false);
      setIsConsentStatusLoaded(false);
      setProfileError('');
      try {
        const loaded = await loadProfileBuilderState();
        if (isCurrent) setProfileBuilderState((current) => ({ ...loaded, activeStep: current.activeStep }));
      } catch (error) {
        if (isCurrent) setProfileError(error instanceof Error
          ? error.message
          : 'Your profile could not be loaded from ApplyFill. Keep ApplyFill open, then try again.');
      } finally {
        if (isCurrent) {
          setIsProfileLoaded(true);
          setIsConsentStatusLoaded(true);
        }
      }
    };

    void loadProfile();
    return () => { isCurrent = false; };
  }, [profileReloadKey]);

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

  const saveCurrentProfile = async (markComplete = false) => {
    if (isSavingProfile) return false;
    setIsSavingProfile(true);
    setProfileError('');
    try {
      const pendingImport = activeStep === 1 ? pendingResumeImportRef.current : null;
      const nextState = {
        ...profileBuilderState,
        data: pendingImport
          ? mergeProfileImportProposal(
              profileBuilderState.data,
              pendingImport.proposal,
              pendingImport.selection,
            )
          : profileBuilderState.data,
        isComplete: markComplete || profileBuilderState.isComplete,
      };
      await saveProfileBuilderState(nextState);
      setProfileBuilderState(nextState);
      if (pendingImport) pendingResumeImportRef.current = null;
      return true;
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Your profile could not be saved by ApplyFill.');
      return false;
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleResumeImportSelection = useCallback((
    proposal: ProfileImportProposal | null,
    selection: ProfileImportSelection | null,
  ) => {
    pendingResumeImportRef.current = proposal && selection ? { proposal, selection } : null;
  }, []);

  const moveToStep = async (step: number) => {
    if (activeStep > 0 && step !== activeStep && !await saveCurrentProfile()) return;
    setActiveStep(step);
  };

  const handleNext = async () => {
    if (activeStep > 0 && !await saveCurrentProfile()) return;
    if (activeStep < PROFILE_BUILDER_STEPS.length - 1) setActiveStep(activeStep + 1);
  };

  const recordConsent = async () => {
    if (!hasAcknowledgedConsent || isSavingConsent) return;

    setConsentError('');
    setIsSavingConsent(true);

    try {
      const consent = {
        acceptedAtUtc: new Date().toISOString(),
        disclosureVersion: PROFILE_AUTOMATION_CONSENT_VERSION
      };
      const nextState: ProfileBuilderState = {
        ...profileBuilderState,
        activeStep: 1,
        data: { ...profileBuilderState.data, automationConsent: consent }
      };
      await saveProfileBuilderState(nextState);
      setProfileBuilderState(nextState);
      setIsConsentStatusLoaded(true);
      setHasAcknowledgedConsent(false);
    } catch {
      setConsentError('Your acknowledgment could not be saved by ApplyFill. Check that the local service is running and try again.');
    } finally {
      setIsSavingConsent(false);
    }
  };

  const handleBack = async () => {
    if (activeStep > 0 && await saveCurrentProfile()) setActiveStep(activeStep - 1);
  };

  const finishProfile = async () => {
    if (await saveCurrentProfile(true)) navigate('/job-profile');
  };

  const renderStep = () => {
    switch (activeStep) {
      case 0: return (
        <ProfileIntroductionSection
          acceptedAtUtc={data.automationConsent.acceptedAtUtc}
          consentError={consentError}
          hasAcknowledged={hasAcknowledgedConsent}
          hasCurrentConsent={hasCurrentConsent}
          onAcknowledgedChange={(acknowledged) => {
            setHasAcknowledgedConsent(acknowledged);
            if (acknowledged) setConsentError('');
          }}
        />
      );
      case 1: return (
        <ProfileResumeImportSection
          onBusyChange={setIsResumeImportBusy}
          onSelectionChange={handleResumeImportSelection}
        />
      );
      case 2: return <ProfileSection data={data.profile} onChange={updateProfile} />;
      case 3: return <EducationSection defaultCountry={data.profile.country} educations={data.education} onChange={updateEducation} />;
      case 4: return <ExperienceSection defaultCountry={data.profile.country} experiences={data.experience} onChange={updateExperience} />;
      case 5: return <ProjectsSection projects={data.projects} onChange={updateProjects} />;
      case 6: return <SkillsSection skills={data.skills} onChange={updateSkills} />;
      case 7: return <ApplicationQuestionsSection data={data.applicationQuestions} onChange={updateApplicationQuestions} />;
      default: return null;
    }
  };

  return (
    <div className="page-stack" style={{ maxWidth: '920px', margin: '0 auto', width: '100%' }}>
      <header className="page-header">
        <div>
          <h2 className="page-title">Job Profile Builder</h2>
              <p className="page-copy">Create a reusable source profile stored by ApplyFill on this computer.</p>
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
                  disabled={!isProfileLoaded || isSavingProfile || (activeStep === 1 && isResumeImportBusy)
                    || (index > 0 && !hasCurrentConsent)}
                  onClick={() => void moveToStep(index)}
                  type="button"
                >
                  <span className="wizard-progress-track" aria-hidden="true" />
                  <span className="wizard-progress-label">{step.label}</span>
                </button>
              );
            })}
          </nav>

          {profileError && (
            <div className="page-stack" role="alert">
              <p className="field-error">{profileError}</p>
              <button className="btn btn-secondary" onClick={() => setProfileReloadKey((value) => value + 1)} type="button">
                Try Again
              </button>
            </div>
          )}

          <div className="animate-fade-in" style={{ minHeight: '300px' }}>
            {isProfileLoaded ? renderStep() : <p className="section-copy" role="status">Loading your saved profile...</p>}
          </div>

          <div className="toolbar-row wizard-navigation">
            <button
              className="btn btn-secondary"
              onClick={() => void handleBack()}
              disabled={activeStep === 0 || !isProfileLoaded || isSavingProfile
                || (activeStep === 1 && isResumeImportBusy)}
              type="button"
            >
              <ArrowLeft size={18} />
              Previous
            </button>
            <button
              className="btn btn-primary"
              disabled={!isConsentStatusLoaded || !isProfileLoaded || isSavingProfile
                || (activeStep === 1 && isResumeImportBusy)
                || (activeStep === 0 && !hasCurrentConsent && (!hasAcknowledgedConsent || isSavingConsent))}
              onClick={activeStep === 0 && !hasCurrentConsent
                ? () => void recordConsent()
                : activeStep === PROFILE_BUILDER_STEPS.length - 1
                  ? () => void finishProfile()
                  : () => void handleNext()}
              type="button"
            >
              {!isProfileLoaded
                ? 'Loading Profile...'
                : isSavingProfile
                  ? 'Saving Profile...'
                : activeStep === 1 && isResumeImportBusy
                  ? 'Reading Resume...'
                : !isConsentStatusLoaded
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

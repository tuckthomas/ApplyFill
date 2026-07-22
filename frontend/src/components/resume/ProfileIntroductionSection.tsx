import Checkbox from '../ui/Checkbox';
import {
  PROFILE_AUTOMATION_CONSENT_ACKNOWLEDGMENT,
  PROFILE_AUTOMATION_DISCLOSURES
} from '../../features/profile/profileConsent';

type ProfileIntroductionSectionProps = {
  acceptedAtUtc: string | null;
  consentError: string;
  hasAcknowledged: boolean;
  hasCurrentConsent: boolean;
  onAcknowledgedChange: (acknowledged: boolean) => void;
};

export default function ProfileIntroductionSection({
  acceptedAtUtc,
  consentError,
  hasAcknowledged,
  hasCurrentConsent,
  onAcknowledgedChange
}: ProfileIntroductionSectionProps) {
  const acceptedAtLabel = acceptedAtUtc
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(acceptedAtUtc))
    : '';

  return (
    <div className="page-stack profile-introduction">
      <header className="profile-introduction-header">
        <div>
          <h3 className="section-title">Before You Begin</h3>
          <p className="section-copy">
            ApplyFill creates one reusable source profile for resumes, job applications, and future
            user-controlled application automation.
          </p>
        </div>
      </header>

      <section className="profile-introduction-section" aria-labelledby="profile-collection-purpose">
        <div>
          <h4 className="section-title" id="profile-collection-purpose">Why We Collect More Than a Resume</h4>
          <p className="section-copy">
            {PROFILE_AUTOMATION_DISCLOSURES.collectionPurpose}
          </p>
        </div>
      </section>

      <section className="profile-introduction-section" aria-labelledby="profile-fields-optional">
        <div>
          <h4 className="section-title" id="profile-fields-optional">Every Field Is Optional</h4>
          <p className="section-copy">
            {PROFILE_AUTOMATION_DISCLOSURES.optionalFields}
          </p>
        </div>
      </section>

      <section className="profile-introduction-section" aria-labelledby="profile-automation-benefit">
        <div>
          <h4 className="section-title" id="profile-automation-benefit">Complete More to Automate More</h4>
          <p className="section-copy">
            {PROFILE_AUTOMATION_DISCLOSURES.automationBenefit}
          </p>
        </div>
      </section>

      <section className="profile-introduction-section" aria-labelledby="profile-local-storage">
        <div>
          <h4 className="section-title" id="profile-local-storage">Stored on This Device</h4>
          <p className="section-copy">{PROFILE_AUTOMATION_DISCLOSURES.localStorage}</p>
        </div>
      </section>

      <section className="profile-introduction-section" aria-labelledby="profile-sensitive-identifiers">
        <div>
          <h4 className="section-title" id="profile-sensitive-identifiers">Government Identifiers Need Extra Care</h4>
          <p className="section-copy">{PROFILE_AUTOMATION_DISCLOSURES.sensitiveIdentifiers}</p>
        </div>
      </section>

      <section className="profile-introduction-section" aria-labelledby="profile-ai-boundary">
        <div>
          <h4 className="section-title" id="profile-ai-boundary">Optional AI Requests</h4>
          <p className="section-copy">{PROFILE_AUTOMATION_DISCLOSURES.aiBoundary}</p>
        </div>
      </section>

      <p className="profile-introduction-status">
        {PROFILE_AUTOMATION_DISCLOSURES.featureStatus}
      </p>

      {hasCurrentConsent ? (
        <div className="profile-consent-recorded" role="status">
          <span>Privacy acknowledgment saved locally {acceptedAtLabel ? `on ${acceptedAtLabel}` : ''}.</span>
        </div>
      ) : (
        <div className="profile-consent-capture">
          <Checkbox
            checked={hasAcknowledged}
            label={PROFILE_AUTOMATION_CONSENT_ACKNOWLEDGMENT}
            onChange={(event) => onAcknowledgedChange(event.target.checked)}
          />
          <p className="field-hint">
            This acknowledgment is stored only in your local profile when you press Agree and Continue.
          </p>
          {consentError ? <p className="form-error-message" role="alert">{consentError}</p> : null}
        </div>
      )}
    </div>
  );
}

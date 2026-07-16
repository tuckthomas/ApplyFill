import Checkbox from '../ui/Checkbox';
import {
  PROFILE_AUTOMATION_CONSENT_ACKNOWLEDGMENT,
  PROFILE_AUTOMATION_DISCLOSURES
} from '../../features/profile/profileConsent';

type ProfileIntroductionSectionProps = {
  consentedAtUtc: string | null;
  consentError: string;
  hasAcknowledged: boolean;
  hasCurrentConsent: boolean;
  onAcknowledgedChange: (acknowledged: boolean) => void;
};

export default function ProfileIntroductionSection({
  consentedAtUtc,
  consentError,
  hasAcknowledged,
  hasCurrentConsent,
  onAcknowledgedChange
}: ProfileIntroductionSectionProps) {
  const consentedAtLabel = consentedAtUtc
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(consentedAtUtc))
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

      <p className="profile-introduction-status">
        {PROFILE_AUTOMATION_DISCLOSURES.featureStatus}
      </p>

      <p className="profile-introduction-audit">
        {PROFILE_AUTOMATION_DISCLOSURES.consentAudit}
      </p>

      {hasCurrentConsent ? (
        <div className="profile-consent-recorded" role="status">
          <span>Consent recorded {consentedAtLabel ? `on ${consentedAtLabel}` : ''}.</span>
        </div>
      ) : (
        <div className="profile-consent-capture">
          <Checkbox
            checked={hasAcknowledged}
            label={PROFILE_AUTOMATION_CONSENT_ACKNOWLEDGMENT}
            onChange={(event) => onAcknowledgedChange(event.target.checked)}
          />
          <p className="field-hint">
            Consent is recorded only when you select this acknowledgment and press Agree and Continue.
          </p>
          {consentError ? <p className="form-error-message" role="alert">{consentError}</p> : null}
        </div>
      )}
    </div>
  );
}

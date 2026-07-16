export const PROFILE_AUTOMATION_CONSENT_VERSION = 'profile-automation-v1';

export const PROFILE_AUTOMATION_DISCLOSURES = {
  collectionPurpose: 'Job applications commonly request information that does not belong on a resume, including full addresses, alternative names, supervisor details, reasons for leaving, work dates, and voluntary demographic responses. Saving those details here prevents repeated entry when an application asks for them.',
  optionalFields: 'You may leave any field or entire section blank. A blank field will not appear on a generated resume and will not be used to autofill a job application. ApplyFill will not invent a missing answer.',
  automationBenefit: 'People who want agentic job-application assistance benefit most from completing the fields commonly required by employers. More complete source data allows automation to fill more of an average application while leaving unanswered fields for your review.',
  featureStatus: 'Agentic application-filling features are under development. The profile collected now provides the structured data those workflows will use.',
  consentAudit: 'When you consent, ApplyFill records your authenticated profile, the disclosure version and text, UTC date and time, capture method, IP address, browser details, and a cryptographic hash of the disclosure for audit purposes.'
} as const;

export const PROFILE_AUTOMATION_DISCLOSURE_TEXT = Object.values(PROFILE_AUTOMATION_DISCLOSURES).join('\n\n');

export const PROFILE_AUTOMATION_CONSENT_ACKNOWLEDGMENT =
  'I have read and understand the disclosures above. I agree that ApplyFill may store and use the profile information I choose to provide for resume generation and user-directed job-application autofill. I understand that every field is optional and that blank fields will not be populated or invented.';

export type ProfileAutomationConsent = {
  captureMethod: string;
  consentId: string | null;
  consentedAtUtc: string | null;
  disclosureSha256: string;
  disclosureText: string;
  disclosureVersion: string;
};

export const EMPTY_PROFILE_AUTOMATION_CONSENT: ProfileAutomationConsent = {
  captureMethod: '',
  consentId: null,
  consentedAtUtc: null,
  disclosureSha256: '',
  disclosureText: '',
  disclosureVersion: ''
};

export const hasCurrentProfileAutomationConsent = (consent: ProfileAutomationConsent) => (
  Boolean(consent.consentId && consent.consentedAtUtc && consent.disclosureSha256)
  && consent.disclosureVersion === PROFILE_AUTOMATION_CONSENT_VERSION
  && consent.disclosureText === PROFILE_AUTOMATION_DISCLOSURE_TEXT
);

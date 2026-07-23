export const PROFILE_AUTOMATION_CONSENT_VERSION = 'local-application-privacy-v5';

export const PROFILE_AUTOMATION_DISCLOSURES = {
  collectionPurpose: 'Job applications commonly request information that does not belong on a resume, including full addresses, alternative names, supervisor details, reasons for leaving, work dates, work authorization, sponsorship needs, government identifiers, and voluntary demographic responses. Saving those details here prevents repeated entry when a legitimate application asks for them. ApplyFill does not collect date of birth, citizenship, or specific immigration status.',
  optionalFields: 'You may leave any field or entire section blank. A blank field will not appear on a generated resume and will not be used to autofill a job application. ApplyFill will not invent a missing answer.',
  automationBenefit: 'People who want agentic job-application assistance benefit most from completing the fields commonly required by employers. More complete source data allows automation to fill more of an average application while leaving unanswered fields for your review.',
  localData: 'Your profile, resumes, job tracker, dashboard, and Browser Agent history are stored in ApplyFill\'s PostgreSQL database. Anyone with access to your signed-in computer may still be able to access local applications, so protect the device and keep backups.',
  sensitiveIdentifiers: 'Government identifiers such as a Social Security number are exceptionally sensitive and usually are not needed during an initial application. Add one only if you choose to, verify who is asking and why, and protect exported files and clipboard copies. Identifiers are never included in resumes or sent through optional AI writing actions.',
  aiBoundary: 'When you intentionally start a Private AI feature, ApplyFill creates a temporary, allowlisted professional snapshot and processes it with model services on this computer. Resume files stay local. Government identifiers, authorization and sponsorship answers, demographics, reasons for leaving, supervisors, addresses, and company phone numbers are excluded from writing and resume prompts. Private AI suggestions remain proposals until you review them.',
  featureStatus: 'The Browser Agent can navigate multiple application pages inside ApplyFill. You can pause, stop, or take control at any time, and final submission always requires your approval.'
} as const;

export const PROFILE_AUTOMATION_CONSENT_ACKNOWLEDGMENT =
  'I understand that my data is stored in ApplyFill\'s PostgreSQL database and may appear in files or clipboard copies I intentionally export. I understand that Private AI receives only the information required for the action and requires my review before profile or resume changes and before final application submission.';

export type ProfileAutomationConsent = {
  acceptedAtUtc: string | null;
  disclosureVersion: string;
};

export const EMPTY_PROFILE_AUTOMATION_CONSENT: ProfileAutomationConsent = {
  acceptedAtUtc: null,
  disclosureVersion: ''
};

export const hasCurrentProfileAutomationConsent = (consent: ProfileAutomationConsent) => (
  Boolean(consent.acceptedAtUtc)
  && consent.disclosureVersion === PROFILE_AUTOMATION_CONSENT_VERSION
);

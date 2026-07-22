export const PROFILE_AUTOMATION_CONSENT_VERSION = 'local-profile-privacy-v4';

export const PROFILE_AUTOMATION_DISCLOSURES = {
  collectionPurpose: 'Job applications commonly request information that does not belong on a resume, including full addresses, alternative names, supervisor details, reasons for leaving, work dates, work authorization, sponsorship needs, government identifiers, and voluntary demographic responses. Saving those details here prevents repeated entry when a legitimate application asks for them. ApplyFill does not collect date of birth, citizenship, or specific immigration status.',
  optionalFields: 'You may leave any field or entire section blank. A blank field will not appear on a generated resume and will not be used to autofill a job application. ApplyFill will not invent a missing answer.',
  automationBenefit: 'People who want agentic job-application assistance benefit most from completing the fields commonly required by employers. More complete source data allows automation to fill more of an average application while leaving unanswered fields for your review.',
  localStorage: 'Your profile, job tracker, and dashboard are stored only in this browser using local device storage. Local storage is not encrypted by ApplyFill: anyone with access to this device and browser profile may be able to read it. ApplyFill does not send this data to an ApplyFill account or database. Clearing this site\'s data or deleting this browser profile can permanently erase it, so download backups regularly.',
  sensitiveIdentifiers: 'Government identifiers such as a Social Security number are exceptionally sensitive and usually are not needed during an initial application. Add one only if you choose to, verify who is asking and why, and protect exported files and clipboard copies. Identifiers are never included in resumes or sent through optional AI writing actions.',
  aiBoundary: 'When you intentionally start a Local AI feature, ApplyFill creates a temporary, allowlisted professional snapshot and processes it with LiteRT inside this browser. For resume import, the selected PDF, DOCX, or text file is read only in the current tab and is not retained; deterministic code detects contact details and removes names, contact values, links, street-address-like lines, and identifier patterns before professional text reaches the model. Government identifiers, authorization and sponsorship answers, demographics, reasons for leaving, supervisors, addresses, and company phone numbers are excluded from all model input. Raw files, prompts, and rejected suggestions are not saved. Local inference does not encrypt your IndexedDB records or protect an unlocked browser profile.',
  featureStatus: 'Agentic application-filling features are under development. You remain in control of what is saved locally, exported, or submitted to an external service.'
} as const;

export const PROFILE_AUTOMATION_CONSENT_ACKNOWLEDGMENT =
  'I understand that my data is stored only in this browser and is not encrypted by ApplyFill, that ApplyFill cannot recover it if local site data is cleared, and that exported files and clipboard copies may contain sensitive identifiers. I understand that optional Local AI actions—including resume import after deterministic contact redaction—process temporary professional text on this device, do not retain the selected source file, and require my review before profile data changes.';

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

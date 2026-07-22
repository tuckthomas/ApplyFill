import type { LocalProfileDocument } from '../profile/profileBuilder';

export const AUTOFILL_PROTOCOL_VERSION = 'applyfill.autofill.v1' as const;
export const AUTOFILL_EXTENSION_ID_KEY = 'applyfill.autofill.extension-id';

export type AutofillSemantic =
  | 'first-name' | 'middle-name' | 'last-name' | 'full-name' | 'email' | 'phone'
  | 'address-line1' | 'address-line2' | 'city' | 'region' | 'postal-code' | 'country'
  | 'linkedin-url' | 'portfolio-url' | 'current-company' | 'current-title'
  | 'work-authorization' | 'visa-sponsorship' | 'government-identifier'
  | 'voluntary-demographic' | 'narrative-answer';

export type ScopedAutofillValue = {
  sourceKey: string;
  semantic: AutofillSemantic;
  displayLabel: string;
  value: string;
  userApprovedAt?: number;
};

type ChromeExternalResponse = { ok?: boolean; accepted?: boolean; error?: string };
export type AutofillFieldDescriptor = {
  id: string;
  control: 'input' | 'textarea' | 'select' | 'radio-group' | 'checkbox' | 'combobox' | 'unsupported';
  inputType?: string;
  label: string;
  nearbyLabel?: string;
  name?: string;
  autocomplete?: string;
  required: boolean;
  options: Array<{ value: string; label: string }>;
  unsupportedReason?: string;
  maxLength?: number;
};
export type AutofillMappingProposal = {
  fieldId: string;
  sourceKey: string;
  classification: 'model-suggested' | 'deterministic' | 'manual';
  confidence: number;
  reason: string;
  evidence?: string[];
};
type InspectionResponse = ChromeExternalResponse & {
  protocolVersion?: string;
  targetTabId?: number;
  expiresAt?: number;
  fields?: AutofillFieldDescriptor[];
};
type ChromeRuntime = {
  lastError?: { message?: string };
  sendMessage: (
    extensionId: string,
    message: unknown,
    callback: (response?: ChromeExternalResponse) => void,
  ) => void;
};

const chromeRuntime = (): ChromeRuntime | undefined => (
  (globalThis as typeof globalThis & { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime
);

export const isValidExtensionId = (value: string) => /^[a-p]{32}$/.test(value.trim());

export function parseConnectionCode(value: string): { targetTabId: number; nonce: string } {
  const match = value.trim().match(/^(\d+)\.([A-Za-z0-9_-]{24,128})$/);
  if (!match) throw new Error('Enter the one-time code shown by the ApplyFill extension.');
  const targetTabId = Number(match[1]);
  if (!Number.isSafeInteger(targetTabId)) throw new Error('The connection code contains an invalid tab.');
  return { targetTabId, nonce: match[2] };
}

const add = (
  values: ScopedAutofillValue[],
  sourceKey: string,
  semantic: AutofillSemantic,
  displayLabel: string,
  value: string | null | undefined,
) => {
  const normalized = value?.trim();
  if (normalized) values.push({ sourceKey, semantic, displayLabel, value: normalized });
};

export function createScopedAutofillValues(
  document: LocalProfileDocument,
  includeSensitive: boolean,
): ScopedAutofillValue[] {
  const values: ScopedAutofillValue[] = [];
  const { profile, experience, applicationQuestions } = document.data;
  const fullName = [profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(' ');
  add(values, 'profile.firstName', 'first-name', 'First name', profile.firstName);
  add(values, 'profile.middleName', 'middle-name', 'Middle name', profile.middleName);
  add(values, 'profile.lastName', 'last-name', 'Last name', profile.lastName);
  add(values, 'profile.fullName', 'full-name', 'Full name', fullName);
  add(values, 'profile.email', 'email', 'Email', profile.email);
  add(values, 'profile.phone', 'phone', 'Phone', profile.phone);
  add(values, 'profile.address1', 'address-line1', 'Street address', profile.address1);
  add(values, 'profile.address2', 'address-line2', 'Address line 2', profile.address2);
  add(values, 'profile.city', 'city', 'City', profile.city);
  add(values, 'profile.state', 'region', 'State or region', profile.state?.label);
  add(values, 'profile.postalCode', 'postal-code', 'Postal code', profile.postalCode);
  add(values, 'profile.country', 'country', 'Country', profile.country?.label);

  for (const [index, link] of profile.webLinks.entries()) {
    const label = `${link.name} ${link.url}`.toLowerCase();
    if (label.includes('linkedin')) add(values, `profile.webLinks.${index}`, 'linkedin-url', 'LinkedIn', link.url);
    else if (label.includes('portfolio') || label.includes('website')) add(values, `profile.webLinks.${index}`, 'portfolio-url', link.name || 'Portfolio', link.url);
  }

  const currentExperience = experience.find((entry) => entry.isCurrentJob)
    ?? [...experience].sort((left, right) => right.startDate.localeCompare(left.startDate))[0];
  add(values, 'experience.current.company', 'current-company', 'Current company', currentExperience?.company);
  add(values, 'experience.current.title', 'current-title', 'Current title', currentExperience?.jobTitle);

  if (includeSensitive) {
    const authorization = applicationQuestions.workAuthorizations[0];
    add(values, 'application.workAuthorization', 'work-authorization', 'Work authorization', authorization?.authorizedToWork);
    add(values, 'application.visaSponsorship', 'visa-sponsorship', 'Visa sponsorship', authorization?.requiresSponsorship);
    const identifier = applicationQuestions.governmentIdentifiers[0];
    add(values, 'application.governmentIdentifier', 'government-identifier', identifier?.identifierType || 'Government identifier', identifier?.value);
    add(values, 'application.raceEthnicity', 'voluntary-demographic', 'Race or ethnicity', applicationQuestions.raceEthnicity);
    add(values, 'application.veteranStatus', 'voluntary-demographic', 'Veteran status', applicationQuestions.veteranStatus);
    add(values, 'application.disabilityStatus', 'voluntary-demographic', 'Disability status', applicationQuestions.disabilityStatus);
  }
  return values;
}

function sendExternalMessage<T extends ChromeExternalResponse = ChromeExternalResponse>(extensionId: string, message: unknown): Promise<T> {
  const runtime = chromeRuntime();
  if (!runtime) throw new Error('A Chromium extension messaging API is not available in this browser.');
  return new Promise((resolve, reject) => {
    runtime.sendMessage(extensionId, message, (response) => {
      const runtimeError = runtime.lastError?.message;
      if (runtimeError) reject(new Error(runtimeError));
      else if (!response?.ok) reject(new Error(response?.error || 'The extension rejected the request.'));
      else resolve(response as T);
    });
  });
}

export async function connectAutofillExtension(options: {
  extensionId: string;
  connectionCode: string;
  values: ScopedAutofillValue[];
  proposals?: AutofillMappingProposal[];
}): Promise<void> {
  const extensionId = options.extensionId.trim();
  if (!isValidExtensionId(extensionId)) throw new Error('Enter the 32-character extension ID from the Chromium extension details page.');
  const { targetTabId, nonce } = parseConnectionCode(options.connectionCode);
  const approvedAt = Date.now();
  const sensitive = new Set<AutofillSemantic>([
    'work-authorization', 'visa-sponsorship', 'government-identifier', 'voluntary-demographic',
  ]);
  await sendExternalMessage(extensionId, {
    type: 'applyfill.handoff',
    protocolVersion: AUTOFILL_PROTOCOL_VERSION,
    targetTabId,
    nonce,
    expiresAt: Date.now() + 60_000,
    values: options.values.map((value) => sensitive.has(value.semantic)
      ? { ...value, userApprovedAt: approvedAt }
      : value),
    proposals: options.proposals ?? [],
  });
}

export async function inspectAutofillExtension(
  extensionIdValue: string,
  connectionCode: string,
): Promise<AutofillFieldDescriptor[]> {
  const extensionId = extensionIdValue.trim();
  if (!isValidExtensionId(extensionId)) throw new Error('Enter the 32-character extension ID from the Chromium extension details page.');
  const { targetTabId, nonce } = parseConnectionCode(connectionCode);
  const response = await sendExternalMessage<InspectionResponse>(extensionId, {
    type: 'applyfill.inspect',
    protocolVersion: AUTOFILL_PROTOCOL_VERSION,
    targetTabId,
    nonce,
  });
  if (response.protocolVersion !== AUTOFILL_PROTOCOL_VERSION || response.targetTabId !== targetTabId || !Array.isArray(response.fields)) {
    throw new Error('The extension returned an invalid inspection response.');
  }
  return response.fields;
}

export async function disconnectAutofillExtension(
  extensionId: string,
  connectionCode: string,
): Promise<void> {
  if (!isValidExtensionId(extensionId)) throw new Error('The saved extension ID is invalid.');
  const { targetTabId, nonce } = parseConnectionCode(connectionCode);
  await sendExternalMessage(extensionId.trim(), {
    type: 'applyfill.disconnect',
    protocolVersion: AUTOFILL_PROTOCOL_VERSION,
    targetTabId,
    nonce,
  });
}

export const PAIRING_PROTOCOL_VERSION = 'applyfill.autofill.pairing.v1' as const;
export const SESSION_TTL_MS = 5 * 60 * 1_000;
export const MAX_MESSAGE_BYTES = 64 * 1_024;
export const MAX_FIELDS = 120;
export const MAX_OPTIONS = 100;
export const MAX_TEXT_LENGTH = 4_000;

export const semanticFields = [
  'first-name',
  'middle-name',
  'last-name',
  'full-name',
  'email',
  'phone',
  'address-line1',
  'address-line2',
  'city',
  'region',
  'postal-code',
  'country',
  'linkedin-url',
  'portfolio-url',
  'current-company',
  'current-title',
  'work-authorization',
  'visa-sponsorship',
  'salary-expectation',
  'government-identifier',
  'voluntary-demographic',
  'narrative-answer',
  'unknown',
] as const;

export type SemanticField = (typeof semanticFields)[number];

export const sensitiveSemantics = new Set<SemanticField>([
  'government-identifier',
  'work-authorization',
  'visa-sponsorship',
  'voluntary-demographic',
  'salary-expectation',
]);

export type ControlKind =
  | 'input'
  | 'textarea'
  | 'select'
  | 'radio-group'
  | 'checkbox'
  | 'combobox'
  | 'unsupported';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldDescriptor {
  id: string;
  control: ControlKind;
  inputType?: string;
  label: string;
  nearbyLabel?: string;
  name?: string;
  autocomplete?: string;
  required: boolean;
  options: FieldOption[];
  unsupportedReason?: string;
  maxLength?: number;
}

export type MappingClassification =
  | 'model-suggested'
  | 'deterministic'
  | 'sensitive-confirmation-required'
  | 'unsupported'
  | 'manual';

export interface ScopedValue {
  sourceKey: string;
  semantic: SemanticField;
  displayLabel: string;
  value: string;
  userApprovedAt?: number;
}

export interface MappingProposal {
  fieldId: string;
  sourceKey: string;
  classification: 'model-suggested' | 'deterministic' | 'manual';
  confidence: number;
  reason: string;
  evidence?: string[];
}

export interface AutofillData {
  values: ScopedValue[];
  proposals: MappingProposal[];
}

export interface PairingUpdateRequest {
  type: 'applyfill.pair' | 'applyfill.sync-profile';
  protocolVersion: typeof PAIRING_PROTOCOL_VERSION;
  pairingSecret: string;
  includeSensitive: boolean;
  profileUpdatedAtUtc: string;
  values: ScopedValue[];
}

export interface PairingControlRequest {
  type: 'applyfill.pairing-status' | 'applyfill.unpair';
  protocolVersion: typeof PAIRING_PROTOCOL_VERSION;
  pairingSecret: string;
}

export interface PairedInspectRequest {
  type: 'applyfill.inspect-paired';
  protocolVersion: typeof PAIRING_PROTOCOL_VERSION;
  pairingSecret: string;
  targetTabId: number;
}

export interface PairedAiUpdateRequest {
  type: 'applyfill.attach-ai-suggestions';
  protocolVersion: typeof PAIRING_PROTOCOL_VERSION;
  pairingSecret: string;
  targetTabId: number;
  values: ScopedValue[];
  proposals: MappingProposal[];
}

export interface ReviewItem {
  field: FieldDescriptor;
  sourceKey?: string;
  semantic?: SemanticField;
  proposedValue?: string;
  classification: MappingClassification;
  confidence: number;
  reason: string;
}

export interface FillSelection {
  fieldId: string;
  value: string;
  selected: boolean;
  classification: MappingClassification;
}

export type FillStatus = 'filled' | 'skipped' | 'unsupported' | 'changed-by-site' | 'failed';

export interface FillResult {
  fieldId: string;
  label: string;
  status: FillStatus;
  detail?: string;
}

export interface CompletionReport {
  results: FillResult[];
  completedAt: number;
  requiresManualReview: true;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, allowed: readonly string[]): boolean =>
  Object.keys(value).every((key) => allowed.includes(key));

const boundedString = (value: unknown, max = MAX_TEXT_LENGTH): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max;

const isSemantic = (value: unknown): value is SemanticField =>
  typeof value === 'string' && semanticFields.includes(value as SemanticField);

function validateProposal(value: unknown): value is MappingProposal {
  if (!isRecord(value) || !hasExactKeys(value, ['fieldId', 'sourceKey', 'classification', 'confidence', 'reason', 'evidence'])) return false;
  const allowedClassifications = ['model-suggested', 'deterministic', 'manual'];
  return boundedString(value.fieldId, 120)
    && boundedString(value.sourceKey, 100)
    && typeof value.classification === 'string'
    && allowedClassifications.includes(value.classification)
    && typeof value.confidence === 'number'
    && Number.isFinite(value.confidence)
    && value.confidence >= 0
    && value.confidence <= 1
    && boundedString(value.reason, 300)
    && (value.evidence === undefined
      || (Array.isArray(value.evidence) && value.evidence.length <= 8 && value.evidence.every((entry) => boundedString(entry, 180))));
}

export function byteLength(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

const validPairingSecret = (value: unknown): value is string => typeof value === 'string'
  && /^[A-Za-z0-9_-]{32,128}$/.test(value);

export function validatePairingUpdate(value: unknown): ValidationResult<PairingUpdateRequest> {
  if (byteLength(value) > MAX_MESSAGE_BYTES) return { ok: false, error: 'Profile update exceeds the 64 KiB limit.' };
  if (!isRecord(value) || !hasExactKeys(value, [
    'type', 'protocolVersion', 'pairingSecret', 'includeSensitive', 'profileUpdatedAtUtc', 'values',
  ])) return { ok: false, error: 'Profile update has an invalid shape.' };
  if ((value.type !== 'applyfill.pair' && value.type !== 'applyfill.sync-profile')
    || value.protocolVersion !== PAIRING_PROTOCOL_VERSION
    || !validPairingSecret(value.pairingSecret)
    || typeof value.includeSensitive !== 'boolean'
    || typeof value.profileUpdatedAtUtc !== 'string'
    || !Number.isFinite(Date.parse(value.profileUpdatedAtUtc))) {
    return { ok: false, error: 'Profile update is invalid.' };
  }
  if (!Array.isArray(value.values) || value.values.length > MAX_FIELDS) {
    return { ok: false, error: 'Profile update contains too many values.' };
  }
  const valuesValid = value.values.every((entry) => {
    if (!isRecord(entry) || !hasExactKeys(entry, ['sourceKey', 'semantic', 'displayLabel', 'value', 'userApprovedAt'])) return false;
    if (!isSemantic(entry.semantic)
      || !boundedString(entry.sourceKey, 100)
      || !boundedString(entry.displayLabel, 160)
      || !boundedString(entry.value)
      || entry.userApprovedAt !== undefined) return false;
    return value.includeSensitive || !isSensitiveSemantic(entry.semantic);
  });
  if (!valuesValid || new Set(value.values.map((entry) => (entry as ScopedValue).sourceKey)).size !== value.values.length) {
    return { ok: false, error: 'Profile update contains invalid or duplicate values.' };
  }
  return { ok: true, value: value as unknown as PairingUpdateRequest };
}

export function validatePairingControl(value: unknown): ValidationResult<PairingControlRequest> {
  if (byteLength(value) > 1_024) return { ok: false, error: 'Pairing request is too large.' };
  if (!isRecord(value) || !hasExactKeys(value, ['type', 'protocolVersion', 'pairingSecret'])
    || (value.type !== 'applyfill.pairing-status' && value.type !== 'applyfill.unpair')
    || value.protocolVersion !== PAIRING_PROTOCOL_VERSION
    || !validPairingSecret(value.pairingSecret)) {
    return { ok: false, error: 'Pairing request is invalid.' };
  }
  return { ok: true, value: value as unknown as PairingControlRequest };
}

export function validatePairedInspect(value: unknown): ValidationResult<PairedInspectRequest> {
  if (byteLength(value) > 1_024
    || !isRecord(value)
    || !hasExactKeys(value, ['type', 'protocolVersion', 'pairingSecret', 'targetTabId'])
    || value.type !== 'applyfill.inspect-paired'
    || value.protocolVersion !== PAIRING_PROTOCOL_VERSION
    || !validPairingSecret(value.pairingSecret)
    || !Number.isSafeInteger(value.targetTabId)
    || (value.targetTabId as number) < 0) {
    return { ok: false, error: 'Paired inspection request is invalid.' };
  }
  return { ok: true, value: value as unknown as PairedInspectRequest };
}

export function validatePairedAiUpdate(value: unknown): ValidationResult<PairedAiUpdateRequest> {
  if (byteLength(value) > MAX_MESSAGE_BYTES
    || !isRecord(value)
    || !hasExactKeys(value, ['type', 'protocolVersion', 'pairingSecret', 'targetTabId', 'values', 'proposals'])
    || value.type !== 'applyfill.attach-ai-suggestions'
    || value.protocolVersion !== PAIRING_PROTOCOL_VERSION
    || !validPairingSecret(value.pairingSecret)
    || !Number.isSafeInteger(value.targetTabId)
    || (value.targetTabId as number) < 0
    || !Array.isArray(value.values)
    || value.values.length > MAX_FIELDS
    || !Array.isArray(value.proposals)
    || value.proposals.length > MAX_FIELDS) {
    return { ok: false, error: 'Local AI suggestion update is invalid.' };
  }
  const valuesValid = value.values.every((entry) => isRecord(entry)
    && hasExactKeys(entry, ['sourceKey', 'semantic', 'displayLabel', 'value', 'userApprovedAt'])
    && isSemantic(entry.semantic)
    && !isSensitiveSemantic(entry.semantic)
    && boundedString(entry.sourceKey, 100)
    && boundedString(entry.displayLabel, 160)
    && boundedString(entry.value)
    && entry.userApprovedAt === undefined);
  const proposalsValid = value.proposals.every(validateProposal);
  if (!valuesValid || !proposalsValid) {
    return { ok: false, error: 'Local AI suggestion values are invalid.' };
  }
  const sourceKeys = new Set(value.values.map((entry) => (entry as ScopedValue).sourceKey));
  const proposalFieldIds = new Set(value.proposals.map((entry) => (entry as MappingProposal).fieldId));
  if (sourceKeys.size !== value.values.length || proposalFieldIds.size !== value.proposals.length) {
    return { ok: false, error: 'Local AI suggestion values are invalid.' };
  }
  return { ok: true, value: value as unknown as PairedAiUpdateRequest };
}

export function isSensitiveSemantic(value: SemanticField | undefined): boolean {
  return value !== undefined && sensitiveSemantics.has(value);
}

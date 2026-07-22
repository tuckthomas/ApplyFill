export const PROTOCOL_VERSION = 'applyfill.autofill.v1' as const;
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

export interface SelectedDocument {
  documentId: string;
  versionId: string;
  fileName: string;
}

export interface HandoffRequest {
  type: 'applyfill.handoff';
  protocolVersion: typeof PROTOCOL_VERSION;
  targetTabId: number;
  nonce: string;
  expiresAt: number;
  values: ScopedValue[];
  proposals: MappingProposal[];
  selectedDocument?: SelectedDocument;
}

export interface DisconnectRequest {
  type: 'applyfill.disconnect';
  protocolVersion: typeof PROTOCOL_VERSION;
  targetTabId: number;
  nonce: string;
}

export interface InspectRequest {
  type: 'applyfill.inspect';
  protocolVersion: typeof PROTOCOL_VERSION;
  targetTabId: number;
  nonce: string;
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

function validateScopedValue(value: unknown, now: number): value is ScopedValue {
  if (!isRecord(value) || !hasExactKeys(value, ['sourceKey', 'semantic', 'displayLabel', 'value', 'userApprovedAt'])) return false;
  if (!isSemantic(value.semantic)) return false;
  const baseValid = boundedString(value.sourceKey, 100)
    && boundedString(value.displayLabel, 160)
    && boundedString(value.value);
  if (!baseValid) return false;
  if (isSensitiveSemantic(value.semantic)) {
    return typeof value.userApprovedAt === 'number'
      && Number.isSafeInteger(value.userApprovedAt)
      && value.userApprovedAt <= now
      && value.userApprovedAt >= now - 60_000;
  }
  return value.userApprovedAt === undefined;
}

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

function validateSelectedDocument(value: unknown): value is SelectedDocument {
  return isRecord(value)
    && hasExactKeys(value, ['documentId', 'versionId', 'fileName'])
    && boundedString(value.documentId, 120)
    && boundedString(value.versionId, 120)
    && boundedString(value.fileName, 220)
    && /\.(?:pdf|docx)$/i.test(value.fileName);
}

export function byteLength(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function validateHandoff(value: unknown, now = Date.now()): ValidationResult<HandoffRequest> {
  if (byteLength(value) > MAX_MESSAGE_BYTES) return { ok: false, error: 'Handoff exceeds the 64 KiB limit.' };
  if (!isRecord(value) || !hasExactKeys(value, [
    'type', 'protocolVersion', 'targetTabId', 'nonce', 'expiresAt', 'values', 'proposals', 'selectedDocument',
  ])) return { ok: false, error: 'Handoff has an invalid shape.' };
  if (value.type !== 'applyfill.handoff' || value.protocolVersion !== PROTOCOL_VERSION) {
    return { ok: false, error: 'Unsupported handoff protocol.' };
  }
  if (!Number.isSafeInteger(value.targetTabId) || (value.targetTabId as number) < 0) {
    return { ok: false, error: 'Invalid target tab.' };
  }
  if (!boundedString(value.nonce, 128) || !/^[A-Za-z0-9_-]{24,128}$/.test(value.nonce)) {
    return { ok: false, error: 'Invalid one-time code.' };
  }
  if (typeof value.expiresAt !== 'number' || !Number.isSafeInteger(value.expiresAt)
    || value.expiresAt <= now || value.expiresAt > now + SESSION_TTL_MS) {
    return { ok: false, error: 'Handoff is expired or has an invalid lifetime.' };
  }
  if (!Array.isArray(value.values) || value.values.length > MAX_FIELDS || !value.values.every((entry) => validateScopedValue(entry, now))) {
    return { ok: false, error: 'Invalid scoped values.' };
  }
  if (!Array.isArray(value.proposals) || value.proposals.length > MAX_FIELDS || !value.proposals.every(validateProposal)) {
    return { ok: false, error: 'Invalid mapping proposals.' };
  }
  if (value.selectedDocument !== undefined && !validateSelectedDocument(value.selectedDocument)) {
    return { ok: false, error: 'Invalid selected document metadata.' };
  }
  const sourceKeys = new Set(value.values.map((entry) => entry.sourceKey));
  if (sourceKeys.size !== value.values.length || value.proposals.some((entry) => !sourceKeys.has(entry.sourceKey))) {
    return { ok: false, error: 'Mapping proposals reference unknown or duplicate values.' };
  }
  return { ok: true, value: value as unknown as HandoffRequest };
}

export function validateDisconnect(value: unknown): ValidationResult<DisconnectRequest> {
  if (byteLength(value) > 1_024) return { ok: false, error: 'Disconnect request is too large.' };
  if (!isRecord(value) || !hasExactKeys(value, ['type', 'protocolVersion', 'targetTabId', 'nonce'])) {
    return { ok: false, error: 'Disconnect request has an invalid shape.' };
  }
  if (value.type !== 'applyfill.disconnect' || value.protocolVersion !== PROTOCOL_VERSION) {
    return { ok: false, error: 'Unsupported disconnect protocol.' };
  }
  if (!Number.isSafeInteger(value.targetTabId) || (value.targetTabId as number) < 0) {
    return { ok: false, error: 'Invalid target tab.' };
  }
  if (!boundedString(value.nonce, 128) || !/^[A-Za-z0-9_-]{24,128}$/.test(value.nonce)) {
    return { ok: false, error: 'Invalid one-time code.' };
  }
  return { ok: true, value: value as unknown as DisconnectRequest };
}

export function validateInspect(value: unknown): ValidationResult<InspectRequest> {
  if (byteLength(value) > 1_024) return { ok: false, error: 'Inspect request is too large.' };
  if (!isRecord(value) || !hasExactKeys(value, ['type', 'protocolVersion', 'targetTabId', 'nonce'])) {
    return { ok: false, error: 'Inspect request has an invalid shape.' };
  }
  if (value.type !== 'applyfill.inspect' || value.protocolVersion !== PROTOCOL_VERSION) {
    return { ok: false, error: 'Unsupported inspect protocol.' };
  }
  if (!Number.isSafeInteger(value.targetTabId) || (value.targetTabId as number) < 0) {
    return { ok: false, error: 'Invalid target tab.' };
  }
  if (!boundedString(value.nonce, 128) || !/^[A-Za-z0-9_-]{24,128}$/.test(value.nonce)) {
    return { ok: false, error: 'Invalid one-time code.' };
  }
  return { ok: true, value: value as unknown as InspectRequest };
}

export function isSensitiveSemantic(value: SemanticField | undefined): boolean {
  return value !== undefined && sensitiveSemantics.has(value);
}

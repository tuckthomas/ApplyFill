import {
  type FieldDescriptor,
  type AutofillData,
  type MappingProposal,
  type ReviewItem,
  type ScopedValue,
  type SemanticField,
  isSensitiveSemantic,
} from './contracts';

const promptInjectionPattern = /(?:ignore|disregard|override).{0,40}(?:instruction|policy|rule)|(?:reveal|send|upload).{0,35}(?:secret|profile|password|cookie)|<\s*script|javascript:/iu;
const prohibitedAutofillPattern = /\b(?:certify|attest|electronic\s*signature|terms\s*(?:and|&)\s*conditions|final\s*submit|submit\s*application|captcha)\b/i;

const deterministicPatterns: ReadonlyArray<[SemanticField, RegExp]> = [
  ['email', /\b(?:e-?mail)\b/i],
  ['phone', /\b(?:phone|mobile|telephone)\b/i],
  ['first-name', /\bfirst\s*name\b/i],
  ['middle-name', /\bmiddle\s*name\b/i],
  ['last-name', /\b(?:last|family|surname)\s*name\b/i],
  ['full-name', /\b(?:full|legal)\s*name\b/i],
  ['address-line1', /\b(?:street|address\s*(?:line)?\s*1)\b/i],
  ['address-line2', /\b(?:unit|suite|apt|apartment|address\s*(?:line)?\s*2)\b/i],
  ['city', /\b(?:city|town)\b/i],
  ['region', /\b(?:state|province|region)\b/i],
  ['postal-code', /\b(?:zip|postal)\s*(?:code)?\b/i],
  ['country', /\bcountry\b/i],
  ['linkedin-url', /\blinkedin\b/i],
  ['portfolio-url', /\b(?:portfolio|personal\s*(?:site|website))\b/i],
  ['current-company', /\bcurrent\s*(?:company|employer)\b/i],
  ['current-title', /\bcurrent\s*(?:title|position|role)\b/i],
  ['work-authorization', /\b(?:authorized|eligible).{0,25}(?:work|employment)\b/i],
  ['visa-sponsorship', /\b(?:visa|sponsorship|sponsor)\b/i],
  ['salary-expectation', /\b(?:salary|compensation|pay)\s*(?:expectation|requirement|desired)?\b/i],
  ['government-identifier', /\b(?:social\s*security|ssn|national\s*(?:id|identifier)|government\s*(?:id|identifier))\b/i],
  ['voluntary-demographic', /\b(?:race|ethnicity|gender|disability|veteran)\b/i],
];

const textFor = (field: FieldDescriptor): string =>
  [field.label, field.nearbyLabel, field.name, field.autocomplete].filter(Boolean).join(' ').slice(0, 600);

export function classifyDeterministically(field: FieldDescriptor): SemanticField | undefined {
  const autocomplete: Partial<Record<string, SemanticField>> = {
    name: 'full-name',
    'given-name': 'first-name',
    'additional-name': 'middle-name',
    'family-name': 'last-name',
    email: 'email',
    tel: 'phone',
    'address-line1': 'address-line1',
    'address-line2': 'address-line2',
    'address-level2': 'city',
    'address-level1': 'region',
    'postal-code': 'postal-code',
    country: 'country',
    'country-name': 'country',
  };
  if (field.autocomplete && autocomplete[field.autocomplete]) return autocomplete[field.autocomplete];
  const text = textFor(field);
  return deterministicPatterns.find(([, pattern]) => pattern.test(text))?.[0];
}

function safeProposal(field: FieldDescriptor, proposal: MappingProposal | undefined, value: ScopedValue | undefined): boolean {
  if (!proposal || !value) return false;
  if (promptInjectionPattern.test(textFor(field)) || prohibitedAutofillPattern.test(textFor(field))) return false;
  if (promptInjectionPattern.test(proposal.reason) || proposal.evidence?.some((entry) => promptInjectionPattern.test(entry))) return false;
  return proposal.classification !== 'model-suggested' || !isSensitiveSemantic(value.semantic);
}

export function buildReviewItems(fields: FieldDescriptor[], data: AutofillData): ReviewItem[] {
  const values = new Map(data.values.map((value) => [value.sourceKey, value]));
  const proposals = new Map(data.proposals.map((proposal) => [proposal.fieldId, proposal]));

  return fields.map((field): ReviewItem => {
    if (field.control === 'unsupported' || field.unsupportedReason) {
      return { field, classification: 'unsupported', confidence: 1, reason: field.unsupportedReason ?? 'Unsupported control.' };
    }

    if (prohibitedAutofillPattern.test(textFor(field))) {
      return { field, classification: 'manual', confidence: 1, reason: 'Legal attestations, signatures, CAPTCHAs, and final submission are always manual.' };
    }

    const deterministic = classifyDeterministically(field);
    const deterministicValue = data.values.find((entry) => entry.semantic === deterministic);
    if (deterministic && deterministicValue) {
      const sensitive = isSensitiveSemantic(deterministic);
      return {
        field,
        sourceKey: deterministicValue.sourceKey,
        semantic: deterministic,
        proposedValue: deterministicValue.value,
        classification: sensitive ? 'sensitive-confirmation-required' : 'deterministic',
        confidence: 1,
        reason: sensitive
          ? 'Known sensitive field; direct insertion requires confirmation and bypasses AI.'
          : 'Matched from platform semantics and the field label.',
      };
    }

    const proposal = proposals.get(field.id);
    const proposedValue = proposal ? values.get(proposal.sourceKey) : undefined;
    if (safeProposal(field, proposal, proposedValue)) {
      const sensitive = isSensitiveSemantic(proposedValue?.semantic);
      return {
        field,
        sourceKey: proposedValue?.sourceKey,
        semantic: proposedValue?.semantic,
        proposedValue: proposedValue?.value,
        classification: sensitive ? 'sensitive-confirmation-required' : proposal?.classification ?? 'manual',
        confidence: proposal?.confidence ?? 0,
        reason: proposal?.reason ?? 'Manual review required.',
      };
    }

    return {
      field,
      classification: 'manual',
      confidence: 0,
      reason: proposal ? 'Unsafe or invalid mapping proposal was rejected.' : 'No safe mapping was proposed.',
    };
  });
}

export function createModelSafeDescriptors(fields: FieldDescriptor[]): FieldDescriptor[] {
  return fields.map((field) => {
    const sensitive = classifyDeterministically(field);
    if (isSensitiveSemantic(sensitive)) {
      return { ...field, label: '[sensitive field]', nearbyLabel: undefined, name: undefined, options: [] };
    }
    const scrub = (value: string | undefined): string | undefined => {
      if (!value) return value;
      return promptInjectionPattern.test(value) ? '[untrusted field text removed]' : value.slice(0, 300);
    };
    return {
      ...field,
      label: scrub(field.label) ?? '',
      nearbyLabel: scrub(field.nearbyLabel),
      name: scrub(field.name),
      options: field.options.map((option) => ({
        value: scrub(option.value) ?? '',
        label: scrub(option.label) ?? '',
      })),
    };
  });
}

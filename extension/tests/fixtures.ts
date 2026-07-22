import {
  PROTOCOL_VERSION,
  type FieldDescriptor,
  type HandoffRequest,
  type ScopedValue,
} from '../src/contracts';

export const fields: FieldDescriptor[] = [
  { id: 'field-email', control: 'input', inputType: 'email', label: 'Email', autocomplete: 'email', required: true, options: [] },
  { id: 'field-ssn', control: 'input', inputType: 'text', label: 'Social Security number', required: false, options: [] },
];

export function values(now = Date.now()): ScopedValue[] {
  return [
    { sourceKey: 'contact.email', semantic: 'email', displayLabel: 'Email', value: 'person@example.test' },
    {
      sourceKey: 'private.ssn',
      semantic: 'government-identifier',
      displayLabel: 'Government identifier',
      value: '123-45-6789',
      userApprovedAt: now - 1_000,
    },
  ];
}

export function handoff(overrides: Partial<HandoffRequest> = {}, now = Date.now()): HandoffRequest {
  return {
    type: 'applyfill.handoff',
    protocolVersion: PROTOCOL_VERSION,
    targetTabId: 42,
    nonce: 'abcdefghijklmnopqrstuvwxyz123456',
    expiresAt: now + 60_000,
    values: values(now),
    proposals: [],
    ...overrides,
  };
}

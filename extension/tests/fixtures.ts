import { type AutofillData, type FieldDescriptor, type ScopedValue } from '../src/contracts';

export const fields: FieldDescriptor[] = [
  { id: 'field-email', control: 'input', inputType: 'email', label: 'Email', autocomplete: 'email', required: true, options: [] },
  { id: 'field-ssn', control: 'input', inputType: 'text', label: 'Social Security number', required: false, options: [] },
];

export function values(): ScopedValue[] {
  return [
    { sourceKey: 'contact.email', semantic: 'email', displayLabel: 'Email', value: 'person@example.test' },
    {
      sourceKey: 'private.ssn',
      semantic: 'government-identifier',
      displayLabel: 'Government identifier',
      value: '123-45-6789',
    },
  ];
}

export function autofillData(overrides: Partial<AutofillData> = {}): AutofillData {
  return {
    values: values(),
    proposals: [],
    ...overrides,
  };
}

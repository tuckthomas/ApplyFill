import { describe, expect, it } from 'vitest';
import { createDefaultProfileBuilderState, createLocalProfileDocument } from '../profile/profileBuilder';
import { createScopedAutofillValues, parseConnectionCode } from './extensionHandoff';

describe('autofill extension handoff', () => {
  it('parses a bounded one-time connection code', () => {
    expect(parseConnectionCode(`42.${'a'.repeat(24)}`)).toEqual({ targetTabId: 42, nonce: 'a'.repeat(24) });
    expect(() => parseConnectionCode('not-a-code')).toThrow();
  });

  it('excludes sensitive application values unless the user opts in', () => {
    const state = createDefaultProfileBuilderState();
    state.data.profile.firstName = 'Ada';
    state.data.profile.lastName = 'Lovelace';
    state.data.profile.email = 'ada@example.test';
    state.data.applicationQuestions.governmentIdentifiers = [{
      id: 1,
      country: { label: 'United States', value: 'US' },
      identifierType: 'SSN',
      value: '000-00-0000',
    }];
    const document = createLocalProfileDocument(state);
    const safe = createScopedAutofillValues(document, false);
    const sensitive = createScopedAutofillValues(document, true);
    expect(safe.some((entry) => entry.semantic === 'government-identifier')).toBe(false);
    expect(sensitive.some((entry) => entry.value === '000-00-0000')).toBe(true);
    expect(safe.find((entry) => entry.semantic === 'full-name')?.value).toBe('Ada Lovelace');
  });
});

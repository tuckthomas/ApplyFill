import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProfileBuilderState, createLocalProfileDocument } from '../profile/profileBuilder';
import {
  AUTOFILL_EXTENSION_ID_KEY,
  AUTOFILL_PAIRING_SECRET_KEY,
  createScopedAutofillValues,
  getAutofillPairingStatus,
  pairAutofillExtension,
  unpairAutofillExtension,
} from './extensionHandoff';

describe('autofill extension handoff', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      get length() { return values.size; },
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, String(value)),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

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

  it('pairs once, reuses the saved secret for status, and clears it only after acknowledged unpair', async () => {
    const messages: unknown[] = [];
    vi.stubGlobal('chrome', {
      runtime: {
        sendMessage: (_extensionId: string, message: unknown, callback: (response: unknown) => void) => {
          messages.push(message);
          callback({ ok: true, paired: true });
        },
      },
    });
    const extensionId = 'a'.repeat(32);
    const document = createLocalProfileDocument(createDefaultProfileBuilderState());
    await pairAutofillExtension(extensionId, document, false);
    const secret = localStorage.getItem(AUTOFILL_PAIRING_SECRET_KEY);
    expect(localStorage.getItem(AUTOFILL_EXTENSION_ID_KEY)).toBe(extensionId);
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);

    await pairAutofillExtension(extensionId, document, false);
    expect(localStorage.getItem(AUTOFILL_PAIRING_SECRET_KEY)).toBe(secret);

    await getAutofillPairingStatus();
    expect(messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'applyfill.pair', pairingSecret: secret }),
      expect.objectContaining({ type: 'applyfill.pairing-status', pairingSecret: secret }),
    ]));

    await unpairAutofillExtension();
    expect(messages.at(-1)).toEqual(expect.objectContaining({ type: 'applyfill.unpair', pairingSecret: secret }));
    expect(localStorage.getItem(AUTOFILL_PAIRING_SECRET_KEY)).toBeNull();
    expect(localStorage.getItem(AUTOFILL_EXTENSION_ID_KEY)).toBeNull();
  });
});

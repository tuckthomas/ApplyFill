import { describe, expect, it } from 'vitest';
import {
  MAX_MESSAGE_BYTES,
  PAIRING_PROTOCOL_VERSION,
  validatePairedAiUpdate,
  validatePairedInspect,
  validatePairingControl,
  validatePairingUpdate,
} from '../src/contracts';

const pairingSecret = 'a'.repeat(43);

describe('persistent pairing protocol validation', () => {
  const now = 1_900_000_000_000;
  const update = {
    type: 'applyfill.pair',
    protocolVersion: PAIRING_PROTOCOL_VERSION,
    pairingSecret,
    includeSensitive: false,
    profileUpdatedAtUtc: new Date(now).toISOString(),
    values: [{ sourceKey: 'profile.email', semantic: 'email', displayLabel: 'Email', value: 'person@example.test' }],
  } as const;

  it('accepts a bounded profile pairing without per-application codes', () => {
    expect(validatePairingUpdate(update)).toMatchObject({ ok: true });
  });

  it('rejects unapproved sensitive values, duplicates, unknown keys, and oversized updates', () => {
    const sensitive = { sourceKey: 'profile.ssn', semantic: 'government-identifier', displayLabel: 'SSN', value: '123-45-6789' };
    expect(validatePairingUpdate({ ...update, values: [...update.values, sensitive] })).toMatchObject({ ok: false });
    expect(validatePairingUpdate({ ...update, includeSensitive: true, values: [...update.values, sensitive] })).toMatchObject({ ok: true });
    expect(validatePairingUpdate({ ...update, values: [update.values[0], update.values[0]] })).toMatchObject({ ok: false });
    expect(validatePairingUpdate({ ...update, extra: true })).toMatchObject({ ok: false });
    expect(validatePairingUpdate({ ...update, values: [{ ...update.values[0], value: 'x'.repeat(MAX_MESSAGE_BYTES) }] }))
      .toEqual({ ok: false, error: 'Profile update exceeds the 64 KiB limit.' });
  });

  it('validates exact pairing status, unpair, and page-inspection requests', () => {
    const status = { type: 'applyfill.pairing-status', protocolVersion: PAIRING_PROTOCOL_VERSION, pairingSecret };
    expect(validatePairingControl(status)).toMatchObject({ ok: true });
    expect(validatePairingControl({ ...status, type: 'applyfill.unpair' })).toMatchObject({ ok: true });
    expect(validatePairingControl({ ...status, targetTabId: 42 })).toMatchObject({ ok: false });
    expect(validatePairedInspect({
      type: 'applyfill.inspect-paired', protocolVersion: PAIRING_PROTOCOL_VERSION, pairingSecret, targetTabId: 42,
    })).toMatchObject({ ok: true });
  });

  it('accepts only unique, non-sensitive Local AI suggestions', () => {
    const suggestion = {
      type: 'applyfill.attach-ai-suggestions',
      protocolVersion: PAIRING_PROTOCOL_VERSION,
      pairingSecret,
      targetTabId: 42,
      values: [{ sourceKey: 'generated.answer', semantic: 'narrative-answer', displayLabel: 'Answer', value: 'Draft answer' }],
      proposals: [{ fieldId: 'question-1', sourceKey: 'generated.answer', classification: 'model-suggested', confidence: .8, reason: 'Matched locally' }],
    } as const;
    expect(validatePairedAiUpdate(suggestion)).toMatchObject({ ok: true });
    expect(validatePairedAiUpdate({ ...suggestion, values: [{ ...suggestion.values[0], semantic: 'government-identifier' }] }))
      .toMatchObject({ ok: false });
    expect(validatePairedAiUpdate({ ...suggestion, proposals: [suggestion.proposals[0], suggestion.proposals[0]] }))
      .toMatchObject({ ok: false });
  });

  it('rejects prototype-pollution keys', () => {
    const polluted = JSON.parse(`{"type":"applyfill.pairing-status","protocolVersion":"${PAIRING_PROTOCOL_VERSION}","pairingSecret":"${pairingSecret}","__proto__":{"admin":true}}`);
    expect(validatePairingControl(polluted)).toMatchObject({ ok: false });
    expect(({} as { admin?: boolean }).admin).toBeUndefined();
  });
});

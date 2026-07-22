import { describe, expect, it } from 'vitest';
import { MAX_MESSAGE_BYTES, PROTOCOL_VERSION, validateDisconnect, validateHandoff, validateInspect } from '../src/contracts';
import { handoff } from './fixtures';

describe('handoff protocol validation', () => {
  const now = 1_900_000_000_000;

  it('accepts a bounded versioned handoff', () => {
    expect(validateHandoff(handoff({}, now), now)).toMatchObject({ ok: true });
  });

  it.each([
    ['wrong schema', { protocolVersion: 'applyfill.autofill.v0' }],
    ['expired nonce', { expiresAt: now - 1 }],
    ['unknown field', { extra: 'not allowed' }],
  ])('rejects %s', (_label, mutation) => {
    expect(validateHandoff({ ...handoff({}, now), ...mutation }, now)).toMatchObject({ ok: false });
  });

  it('rejects unknown source keys and duplicate values', () => {
    const base = handoff({}, now);
    expect(validateHandoff({
      ...base,
      proposals: [{ fieldId: 'field-email', sourceKey: 'missing', classification: 'model-suggested', confidence: .8, reason: 'Label match' }],
    }, now)).toMatchObject({ ok: false });
    expect(validateHandoff({ ...base, values: [base.values[0], base.values[0]] }, now)).toMatchObject({ ok: false });
  });

  it('rejects oversized packets before parsing their contents', () => {
    const base = handoff({}, now);
    const oversized = { ...base, values: [{ ...base.values[0], value: 'a'.repeat(MAX_MESSAGE_BYTES) }] };
    expect(validateHandoff(oversized, now)).toEqual({ ok: false, error: 'Handoff exceeds the 64 KiB limit.' });
  });

  it('requires recent explicit approval metadata on sensitive values', () => {
    const base = handoff({}, now);
    const sensitive = base.values[1]!;
    expect(validateHandoff({ ...base, values: [base.values[0], { ...sensitive, userApprovedAt: undefined }] }, now)).toMatchObject({ ok: false });
    expect(validateHandoff({ ...base, values: [base.values[0], { ...sensitive, userApprovedAt: now - 60_001 }] }, now)).toMatchObject({ ok: false });
  });

  it('validates an exact bounded disconnect contract', () => {
    const valid = { type: 'applyfill.disconnect', protocolVersion: PROTOCOL_VERSION, targetTabId: 42, nonce: 'abcdefghijklmnopqrstuvwxyz123456' };
    expect(validateDisconnect(valid)).toMatchObject({ ok: true });
    expect(validateDisconnect({ ...valid, origin: 'https://evil.test' })).toMatchObject({ ok: false });
  });

  it('validates a strict, bounded inspection contract', () => {
    const valid = { type: 'applyfill.inspect', protocolVersion: PROTOCOL_VERSION, targetTabId: 42, nonce: 'abcdefghijklmnopqrstuvwxyz123456' };
    expect(validateInspect(valid)).toMatchObject({ ok: true });
    expect(validateInspect({ ...valid, expiresAt: now + 1_000 })).toMatchObject({ ok: false });
    expect(validateInspect({ ...valid, nonce: 'short' })).toMatchObject({ ok: false });
    expect(validateInspect({ ...valid, padding: 'x'.repeat(1_024) })).toEqual({ ok: false, error: 'Inspect request is too large.' });
  });

  it('rejects prototype-pollution keys and mismatched protocol versions', () => {
    const polluted = JSON.parse(`{"type":"applyfill.handoff","protocolVersion":"${PROTOCOL_VERSION}","targetTabId":42,"nonce":"abcdefghijklmnopqrstuvwxyz123456","expiresAt":${now + 10_000},"values":[],"proposals":[],"__proto__":{"admin":true}}`);
    expect(validateHandoff(polluted, now)).toMatchObject({ ok: false });
    expect(({} as { admin?: boolean }).admin).toBeUndefined();
  });
});

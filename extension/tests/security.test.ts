import { describe, expect, it } from 'vitest';
import { isApprovedApplyFillOrigin, normalizeSenderOrigin, safeErrorMessage } from '../src/security';

describe('origin and diagnostic security', () => {
  it.each([
    'https://applyfill.app',
    'https://www.applyfill.app',
    'http://localhost:5173',
    'http://127.0.0.1:4173',
  ])('allows the exact approved origin %s', (origin) => expect(isApprovedApplyFillOrigin(origin)).toBe(true));

  it.each([
    'https://applyfill.app.evil.test',
    'http://localhost:3000',
    'https://127.0.0.1:5173',
    'null',
    undefined,
  ])('rejects the non-approved origin %s', (origin) => expect(isApprovedApplyFillOrigin(origin)).toBe(false));

  it('normalizes a sender URL without accepting malformed data', () => {
    expect(normalizeSenderOrigin({ url: 'https://applyfill.app/profile' })).toBe('https://applyfill.app');
    expect(normalizeSenderOrigin({ url: 'not a URL' })).toBeUndefined();
  });

  it('never echoes page or profile content in diagnostic output', () => {
    const secret = '123-45-6789';
    expect(safeErrorMessage(new Error(`hostile page exposed ${secret}`))).toBe('The local autofill operation could not be completed.');
    expect(safeErrorMessage(new Error(secret))).not.toContain(secret);
  });
});

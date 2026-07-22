import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildReviewItems } from '../src/mapping';
import { reviewInputType, sensitiveConfirmationFieldIds } from '../src/review-policy';
import { fields, handoff } from './fixtures';

describe('sensitive review presentation', () => {
  it('masks sensitive values and identifies every required confirmation', () => {
    const review = buildReviewItems(fields, handoff());
    const email = review.find((item) => item.field.id === 'field-email')!;
    const ssn = review.find((item) => item.field.id === 'field-ssn')!;
    expect(reviewInputType(email)).toBe('text');
    expect(reviewInputType(ssn)).toBe('password');
    expect(sensitiveConfirmationFieldIds(review, new Set(['field-email', 'field-ssn']))).toEqual(['field-ssn']);
  });
});

describe('least-privilege manifest', () => {
  it('uses only activeTab/scripting and disallows remote code, incognito, and persistent content scripts', async () => {
    const manifest = JSON.parse(await readFile(resolve('public/manifest.json'), 'utf8')) as Record<string, unknown>;
    expect(manifest.permissions).toEqual(['activeTab', 'scripting']);
    expect(manifest).not.toHaveProperty('host_permissions');
    expect(manifest).not.toHaveProperty('content_scripts');
    expect(manifest.incognito).toBe('not_allowed');
    expect(manifest.content_security_policy).toEqual({
      extension_pages: "script-src 'self'; object-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    });
  });
});

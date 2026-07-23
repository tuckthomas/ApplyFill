import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveResumeArtifact } from './resumeArtifacts';

describe('resume application artifacts', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uploads the reviewed file as multipart data with local command protection', async () => {
    const metadata = {
      createdAt: '2026-07-22T12:00:00Z',
      fileName: 'reviewed.pdf',
      id: crypto.randomUUID(),
      mediaType: 'application/pdf',
      resumeId: crypto.randomUUID(),
      sha256: 'A'.repeat(64),
      sizeBytes: 8,
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify(metadata),
      { headers: { 'Content-Type': 'application/json' }, status: 201 },
    ));

    await expect(saveResumeArtifact(
      metadata.resumeId,
      new Blob(['%PDF-1.7'], { type: 'application/pdf' }),
      metadata.fileName,
    )).resolves.toEqual(metadata);

    const [, request] = fetchMock.mock.calls[0];
    const headers = new Headers(request?.headers);
    expect(request?.body).toBeInstanceOf(FormData);
    expect(headers.get('Content-Type')).toBeNull();
    expect(headers.get('X-ApplyFill-Request')).toBe('1');
    expect(headers.get('Idempotency-Key')).toBeTruthy();
  });
});

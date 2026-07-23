import {
  createAiJobPosting,
  createAiSafeResumeSnapshot,
  createResumeAiPatches,
  parseResumeTailoringOutput,
} from '../local-ai/contracts';
import type { LocalProfileDocument } from '../profile/profileBuilder';
import { parseProfileImportModelOutput, RESUME_IMPORT_MAX_RENDERED_BYTES } from '../profile/resumeImport';
import type { ProfileImportModelOutput } from '../profile/resumeImport';
import type { RenderedResumePage } from '../profile/resumeImport';
import type { LocalResumeDraft } from '../resume/resumeDocument';

const API_ROOT = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export type ResumeTailoringResult = {
  analysis: ReturnType<typeof parseResumeTailoringOutput>['analysis'];
  patches: ReturnType<typeof createResumeAiPatches>;
  relevance: ReturnType<typeof parseResumeTailoringOutput>['relevance'];
  sourceRevision: string;
};

export type ResumeImportProgress = {
  elapsedSeconds: number;
  message: string;
  progress: number;
  stage: string;
};

class PrivateAiServiceError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'PrivateAiServiceError';
    this.status = status;
  }
}

const responseMessage = async (response: Response) => {
  try {
    const body = await response.json() as { detail?: unknown; message?: unknown; title?: unknown };
    return [body.detail, body.message, body.title]
      .find((value): value is string => typeof value === 'string' && Boolean(value.trim()));
  } catch {
    return undefined;
  }
};

const request = async <Result>(path: string, init: RequestInit): Promise<Result> => {
  let response: Response;
  try {
    const method = (init.method ?? 'GET').toUpperCase();
    const isCommand = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    response = await fetch(`${API_ROOT}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
        ...(isCommand ? {
          'Idempotency-Key': globalThis.crypto.randomUUID(),
          'X-ApplyFill-Request': '1',
        } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new PrivateAiServiceError(
      'Private AI is not running. Open Settings and choose Set Up Private AI, then try again.',
    );
  }

  if (!response.ok) {
    const detail = await responseMessage(response);
    if (response.status === 404 || response.status === 503) {
      throw new PrivateAiServiceError(
        detail ?? 'Private AI is not ready. Open Settings and choose Set Up Private AI, then try again.',
        response.status,
      );
    }
    throw new PrivateAiServiceError(detail ?? 'Private AI could not complete this request. Nothing was changed.', response.status);
  }

  if (response.status === 204) return undefined as Result;
  return response.json() as Promise<Result>;
};

export const importResumeWithPrivateAi = async (
  sourceFile: File,
  embeddedTextEvidence: string,
  pages: RenderedResumePage[],
  signal?: AbortSignal,
  onProgress?: (progress: ResumeImportProgress) => void,
): Promise<{ detectedText: string; proposal: ProfileImportModelOutput }> => {
  if (!pages.length) throw new Error('The resume did not contain pages Private AI could read.');
  const renderedBytes = pages.reduce((total, page) => total + page.blob.size, 0);
  if (renderedBytes > RESUME_IMPORT_MAX_RENDERED_BYTES) {
    throw new Error('The prepared resume is too large for Private AI. Try a resume with fewer or smaller pages.');
  }
  const form = new FormData();
  form.append('embeddedTextEvidence', embeddedTextEvidence);
  const extension = sourceFile.name.toLowerCase().split('.').at(-1);
  const sourceKind = extension === 'pdf' || extension === 'docx' || extension === 'txt' ? extension : 'unknown';
  form.append('sourceKind', sourceKind);
  for (const page of pages) {
    form.append('pages', page.blob, `page-${String(page.pageNumber).padStart(3, '0')}.jpg`);
    form.append('pageNumbers', String(page.pageNumber));
  }
  let response: Response;
  try {
    response = await fetch(`${API_ROOT}/api/private-ai/resume-import`, {
      body: form,
      credentials: 'include',
      headers: {
        'Idempotency-Key': globalThis.crypto.randomUUID(),
        'X-ApplyFill-Request': '1',
      },
      method: 'POST',
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new PrivateAiServiceError(
      'Private AI is not running. Open Settings and choose Set Up Private AI, then try again.',
    );
  }

  if (!response.ok) {
    const detail = await responseMessage(response);
    throw new PrivateAiServiceError(
      detail ?? 'Private AI could not begin reading this resume. Nothing was changed.',
      response.status,
    );
  }
  if (!response.body) {
    throw new Error('Private AI did not provide resume-reading progress. Nothing was changed.');
  }

  const resultBox: { current: { detectedText: unknown; proposal: unknown } | null } = { current: null };
  let buffer = '';
  const readEvent = (line: string) => {
    if (!line.trim()) return;
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      throw new Error('Private AI returned an invalid resume-import response. Nothing was changed.');
    }
    if (typeof event !== 'object' || event === null || !('type' in event)) {
      throw new Error('Private AI returned an invalid resume-import response. Nothing was changed.');
    }
    const record = event as Record<string, unknown>;
    if (record.type === 'progress') {
      if (typeof record.stage !== 'string' || typeof record.message !== 'string'
        || typeof record.progress !== 'number' || record.progress < 0 || record.progress > 100
        || typeof record.elapsedSeconds !== 'number' || record.elapsedSeconds < 0) {
        throw new Error('Private AI returned invalid resume-reading progress. Nothing was changed.');
      }
      onProgress?.({
        elapsedSeconds: Math.floor(record.elapsedSeconds),
        message: record.message,
        progress: Math.round(record.progress),
        stage: record.stage,
      });
      return;
    }
    if (record.type === 'error') {
      throw new Error(typeof record.message === 'string'
        ? record.message
        : 'Private AI could not finish reading this resume. Nothing was changed.');
    }
    if (record.type === 'result' && 'proposal' in record && 'detectedText' in record) {
      resultBox.current = { detectedText: record.detectedText, proposal: record.proposal };
      return;
    }
    throw new Error('Private AI returned an invalid resume-import response. Nothing was changed.');
  };

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    lines.forEach(readEvent);
    if (done) break;
  }
  readEvent(buffer);

  if (!resultBox.current) {
    throw new Error('Private AI stopped before the resume was ready. Nothing was changed.');
  }
  const { detectedText, proposal } = resultBox.current;
  if (typeof detectedText !== 'string' || detectedText.length > 100_000) {
    throw new Error('Private AI returned invalid detected text. Nothing was changed.');
  }
  return { detectedText, proposal: parseProfileImportModelOutput(proposal) };
};

export const tailorResumeWithPrivateAi = async (
  profile: LocalProfileDocument,
  resume: LocalResumeDraft,
  jobText: string,
  signal?: AbortSignal,
): Promise<ResumeTailoringResult> => {
  const snapshot = createAiSafeResumeSnapshot(profile, resume);
  const jobPosting = createAiJobPosting(jobText);
  const allowedIds = new Set([
    ...snapshot.experience,
    ...snapshot.projects,
    ...snapshot.education,
    ...snapshot.skills,
  ].map((item) => item.opaqueId));
  const response = await request<unknown>('/api/private-ai/resume-tailoring', {
    body: JSON.stringify({ jobPosting, resumeSnapshot: snapshot }),
    method: 'POST',
    signal,
  });
  const candidate = typeof response === 'object' && response !== null && 'proposal' in response
    ? (response as { proposal: unknown }).proposal
    : response;
  const output = parseResumeTailoringOutput(candidate, allowedIds);
  return {
    analysis: output.analysis,
    patches: createResumeAiPatches(output, snapshot),
    relevance: output.relevance,
    sourceRevision: snapshot.sourceRevision,
  };
};

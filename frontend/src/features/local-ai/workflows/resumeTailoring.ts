import type { LocalAiRuntime, RuntimeProgress } from '../runtime/types';
import { localAiRuntime } from '../runtime';
import { loadDeployedModelManifest } from '../models/catalog';
import {
  createAiJobPosting,
  createAiSafeResumeSnapshot,
  createResumeAiPatches,
  createResumeTailoringPrompt,
  parseJsonOutput,
  parseResumeTailoringOutput
} from '../contracts';
import type { LocalProfileDocument } from '../../profile/profileBuilder';
import type { LocalResumeDraft } from '../../resume/resumeDocument';

const stringArraySchema = { type: 'array', items: { type: 'string' } };

const createTailoringResponseTool = (allowedIds: string[]) => {
  const evidence = {
    type: 'object',
    required: ['opaqueId', 'note'],
    properties: {
      opaqueId: { type: 'string', enum: allowedIds },
      note: { type: 'string' }
    }
  };
  const suggestion = {
    type: 'object',
    required: ['before', 'after', 'confidence', 'evidence'],
    properties: {
      before: { type: 'string' },
      after: { type: 'string' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      evidence: { type: 'array', items: evidence }
    }
  };
  return {
    name: 'return_resume_tailoring',
    description: 'Return the validated, data-only resume tailoring response. This envelope is not executed.',
    inputSchema: {
      type: 'object',
      required: ['analysis', 'relevance', 'summaries', 'bullets'],
      properties: {
        analysis: {
          type: 'object',
          required: ['employer', 'role', 'responsibilities', 'requiredSkills', 'preferredSkills', 'keywords'],
          properties: {
            employer: { type: 'string' },
            role: { type: 'string' },
            responsibilities: stringArraySchema,
            requiredSkills: stringArraySchema,
            preferredSkills: stringArraySchema,
            keywords: stringArraySchema
          }
        },
        relevance: {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                required: ['opaqueId', 'score', 'reason'],
                properties: {
                  opaqueId: { type: 'string', enum: allowedIds },
                  score: { type: 'number' },
                  reason: { type: 'string' }
                }
              }
            }
          }
        },
        summaries: {
          type: 'object',
          required: ['suggestions'],
          properties: {
            suggestions: { type: 'array', items: suggestion }
          }
        },
        bullets: {
          type: 'object',
          required: ['suggestions'],
          properties: {
            suggestions: {
              type: 'array',
              items: {
                type: 'object',
                required: ['before', 'after', 'confidence', 'evidence'],
                properties: suggestion.properties
              }
            }
          }
        }
      }
    }
  };
};

export type ResumeTailoringResult = {
  analysis: ReturnType<typeof parseResumeTailoringOutput>['analysis'];
  patches: ReturnType<typeof createResumeAiPatches>;
  relevance: ReturnType<typeof parseResumeTailoringOutput>['relevance'];
  sourceRevision: string;
};

export const runResumeTailoringWorkflow = async (
  runtime: LocalAiRuntime,
  profile: LocalProfileDocument,
  resume: LocalResumeDraft,
  jobText: string,
  options: { signal?: AbortSignal; onProgress?: (progress: RuntimeProgress | { message: string; phase: 'generating' }) => void } = {}
): Promise<ResumeTailoringResult> => {
  if (runtime === localAiRuntime) {
    const manifest = await loadDeployedModelManifest(options.signal);
    const activeModel = manifest.models.find((model) => model.id === runtime.snapshot.diagnostics.modelId);
    if (!activeModel?.approvedTasks.includes('resume-tailoring-draft')) {
      throw new Error('The active local model is provisional and is not approved for resume tailoring. Run evaluation from Settings first.');
    }
  }
  const snapshot = createAiSafeResumeSnapshot(profile, resume);
  const posting = createAiJobPosting(jobText);
  const approvedIds = new Set([
    ...snapshot.experience, ...snapshot.projects, ...snapshot.education, ...snapshot.skills
  ].map((item) => item.opaqueId));
  options.onProgress?.({ message: 'Analyzing the approved local snapshot…', phase: 'generating' });
  const result = await runtime.generate({
    input: createResumeTailoringPrompt(snapshot, posting),
    maxOutputTokens: 4_096,
    tools: [createTailoringResponseTool([...approvedIds])],
    onToken: () => undefined,
    signal: options.signal
  });
  if (result.finishReason === 'cancelled') throw new DOMException('Local AI generation was cancelled.', 'AbortError');
  if (result.toolCalls.length > 1 || (result.toolCalls[0] && result.toolCalls[0].name !== 'return_resume_tailoring')) {
    throw new Error('The resume workflow does not permit model-initiated tools.');
  }
  const responseCall = result.toolCalls[0];
  let rawOutput: unknown;
  if (responseCall) {
    const keys = Object.keys(responseCall.arguments).sort();
    const expectedKeys = ['analysis', 'bullets', 'relevance', 'summaries'];
    if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
      throw new Error('The structured tailoring response contained unexpected sections. Nothing was changed.');
    }
    const canonicalSection = (value: unknown, format: string): unknown => (
      typeof value === 'object' && value !== null && !Array.isArray(value)
        ? { ...value, format, schemaVersion: 1 }
        : value
    );
    const canonicalSuggestions = (
      value: unknown,
      format: string,
      kind: 'bullet' | 'summary'
    ): unknown => {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
      const section = value as Record<string, unknown>;
      if (!Array.isArray(section.suggestions)) return canonicalSection(value, format);
      return {
        ...section,
        format,
        schemaVersion: 1,
        suggestions: section.suggestions.map((item, index) => {
          if (typeof item !== 'object' || item === null || Array.isArray(item)) return item;
          const suggestion = item as Record<string, unknown>;
          const sources = [
            ...snapshot.experience.map((source) => ({ content: source.accomplishments, opaqueId: source.opaqueId })),
            ...snapshot.projects.map((source) => ({ content: source.details, opaqueId: source.opaqueId }))
          ];
          const matchedSources = typeof suggestion.before === 'string'
            ? sources.filter((source) => source.content.includes(suggestion.before as string))
            : [];
          const matchedSourceId = matchedSources.length === 1 ? matchedSources[0].opaqueId : undefined;
          const modelEvidence = Array.isArray(suggestion.evidence)
            ? suggestion.evidence.filter((entry): entry is Record<string, unknown> => (
                typeof entry === 'object' && entry !== null && !Array.isArray(entry)
                && typeof entry.opaqueId === 'string' && approvedIds.has(entry.opaqueId)
                && typeof entry.note === 'string' && entry.note.length <= 500
              ))
            : [];
          return kind === 'bullet'
            ? {
                ...suggestion,
                evidence: matchedSourceId
                  ? [
                      { note: 'Exact source text matched by the client.', opaqueId: matchedSourceId },
                      ...modelEvidence.filter((entry) => entry.opaqueId !== matchedSourceId)
                    ]
                  : modelEvidence,
                suggestionId: `bullet-${index + 1}`,
                sourceOpaqueId: matchedSourceId
              }
            : { ...suggestion, suggestionId: `summary-${index + 1}` };
        })
      };
    };
    rawOutput = {
      format: 'applyfill.ai.resume-tailoring',
      schemaVersion: 1,
      analysis: canonicalSection(responseCall.arguments.analysis, 'applyfill.ai.job-analysis'),
      bullets: canonicalSuggestions(responseCall.arguments.bullets, 'applyfill.ai.bullet-suggestions', 'bullet'),
      relevance: canonicalSection(responseCall.arguments.relevance, 'applyfill.ai.relevance'),
      summaries: canonicalSuggestions(responseCall.arguments.summaries, 'applyfill.ai.summary-suggestions', 'summary')
    };
  } else {
    rawOutput = parseJsonOutput(result.text);
  }
  const output = parseResumeTailoringOutput(rawOutput, approvedIds);
  return {
    analysis: output.analysis,
    patches: createResumeAiPatches(output, snapshot),
    relevance: output.relevance,
    sourceRevision: snapshot.sourceRevision
  };
};

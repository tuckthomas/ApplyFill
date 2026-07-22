export const AI_OUTPUT_SCHEMA_VERSION = 1 as const;

export type EvidenceReference = { opaqueId: string; note: string };
export type JobAnalysisOutput = {
  employer: string;
  format: 'applyfill.ai.job-analysis';
  keywords: string[];
  preferredSkills: string[];
  requiredSkills: string[];
  responsibilities: string[];
  role: string;
  schemaVersion: typeof AI_OUTPUT_SCHEMA_VERSION;
};
export type RelevanceScore = { opaqueId: string; reason: string; score: number };
export type RelevanceOutput = {
  format: 'applyfill.ai.relevance';
  items: RelevanceScore[];
  schemaVersion: typeof AI_OUTPUT_SCHEMA_VERSION;
};
export type TextSuggestion = {
  after: string;
  before: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: EvidenceReference[];
  suggestionId: string;
};
export type SummarySuggestionsOutput = {
  format: 'applyfill.ai.summary-suggestions';
  schemaVersion: typeof AI_OUTPUT_SCHEMA_VERSION;
  suggestions: TextSuggestion[];
};
export type BulletSuggestion = TextSuggestion & { sourceOpaqueId: string };
export type BulletSuggestionsOutput = {
  format: 'applyfill.ai.bullet-suggestions';
  schemaVersion: typeof AI_OUTPUT_SCHEMA_VERSION;
  suggestions: BulletSuggestion[];
};
export type ResumeTailoringOutput = {
  analysis: JobAnalysisOutput;
  bullets: BulletSuggestionsOutput;
  format: 'applyfill.ai.resume-tailoring';
  relevance: RelevanceOutput;
  schemaVersion: typeof AI_OUTPUT_SCHEMA_VERSION;
  summaries: SummarySuggestionsOutput;
};
export type ApplicationAnswerSuggestion = {
  answer: string | null;
  evidence: EvidenceReference[];
  questionOpaqueId: string;
  uncertainty: string | null;
};
export type ApplicationAnswerSuggestionsOutput = {
  format: 'applyfill.ai.application-answer-suggestions';
  schemaVersion: typeof AI_OUTPUT_SCHEMA_VERSION;
  suggestions: ApplicationAnswerSuggestion[];
};
export type ContentSelectionOutput = {
  format: 'applyfill.ai.content-selection';
  schemaVersion: typeof AI_OUTPUT_SCHEMA_VERSION;
  selectedOpaqueIds: string[];
};

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => typeof value === 'object' && value !== null && !Array.isArray(value);
const exactKeys = (value: RecordValue, keys: string[]) => {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
};
const boundedString = (value: unknown, maximum = 2_000) => typeof value === 'string' && value.length <= maximum;
const stringArray = (value: unknown, maximumCount = 40, maximumLength = 300) => Array.isArray(value)
  && value.length <= maximumCount && value.every((item) => boundedString(item, maximumLength));
const evidence = (value: unknown, allowedIds: Set<string>): value is EvidenceReference => record(value)
  && exactKeys(value, ['note', 'opaqueId'])
  && boundedString(value.opaqueId, 100) && allowedIds.has(value.opaqueId as string)
  && boundedString(value.note, 500);

export const parseJobAnalysisOutput = (value: unknown): JobAnalysisOutput => {
  if (!record(value) || !exactKeys(value, ['employer', 'format', 'keywords', 'preferredSkills', 'requiredSkills', 'responsibilities', 'role', 'schemaVersion'])
    || value.format !== 'applyfill.ai.job-analysis' || value.schemaVersion !== AI_OUTPUT_SCHEMA_VERSION
    || !boundedString(value.employer, 300) || !boundedString(value.role, 300)
    || !stringArray(value.keywords) || !stringArray(value.preferredSkills)
    || !stringArray(value.requiredSkills) || !stringArray(value.responsibilities)) {
    throw new Error('Local AI returned an invalid job analysis. Nothing was changed.');
  }
  return value as JobAnalysisOutput;
};

export const parseRelevanceOutput = (value: unknown, allowedIds: Set<string>): RelevanceOutput => {
  if (!record(value) || !exactKeys(value, ['format', 'items', 'schemaVersion'])
    || value.format !== 'applyfill.ai.relevance' || value.schemaVersion !== AI_OUTPUT_SCHEMA_VERSION
    || !Array.isArray(value.items) || value.items.length > 100
    || !value.items.every((item) => record(item) && exactKeys(item, ['opaqueId', 'reason', 'score'])
      && boundedString(item.opaqueId, 100) && allowedIds.has(item.opaqueId as string)
      && boundedString(item.reason, 500) && typeof item.score === 'number' && item.score >= 0 && item.score <= 1)) {
    throw new Error('Local AI returned invalid relevance scores. Nothing was changed.');
  }
  return value as RelevanceOutput;
};

export const parseContentSelectionOutput = (value: unknown, allowedIds: Set<string>): ContentSelectionOutput => {
  if (!record(value) || !exactKeys(value, ['format', 'schemaVersion', 'selectedOpaqueIds'])
    || value.format !== 'applyfill.ai.content-selection' || value.schemaVersion !== AI_OUTPUT_SCHEMA_VERSION
    || !Array.isArray(value.selectedOpaqueIds) || value.selectedOpaqueIds.length > 100
    || !value.selectedOpaqueIds.every((id) => typeof id === 'string' && allowedIds.has(id))) {
    throw new Error('Local AI returned an invalid content selection. Nothing was changed.');
  }
  return value as ContentSelectionOutput;
};

export const parseApplicationAnswerSuggestionsOutput = (
  value: unknown,
  allowedQuestionIds: Set<string>,
  allowedEvidenceIds: Set<string>
): ApplicationAnswerSuggestionsOutput => {
  if (!record(value) || !exactKeys(value, ['format', 'schemaVersion', 'suggestions'])
    || value.format !== 'applyfill.ai.application-answer-suggestions' || value.schemaVersion !== AI_OUTPUT_SCHEMA_VERSION
    || !Array.isArray(value.suggestions) || value.suggestions.length > 30
    || !value.suggestions.every((item) => record(item)
      && exactKeys(item, ['answer', 'evidence', 'questionOpaqueId', 'uncertainty'])
      && boundedString(item.questionOpaqueId, 100) && allowedQuestionIds.has(item.questionOpaqueId as string)
      && (item.answer === null || boundedString(item.answer, 2_000))
      && (item.uncertainty === null || boundedString(item.uncertainty, 500))
      && Array.isArray(item.evidence) && item.evidence.length <= 20
      && item.evidence.every((entry) => evidence(entry, allowedEvidenceIds)))) {
    throw new Error('Local AI returned invalid application-answer suggestions. Nothing was changed.');
  }
  return value as ApplicationAnswerSuggestionsOutput;
};

const textSuggestion = (value: unknown, allowedIds: Set<string>) => record(value)
  && exactKeys(value, ['after', 'before', 'confidence', 'evidence', 'suggestionId'])
  && boundedString(value.suggestionId, 100) && boundedString(value.before) && boundedString(value.after)
  && ['high', 'medium', 'low'].includes(value.confidence as string)
  && Array.isArray(value.evidence) && value.evidence.length <= 20
  && value.evidence.every((item) => evidence(item, allowedIds));

export const parseSummarySuggestionsOutput = (value: unknown, allowedIds: Set<string>): SummarySuggestionsOutput => {
  if (!record(value) || !exactKeys(value, ['format', 'schemaVersion', 'suggestions'])
    || value.format !== 'applyfill.ai.summary-suggestions' || value.schemaVersion !== AI_OUTPUT_SCHEMA_VERSION
    || !Array.isArray(value.suggestions) || value.suggestions.length > 5
    || !value.suggestions.every((item) => textSuggestion(item, allowedIds))) {
    throw new Error('Local AI returned invalid summary suggestions. Nothing was changed.');
  }
  return value as SummarySuggestionsOutput;
};

export const parseBulletSuggestionsOutput = (value: unknown, allowedIds: Set<string>): BulletSuggestionsOutput => {
  if (!record(value) || !exactKeys(value, ['format', 'schemaVersion', 'suggestions'])
    || value.format !== 'applyfill.ai.bullet-suggestions' || value.schemaVersion !== AI_OUTPUT_SCHEMA_VERSION
    || !Array.isArray(value.suggestions) || value.suggestions.length > 30
    || !value.suggestions.every((item) => record(item)
      && exactKeys(item, ['after', 'before', 'confidence', 'evidence', 'sourceOpaqueId', 'suggestionId'])
      && boundedString(item.sourceOpaqueId, 100) && allowedIds.has(item.sourceOpaqueId as string)
      && textSuggestion(Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'sourceOpaqueId')), allowedIds))) {
    const shape = record(value)
      ? `keys: ${Object.keys(value).sort().join(', ') || 'none'}; suggestions: ${Array.isArray(value.suggestions) ? value.suggestions.length : typeof value.suggestions}; first suggestion keys: ${Array.isArray(value.suggestions) && record(value.suggestions[0]) ? Object.keys(value.suggestions[0]).sort().join(', ') : 'none'}`
      : `value type: ${Array.isArray(value) ? 'array' : typeof value}`;
    throw new Error(`Local AI returned invalid bullet suggestions (${shape}). Nothing was changed.`);
  }
  return value as BulletSuggestionsOutput;
};

export const parseResumeTailoringOutput = (value: unknown, allowedIds: Set<string>): ResumeTailoringOutput => {
  if (!record(value) || !exactKeys(value, ['analysis', 'bullets', 'format', 'relevance', 'schemaVersion', 'summaries'])
    || value.format !== 'applyfill.ai.resume-tailoring' || value.schemaVersion !== AI_OUTPUT_SCHEMA_VERSION) {
    const shape = record(value)
      ? `keys: ${Object.keys(value).sort().join(', ') || 'none'}; format: ${String(value.format)}; schemaVersion: ${String(value.schemaVersion)}`
      : `value type: ${Array.isArray(value) ? 'array' : typeof value}`;
    throw new Error(`Local AI returned an invalid tailoring proposal (${shape}). Nothing was changed.`);
  }
  return {
    analysis: parseJobAnalysisOutput(value.analysis),
    bullets: parseBulletSuggestionsOutput(value.bullets, allowedIds),
    format: value.format,
    relevance: parseRelevanceOutput(value.relevance, allowedIds),
    schemaVersion: value.schemaVersion,
    summaries: parseSummarySuggestionsOutput(value.summaries, allowedIds)
  };
};

export const parseJsonOutput = (value: string): unknown => {
  if (value.length > 100_000) throw new Error('Local AI returned too much data. Nothing was changed.');
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error('Local AI returned invalid JSON. Nothing was changed.');
  }
};

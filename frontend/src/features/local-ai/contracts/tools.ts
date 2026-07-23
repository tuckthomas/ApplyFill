export const AI_TOOL_SCHEMA_VERSION = 1 as const;
export const AI_TOOL_LIMITS = { maximumCalls: 8, maximumDurationMs: 30_000, maximumRecursion: 0 } as const;

export type AiToolName = 'score_resume_relevance' | 'rewrite_resume_text';
export type AiToolCall = {
  arguments: Record<string, unknown>;
  name: AiToolName;
  schemaVersion: typeof AI_TOOL_SCHEMA_VERSION;
};

const allowedKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every((key) => keys.includes(key));
const freezeNested = (value: unknown): void => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return;
  Object.values(value as Record<string, unknown>).forEach(freezeNested);
  Object.freeze(value);
};
const deepFreeze = (value: unknown): Readonly<Record<string, unknown>> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Private AI tool snapshot.');
  freezeNested(value);
  return value as Readonly<Record<string, unknown>>;
};

export const validateAiToolCall = (value: unknown, allowedOpaqueIds: Set<string>): AiToolCall => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Private AI tool call.');
  const call = value as Record<string, unknown>;
  if (!allowedKeys(call, ['arguments', 'name', 'schemaVersion']) || call.schemaVersion !== AI_TOOL_SCHEMA_VERSION
    || (call.name !== 'score_resume_relevance' && call.name !== 'rewrite_resume_text')
    || !call.arguments || typeof call.arguments !== 'object' || Array.isArray(call.arguments)) {
    throw new Error('Unknown or invalid Private AI tool call.');
  }
  const args = call.arguments as Record<string, unknown>;
  if (!allowedKeys(args, ['opaqueIds', 'sourceOpaqueId', 'text'])) throw new Error('Invalid Private AI tool arguments.');
  if ('sourceOpaqueId' in args && (typeof args.sourceOpaqueId !== 'string' || !allowedOpaqueIds.has(args.sourceOpaqueId))) {
    throw new Error('Private AI referenced content outside the approved snapshot.');
  }
  if ('opaqueIds' in args && (!Array.isArray(args.opaqueIds) || args.opaqueIds.length > 100
    || !args.opaqueIds.every((id) => typeof id === 'string' && allowedOpaqueIds.has(id)))) {
    throw new Error('Private AI requested content outside the approved snapshot.');
  }
  if ('text' in args && (typeof args.text !== 'string' || args.text.length > 2_000)) throw new Error('Private AI tool text is invalid.');
  return call as AiToolCall;
};

export const executeAiToolCalls = async <Result>(
  calls: unknown[],
  allowedOpaqueIds: Set<string>,
  execute: (call: AiToolCall, immutableSnapshot: Readonly<unknown>) => Promise<Result>,
  snapshot: unknown,
  signal?: AbortSignal
): Promise<Result[]> => {
  if (calls.length > AI_TOOL_LIMITS.maximumCalls) throw new Error('Private AI requested too many tool calls.');
  const frozenSnapshot = deepFreeze(structuredClone(snapshot));
  const timeout = AbortSignal.timeout(AI_TOOL_LIMITS.maximumDurationMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const results: Result[] = [];
  for (const value of calls) {
    if (combined.aborted) throw new DOMException('Private AI tool execution was cancelled.', 'AbortError');
    results.push(await execute(validateAiToolCall(value, allowedOpaqueIds), frozenSnapshot));
  }
  return results;
};

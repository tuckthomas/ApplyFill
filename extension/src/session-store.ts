import {
  MAX_MESSAGE_BYTES,
  MAX_TEXT_LENGTH,
  SESSION_TTL_MS,
  type AutofillData,
  type CompletionReport,
  type FieldDescriptor,
  type FillSelection,
  type ReviewItem,
  type ScopedValue,
  type MappingProposal,
  type ValidationResult,
  byteLength,
  isSensitiveSemantic,
} from './contracts';
import { buildReviewItems, createModelSafeDescriptors } from './mapping';

export interface SessionView {
  targetTabId: number;
  expiresAt: number;
  fields: FieldDescriptor[];
  reviewItems: ReviewItem[];
  connectedOrigin: string;
}

interface AutofillSession extends SessionView {
  data: AutofillData;
}

export interface ApprovedFill {
  selections: FillSelection[];
  reviewByFieldId: Map<string, ReviewItem>;
}

export interface SessionInspection {
  targetTabId: number;
  expiresAt: number;
  fields: FieldDescriptor[];
}

type Clock = () => number;

export class SessionStore {
  readonly #sessions = new Map<number, AutofillSession>();

  constructor(private readonly clock: Clock = Date.now) {}

  createFromPairedProfile(
    targetTabId: number,
    fields: FieldDescriptor[],
    values: ScopedValue[],
    connectedOrigin: string,
  ): SessionView {
    this.clear(targetTabId);
    const data: AutofillData = { values: structuredClone(values), proposals: [] };
    const session: AutofillSession = {
      targetTabId,
      expiresAt: this.clock() + SESSION_TTL_MS,
      fields: structuredClone(fields),
      reviewItems: buildReviewItems(fields, data),
      connectedOrigin,
      data,
    };
    this.#sessions.set(targetTabId, session);
    return this.toView(session);
  }

  inspectPaired(targetTabId: number): ValidationResult<SessionInspection> {
    const session = this.liveSession(targetTabId);
    if (!session) return { ok: false, error: 'No active paired application review exists.' };
    const fields = createModelSafeDescriptors(session.fields);
    const response = { targetTabId, expiresAt: session.expiresAt, fields };
    if (byteLength(response) > MAX_MESSAGE_BYTES) {
      return { ok: false, error: 'Safe field descriptors exceed the 64 KiB inspection limit.' };
    }
    return { ok: true, value: structuredClone(response) };
  }

  attachPairedAiSuggestions(
    targetTabId: number,
    values: ScopedValue[],
    proposals: MappingProposal[],
  ): ValidationResult<SessionView> {
    const session = this.liveSession(targetTabId);
    if (!session) return { ok: false, error: 'No active paired application review exists.' };
    const mergedValues = [...session.data.values, ...structuredClone(values)];
    const sourceKeys = new Set(mergedValues.map((value) => value.sourceKey));
    if (sourceKeys.size !== mergedValues.length || proposals.some((proposal) => !sourceKeys.has(proposal.sourceKey))) {
      return { ok: false, error: 'Local AI suggestions reference invalid profile values.' };
    }
    session.data = { values: mergedValues, proposals: structuredClone(proposals) };
    session.reviewItems = buildReviewItems(session.fields, session.data);
    return { ok: true, value: this.toView(session) };
  }

  get(targetTabId: number): SessionView | undefined {
    const session = this.liveSession(targetTabId);
    return session ? this.toView(session) : undefined;
  }

  approveFill(
    targetTabId: number,
    selections: FillSelection[],
    sensitiveConfirmations: string[],
  ): ValidationResult<ApprovedFill> {
    const session = this.liveSession(targetTabId);
    if (!session) return { ok: false, error: 'No active paired application review exists.' };
    if (selections.length > session.fields.length) return { ok: false, error: 'Too many selections.' };

    const reviewByFieldId = new Map(session.reviewItems.map((item) => [item.field.id, item]));
    const confirmations = new Set(sensitiveConfirmations);
    const seen = new Set<string>();
    const approved: FillSelection[] = [];

    for (const selection of selections) {
      if (seen.has(selection.fieldId)) return { ok: false, error: 'Duplicate field selection.' };
      seen.add(selection.fieldId);
      const review = reviewByFieldId.get(selection.fieldId);
      if (!review) return { ok: false, error: 'Unknown field selection.' };
      if (typeof selection.value !== 'string' || selection.value.length > MAX_TEXT_LENGTH) {
        return { ok: false, error: 'Invalid fill value.' };
      }
      if (review.classification === 'unsupported' || review.classification === 'manual') {
        approved.push({ ...selection, selected: false, classification: review.classification });
        continue;
      }
      if (isSensitiveSemantic(review.semantic)) {
        if (!confirmations.has(review.field.id)) return { ok: false, error: 'Each sensitive field requires immediate confirmation.' };
        if (selection.value !== review.proposedValue) return { ok: false, error: 'Sensitive values cannot be edited in the extension.' };
      }
      approved.push({ ...selection, classification: review.classification });
    }

    return { ok: true, value: { selections: approved, reviewByFieldId } };
  }

  complete(targetTabId: number, report: CompletionReport): CompletionReport {
    this.clear(targetTabId);
    return report;
  }

  clear(targetTabId: number): void {
    this.#sessions.delete(targetTabId);
  }

  clearByAnyTab(tabId: number): void {
    this.clear(tabId);
  }

  clearExpired(): void {
    for (const session of this.#sessions.values()) {
      if (session.expiresAt <= this.clock()) this.clear(session.targetTabId);
    }
  }

  clearAll(): void {
    this.#sessions.clear();
  }

  get size(): number {
    this.clearExpired();
    return this.#sessions.size;
  }

  private liveSession(targetTabId: number): AutofillSession | undefined {
    const session = this.#sessions.get(targetTabId);
    if (session && session.expiresAt <= this.clock()) {
      this.clear(targetTabId);
      return undefined;
    }
    return session;
  }

  private toView(session: AutofillSession): SessionView {
    return structuredClone({
      targetTabId: session.targetTabId,
      expiresAt: session.expiresAt,
      fields: session.fields,
      reviewItems: session.reviewItems,
      connectedOrigin: session.connectedOrigin,
    });
  }
}

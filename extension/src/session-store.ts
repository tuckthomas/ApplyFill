import {
  MAX_TEXT_LENGTH,
  MAX_MESSAGE_BYTES,
  SESSION_TTL_MS,
  type CompletionReport,
  type FieldDescriptor,
  type FillSelection,
  type HandoffRequest,
  type ReviewItem,
  type SelectedDocument,
  type ValidationResult,
  isSensitiveSemantic,
  byteLength,
} from './contracts';
import { buildReviewItems, createModelSafeDescriptors } from './mapping';

export interface SessionView {
  targetTabId: number;
  nonce?: string;
  expiresAt: number;
  fields: FieldDescriptor[];
  reviewItems?: ReviewItem[];
  connectedOrigin?: string;
  selectedDocument?: SelectedDocument;
}

interface AutofillSession extends SessionView {
  nonce: string;
  nonceConsumed: boolean;
  sourceTabId?: number;
  sourceOrigin?: string;
  handoff?: HandoffRequest;
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
type NonceFactory = () => string;

const defaultNonce = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
};

export class SessionStore {
  readonly #sessions = new Map<number, AutofillSession>();

  constructor(
    private readonly clock: Clock = Date.now,
    private readonly createNonce: NonceFactory = defaultNonce,
  ) {}

  create(targetTabId: number, fields: FieldDescriptor[]): SessionView {
    this.clear(targetTabId);
    const session: AutofillSession = {
      targetTabId,
      nonce: this.createNonce(),
      nonceConsumed: false,
      expiresAt: this.clock() + SESSION_TTL_MS,
      fields: structuredClone(fields),
    };
    this.#sessions.set(targetTabId, session);
    return this.toView(session);
  }

  get(targetTabId: number): SessionView | undefined {
    const session = this.liveSession(targetTabId);
    return session ? this.toView(session) : undefined;
  }

  attach(handoff: HandoffRequest, origin: string, sourceTabId: number): ValidationResult<SessionView> {
    const session = this.liveSession(handoff.targetTabId);
    if (!session) return { ok: false, error: 'No active user-started session for that tab.' };
    if (session.sourceOrigin !== origin || session.sourceTabId !== sourceTabId) {
      return { ok: false, error: 'Inspect this session from the same ApplyFill tab before handoff.' };
    }
    if (session.nonceConsumed || session.nonce !== handoff.nonce) return { ok: false, error: 'One-time code is invalid or already used.' };
    if (handoff.expiresAt > session.expiresAt) return { ok: false, error: 'Handoff outlives the active session.' };

    session.nonceConsumed = true;
    session.sourceTabId = sourceTabId;
    session.connectedOrigin = origin;
    session.handoff = structuredClone(handoff);
    session.selectedDocument = handoff.selectedDocument ? structuredClone(handoff.selectedDocument) : undefined;
    session.reviewItems = buildReviewItems(session.fields, handoff);
    return { ok: true, value: this.toView(session) };
  }

  inspect(targetTabId: number, origin: string, sourceTabId: number, nonce: string): ValidationResult<SessionInspection> {
    const session = this.liveSession(targetTabId);
    if (!session || session.nonceConsumed || session.nonce !== nonce) {
      return { ok: false, error: 'One-time code is invalid, expired, or already used.' };
    }
    if ((session.sourceOrigin && session.sourceOrigin !== origin)
      || (session.sourceTabId !== undefined && session.sourceTabId !== sourceTabId)) {
      return { ok: false, error: 'This session is already bound to another ApplyFill tab.' };
    }
    const fields = createModelSafeDescriptors(session.fields);
    const response = { targetTabId, expiresAt: session.expiresAt, fields };
    if (byteLength(response) > MAX_MESSAGE_BYTES) {
      return { ok: false, error: 'Safe field descriptors exceed the 64 KiB inspection limit.' };
    }
    session.sourceOrigin = origin;
    session.sourceTabId = sourceTabId;
    return { ok: true, value: structuredClone(response) };
  }

  disconnectFromSource(targetTabId: number, origin: string, sourceTabId: number, nonce: string): ValidationResult<true> {
    const session = this.liveSession(targetTabId);
    if (!session
      || session.sourceOrigin !== origin
      || session.sourceTabId !== sourceTabId
      || session.nonce !== nonce) {
      return { ok: false, error: 'No matching connected session.' };
    }
    this.clear(targetTabId);
    return { ok: true, value: true };
  }

  approveFill(
    targetTabId: number,
    selections: FillSelection[],
    sensitiveConfirmations: string[],
  ): ValidationResult<ApprovedFill> {
    const session = this.liveSession(targetTabId);
    if (!session?.handoff || !session.reviewItems) return { ok: false, error: 'No connected handoff exists.' };
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
    const session = this.#sessions.get(targetTabId);
    if (session) {
      session.handoff = undefined;
      session.reviewItems = undefined;
      session.nonce = '';
    }
    this.#sessions.delete(targetTabId);
  }

  clearByAnyTab(tabId: number): void {
    for (const session of this.#sessions.values()) {
      if (session.targetTabId === tabId || session.sourceTabId === tabId) this.clear(session.targetTabId);
    }
  }

  clearExpired(): void {
    for (const session of this.#sessions.values()) {
      if (session.expiresAt <= this.clock()) this.clear(session.targetTabId);
    }
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
      nonce: session.nonceConsumed ? undefined : session.nonce,
      expiresAt: session.expiresAt,
      fields: session.fields,
      reviewItems: session.reviewItems,
      connectedOrigin: session.connectedOrigin,
      selectedDocument: session.selectedDocument,
    });
  }
}

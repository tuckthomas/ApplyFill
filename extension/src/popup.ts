import {
  type CompletionReport,
  type FillSelection,
  type ReviewItem,
  isSensitiveSemantic,
} from './contracts';
import type { SessionView } from './session-store';
import { reviewInputType } from './review-policy';

type BackgroundResponse = {
  ok: boolean;
  error?: string;
  session?: SessionView;
  report?: CompletionReport;
};

const element = <T extends HTMLElement>(id: string): T => {
  const result = document.getElementById(id);
  if (!result) throw new Error(`Missing popup element: ${id}`);
  return result as T;
};

const status = element<HTMLParagraphElement>('status');
const startPanel = element<HTMLElement>('start-panel');
const connectionPanel = element<HTMLElement>('connection-panel');
const reviewPanel = element<HTMLElement>('review-panel');
const reportPanel = element<HTMLElement>('report-panel');
const reviewList = element<HTMLDivElement>('review-list');
const sensitiveDialog = element<HTMLDialogElement>('sensitive-dialog');
const sensitiveConfirmations = element<HTMLDivElement>('sensitive-confirmations');
const confirmFill = element<HTMLButtonElement>('confirm-fill');

let targetTabId: number | undefined;
let currentSession: SessionView | undefined;
let pollingId: number | undefined;
const selectionState = new Map<string, FillSelection>();

function setStatus(message: string): void {
  status.textContent = message;
}

async function send<T extends BackgroundResponse>(message: unknown): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

function setPanels(panel: 'start' | 'connection' | 'review' | 'report'): void {
  startPanel.hidden = panel !== 'start';
  connectionPanel.hidden = panel !== 'connection';
  reviewPanel.hidden = panel !== 'review';
  reportPanel.hidden = panel !== 'report';
}

function sourceLabel(item: ReviewItem): string {
  switch (item.classification) {
    case 'deterministic': return 'Deterministic';
    case 'model-suggested': return 'Local AI suggestion';
    case 'sensitive-confirmation-required': return 'Sensitive · confirmation required';
    case 'unsupported': return 'Unsupported';
    case 'manual': return 'Manual';
  }
}

function renderReview(items: ReviewItem[]): void {
  reviewList.replaceChildren();
  selectionState.clear();
  for (const item of items) {
    const card = document.createElement('article');
    card.className = 'review-card';
    const header = document.createElement('header');
    const selected = document.createElement('input');
    selected.type = 'checkbox';
    selected.setAttribute('aria-label', `Fill ${item.field.label}`);
    selected.checked = item.proposedValue !== undefined
      && item.classification !== 'manual'
      && item.classification !== 'unsupported';
    selected.disabled = item.classification === 'unsupported';
    const label = document.createElement('label');
    label.textContent = item.field.label;
    header.append(selected, label);

    const meta = document.createElement('p');
    meta.className = 'review-meta';
    const pill = document.createElement('span');
    pill.className = `source-pill${isSensitiveSemantic(item.semantic) ? ' sensitive-pill' : ''}`;
    pill.textContent = sourceLabel(item);
    meta.append(pill, document.createTextNode(` · ${Math.round(item.confidence * 100)}% confidence`));

    const reason = document.createElement('p');
    reason.className = 'review-meta';
    reason.textContent = item.reason;
    card.append(header, meta, reason);

    const state: FillSelection = {
      fieldId: item.field.id,
      value: item.proposedValue ?? '',
      selected: selected.checked,
      classification: item.classification,
    };
    selectionState.set(item.field.id, state);
    selected.addEventListener('change', () => { state.selected = selected.checked; });

    if (item.classification !== 'unsupported') {
      const valueRow = document.createElement('div');
      valueRow.className = 'value-row';
      const value = document.createElement('input');
      value.value = item.proposedValue ?? '';
      value.type = reviewInputType(item);
      value.autocomplete = 'off';
      value.setAttribute('aria-label', `Proposed value for ${item.field.label}`);
      value.readOnly = isSensitiveSemantic(item.semantic);
      value.addEventListener('input', () => { state.value = value.value; });
      valueRow.append(value);

      if (isSensitiveSemantic(item.semantic)) {
        const reveal = document.createElement('button');
        reveal.type = 'button';
        reveal.className = 'secondary';
        reveal.textContent = 'Reveal';
        reveal.addEventListener('click', () => {
          const revealing = value.type === 'password';
          value.type = revealing ? 'text' : 'password';
          reveal.textContent = revealing ? 'Hide' : 'Reveal';
        });
        valueRow.append(reveal);
      }

      const manual = document.createElement('button');
      manual.type = 'button';
      manual.className = 'secondary';
      manual.textContent = 'Mark manual';
      manual.addEventListener('click', () => {
        state.classification = 'manual';
        state.selected = false;
        selected.checked = false;
        selected.disabled = true;
        value.disabled = true;
        pill.textContent = 'Manual';
      });
      valueRow.append(manual);
      card.append(valueRow);
    }
    reviewList.append(card);
  }
}

function showSession(session: SessionView): void {
  currentSession = session;
  if (session.reviewItems) {
    if (pollingId !== undefined) window.clearInterval(pollingId);
    setPanels('review');
    setStatus(`Connected locally to ${session.connectedOrigin ?? 'ApplyFill'}. Nothing has been inserted yet.`);
    const selectedDocument = element<HTMLParagraphElement>('selected-document');
    selectedDocument.hidden = session.selectedDocument === undefined;
    selectedDocument.textContent = session.selectedDocument
      ? `Selected resume: ${session.selectedDocument.fileName}. Download it from ApplyFill and upload it manually if this page requests a file.`
      : '';
    renderReview(session.reviewItems);
    return;
  }
  setPanels('connection');
  element<HTMLElement>('nonce').textContent = session.nonce ? `${session.targetTabId}.${session.nonce}` : 'Expired';
  element<HTMLElement>('field-summary').textContent = `${session.fields.length} supported or manual-review fields discovered. No field values were collected.`;
  setStatus('Waiting for a scoped, one-time handoff from ApplyFill.');
}

async function refreshSession(): Promise<void> {
  if (targetTabId === undefined) return;
  const response = await send<BackgroundResponse>({ type: 'popup.get-session', tabId: targetTabId });
  if (response.ok && response.session) showSession(response.session);
}

async function start(): Promise<void> {
  if (targetTabId === undefined) return;
  setStatus('Inspecting semantic form controls on this tab…');
  const response = await send<BackgroundResponse>({ type: 'popup.start', tabId: targetTabId });
  if (!response.ok || !response.session) {
    setStatus(response.error ?? 'This page could not be inspected.');
    return;
  }
  showSession(response.session);
  pollingId = window.setInterval(() => { void refreshSession(); }, 750);
}

function openSensitiveConfirmation(): boolean {
  sensitiveConfirmations.replaceChildren();
  const sensitive = [...selectionState.values()].filter((selection) => {
    const item = currentSession?.reviewItems?.find((candidate) => candidate.field.id === selection.fieldId);
    return selection.selected && isSensitiveSemantic(item?.semantic);
  });
  if (sensitive.length === 0) return false;
  for (const selection of sensitive) {
    const item = currentSession?.reviewItems?.find((candidate) => candidate.field.id === selection.fieldId);
    const label = document.createElement('label');
    label.className = 'confirmation';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.fieldId = selection.fieldId;
    label.append(checkbox, document.createTextNode(` Insert the stored value into “${item?.field.label ?? 'sensitive field'}”`));
    sensitiveConfirmations.append(label);
  }
  sensitiveDialog.showModal();
  return true;
}

async function performFill(sensitiveFieldIds: string[]): Promise<void> {
  if (targetTabId === undefined) return;
  element<HTMLButtonElement>('fill').disabled = true;
  setStatus('Filling the approved fields locally…');
  const response = await send<BackgroundResponse>({
    type: 'popup.fill',
    tabId: targetTabId,
    selections: [...selectionState.values()],
    sensitiveConfirmations: sensitiveFieldIds,
  });
  element<HTMLButtonElement>('fill').disabled = false;
  if (!response.ok || !response.report) {
    setStatus(response.error ?? 'The page could not be filled.');
    return;
  }
  setPanels('report');
  const report = element<HTMLDivElement>('report');
  const list = document.createElement('ul');
  list.className = 'report-list';
  for (const result of response.report.results) {
    const item = document.createElement('li');
    item.textContent = `${result.label}: ${result.status}${result.detail ? ` — ${result.detail}` : ''}`;
    list.append(item);
  }
  report.replaceChildren(list);
  setStatus('Fill attempt complete. The in-memory handoff has been destroyed.');
}

element<HTMLButtonElement>('start').addEventListener('click', () => { void start(); });
element<HTMLButtonElement>('copy-nonce').addEventListener('click', () => {
  const nonce = currentSession?.nonce;
  if (nonce) void navigator.clipboard.writeText(nonce).then(() => setStatus('One-time code copied.'));
});
element<HTMLButtonElement>('cancel').addEventListener('click', () => {
  if (targetTabId !== undefined) void send({ type: 'popup.cancel', tabId: targetTabId });
  window.close();
});
element<HTMLButtonElement>('fill').addEventListener('click', () => {
  if (!openSensitiveConfirmation()) void performFill([]);
});
confirmFill.addEventListener('click', (event) => {
  const checkboxes = [...sensitiveConfirmations.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
  if (checkboxes.some((checkbox) => !checkbox.checked)) {
    event.preventDefault();
    setStatus('Confirm each sensitive field or go back and deselect it.');
  }
});
sensitiveDialog.addEventListener('close', () => {
  if (sensitiveDialog.returnValue !== 'default') return;
  const confirmed = [...sensitiveConfirmations.querySelectorAll<HTMLInputElement>('input:checked')]
    .map((checkbox) => checkbox.dataset.fieldId)
    .filter((fieldId): fieldId is string => fieldId !== undefined);
  void performFill(confirmed);
});
element<HTMLButtonElement>('restart').addEventListener('click', () => {
  setPanels('start');
  setStatus('Inspect this tab again to continue after a page or form-step change.');
});

void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  if (tab?.id === undefined || !tab.url || !/^https?:/i.test(tab.url)) {
    setStatus('Open a normal HTTP or HTTPS job-application page first.');
    element<HTMLButtonElement>('start').disabled = true;
    return;
  }
  targetTabId = tab.id;
  return refreshSession();
});

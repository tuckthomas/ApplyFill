import {
  PAIRING_PROTOCOL_VERSION,
  type CompletionReport,
  type FillSelection,
  validatePairedAiUpdate,
  validatePairedInspect,
  validatePairingControl,
  validatePairingUpdate,
} from './contracts';
import { PairingStore } from './pairing-store';
import { isApprovedApplyFillOrigin, normalizeSenderOrigin, safeErrorMessage } from './security';
import { SessionStore } from './session-store';

const sessions = new SessionStore();
const pairings = new PairingStore(chrome.storage.local);

type PopupMessage =
  | { type: 'popup.start'; tabId: number }
  | { type: 'popup.get-session'; tabId: number }
  | { type: 'popup.cancel'; tabId: number }
  | { type: 'popup.fill'; tabId: number; selections: FillSelection[]; sensitiveConfirmations: string[] };

const isPopupMessage = (message: unknown): message is PopupMessage => {
  if (typeof message !== 'object' || message === null || !('type' in message)) return false;
  return typeof (message as { type?: unknown }).type === 'string'
    && (message as { type: string }).type.startsWith('popup.');
};

async function discover(tabId: number): Promise<import('./contracts').FieldDescriptor[]> {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  const response = await chrome.tabs.sendMessage(tabId, { type: 'content.discover' }) as { fields?: import('./contracts').FieldDescriptor[] };
  if (!Array.isArray(response?.fields)) throw new Error('Discovery failed.');
  return response.fields;
}

async function fillTab(tabId: number, selections: FillSelection[]): Promise<CompletionReport> {
  const response = await chrome.tabs.sendMessage(tabId, {
    type: 'content.fill',
    selections,
  }) as CompletionReport;
  if (!response || !Array.isArray(response.results) || response.requiresManualReview !== true) {
    throw new Error('Invalid completion report.');
  }
  return response;
}

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (!isPopupMessage(message) || sender.id !== chrome.runtime.id || sender.tab) return false;

  void (async () => {
    try {
      switch (message.type) {
        case 'popup.start': {
          const fields = await discover(message.tabId);
          const pairing = await pairings.current();
          if (!pairing) {
            sendResponse({ ok: false, error: 'Pair this extension once from ApplyFill Settings before using autofill.' });
            break;
          }
          const session = sessions.createFromPairedProfile(message.tabId, fields, pairing.values, pairing.sourceOrigin);
          const assistUrl = new URL('/autofill-assist', pairing.sourceOrigin);
          assistUrl.searchParams.set('extensionId', chrome.runtime.id);
          assistUrl.searchParams.set('targetTabId', String(message.tabId));
          if (session.reviewItems.some((item) => item.classification === 'manual')) {
            void chrome.tabs.create({ url: assistUrl.toString(), active: false });
          }
          sendResponse({
            ok: true,
            session,
          });
          break;
        }
        case 'popup.get-session':
          sendResponse({ ok: true, session: sessions.get(message.tabId) });
          break;
        case 'popup.cancel':
          sessions.clear(message.tabId);
          sendResponse({ ok: true });
          break;
        case 'popup.fill': {
          const approval = sessions.approveFill(message.tabId, message.selections, message.sensitiveConfirmations);
          if (!approval.ok) {
            sendResponse(approval);
            break;
          }
          const report = await fillTab(message.tabId, approval.value.selections);
          sendResponse({ ok: true, report: sessions.complete(message.tabId, report) });
          break;
        }
      }
    } catch (error) {
      sendResponse({ ok: false, error: safeErrorMessage(error) });
    }
  })();
  return true;
});

chrome.runtime.onMessageExternal.addListener((message: unknown, sender, sendResponse) => {
  const origin = normalizeSenderOrigin(sender);
  if (!isApprovedApplyFillOrigin(origin) || sender.tab?.id === undefined) {
    sendResponse({ ok: false, error: 'ApplyFill origin is not approved.' });
    return false;
  }

  if (typeof message === 'object' && message !== null && 'type' in message
    && ((message as { type?: unknown }).type === 'applyfill.pair'
      || (message as { type?: unknown }).type === 'applyfill.sync-profile')) {
    const update = validatePairingUpdate(message);
    if (!update.ok) {
      sendResponse(update);
      return false;
    }
    void (async () => {
      const result = update.value.type === 'applyfill.pair'
        ? { ok: true as const, value: await pairings.pair(update.value, origin) }
        : await pairings.sync(update.value, origin);
      sendResponse(result.ok ? {
        ok: true,
        paired: true,
        profileUpdatedAtUtc: result.value.profileUpdatedAtUtc,
        includeSensitive: result.value.includeSensitive,
      } : result);
    })();
    return true;
  }

  if (typeof message === 'object' && message !== null && 'type' in message
    && (message as { type?: unknown }).type === 'applyfill.inspect-paired') {
    const inspect = validatePairedInspect(message);
    if (!inspect.ok) {
      sendResponse(inspect);
      return false;
    }
    void (async () => {
      const pairing = await pairings.status(inspect.value.pairingSecret, origin);
      if (!pairing.ok) {
        sendResponse(pairing);
        return;
      }
      const result = sessions.inspectPaired(inspect.value.targetTabId);
      sendResponse(result.ok ? { ok: true, protocolVersion: PAIRING_PROTOCOL_VERSION, ...result.value } : result);
    })();
    return true;
  }

  if (typeof message === 'object' && message !== null && 'type' in message
    && (message as { type?: unknown }).type === 'applyfill.attach-ai-suggestions') {
    const update = validatePairedAiUpdate(message);
    if (!update.ok) {
      sendResponse(update);
      return false;
    }
    void (async () => {
      const pairing = await pairings.status(update.value.pairingSecret, origin);
      if (!pairing.ok) {
        sendResponse(pairing);
        return;
      }
      const result = sessions.attachPairedAiSuggestions(
        update.value.targetTabId,
        update.value.values,
        update.value.proposals,
      );
      sendResponse(result.ok ? { ok: true, accepted: true } : result);
    })();
    return true;
  }

  if (typeof message === 'object' && message !== null && 'type' in message
    && ((message as { type?: unknown }).type === 'applyfill.pairing-status'
      || (message as { type?: unknown }).type === 'applyfill.unpair')) {
    const control = validatePairingControl(message);
    if (!control.ok) {
      sendResponse(control);
      return false;
    }
    void (async () => {
      if (control.value.type === 'applyfill.unpair') {
        const result = await pairings.unpair(control.value.pairingSecret, origin);
        if (result.ok) sessions.clearAll();
        sendResponse(result.ok ? { ok: true, paired: false } : result);
        return;
      }
      const result = await pairings.status(control.value.pairingSecret, origin);
      sendResponse(result.ok ? {
        ok: true,
        paired: true,
        profileUpdatedAtUtc: result.value.profileUpdatedAtUtc,
        includeSensitive: result.value.includeSensitive,
      } : { ok: true, paired: false });
    })();
    return true;
  }

  sendResponse({ ok: false, error: 'Unsupported ApplyFill extension request.' });
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => sessions.clearByAnyTab(tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') sessions.clearByAnyTab(tabId);
});

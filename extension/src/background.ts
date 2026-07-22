import { PROTOCOL_VERSION, type CompletionReport, type FillSelection, validateDisconnect, validateHandoff, validateInspect } from './contracts';
import { isApprovedApplyFillOrigin, normalizeSenderOrigin, safeErrorMessage } from './security';
import { SessionStore } from './session-store';

const sessions = new SessionStore();

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
          sendResponse({ ok: true, session: sessions.create(message.tabId, fields) });
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
    && (message as { type?: unknown }).type === 'applyfill.inspect') {
    const inspect = validateInspect(message);
    if (!inspect.ok) {
      sendResponse(inspect);
      return false;
    }
    const result = sessions.inspect(
      inspect.value.targetTabId,
      origin,
      sender.tab.id,
      inspect.value.nonce,
    );
    sendResponse(result.ok
      ? { ok: true, protocolVersion: PROTOCOL_VERSION, ...result.value }
      : result);
    return false;
  }

  if (typeof message === 'object' && message !== null && 'type' in message
    && (message as { type?: unknown }).type === 'applyfill.disconnect') {
    const disconnect = validateDisconnect(message);
    if (!disconnect.ok) {
      sendResponse(disconnect);
      return false;
    }
    const result = sessions.disconnectFromSource(
      disconnect.value.targetTabId,
      origin,
      sender.tab.id,
      disconnect.value.nonce,
    );
    sendResponse(result.ok ? { ok: true, cleared: true } : result);
    return false;
  }

  const validation = validateHandoff(message);
  if (!validation.ok) {
    sendResponse(validation);
    return false;
  }

  const result = sessions.attach(validation.value, origin, sender.tab.id);
  sendResponse(result.ok
    ? { ok: true, accepted: true, expiresAt: result.value.expiresAt }
    : result);
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => sessions.clearByAnyTab(tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') sessions.clearByAnyTab(tabId);
});

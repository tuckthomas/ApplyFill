import { discoverFields, type FieldRegistry } from './discovery';
import { fillSelections } from './fill';
import type { FieldDescriptor, FillSelection } from './contracts';

declare global {
  interface Window {
    __applyFillContentInstalled?: boolean;
  }
}

if (!window.__applyFillContentInstalled) {
  window.__applyFillContentInstalled = true;
  let registry: FieldRegistry = new Map();
  let descriptors: FieldDescriptor[] = [];

  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (typeof message !== 'object' || message === null || !('type' in message)) return false;
    if ((message as { type: string }).type === 'content.discover') {
      const discovery = discoverFields();
      registry = discovery.registry;
      descriptors = discovery.fields;
      sendResponse({ fields: descriptors });
      return false;
    }
    if ((message as { type: string }).type === 'content.fill') {
      const selections = (message as { selections?: FillSelection[] }).selections;
      if (!Array.isArray(selections) || selections.length > descriptors.length) {
        sendResponse({ results: [], completedAt: Date.now(), requiresManualReview: true });
        return false;
      }
      const labels = new Map(descriptors.map((field) => [field.id, field.label]));
      void fillSelections(selections, registry, labels).then(sendResponse);
      return true;
    }
    return false;
  });
}

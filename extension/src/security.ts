const PRODUCTION_ORIGINS = new Set([
  'https://applyfill.app',
  'https://www.applyfill.app',
]);

const DEVELOPMENT_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
]);

export const APPROVED_APPLYFILL_ORIGINS = new Set([...PRODUCTION_ORIGINS, ...DEVELOPMENT_ORIGINS]);

export function normalizeSenderOrigin(sender: Pick<chrome.runtime.MessageSender, 'origin' | 'url'>): string | undefined {
  if (sender.origin) return sender.origin;
  if (!sender.url) return undefined;
  try {
    return new URL(sender.url).origin;
  } catch {
    return undefined;
  }
}

export function isApprovedApplyFillOrigin(origin: string | undefined): origin is string {
  return origin !== undefined && APPROVED_APPLYFILL_ORIGINS.has(origin);
}

export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && /Receiving end does not exist|Could not establish connection/.test(error.message)) {
    return 'The page connection was lost. Inspect the tab again.';
  }
  return 'The local autofill operation could not be completed.';
}

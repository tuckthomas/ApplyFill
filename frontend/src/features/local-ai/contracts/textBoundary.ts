import { getRichTextPlainText } from '../../rich-text/richText';

// oxlint-disable-next-line no-control-regex -- stripping control characters is the security boundary's purpose.
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const DIRECTIONAL_CONTROLS = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
const EXECUTABLE_BLOCKS = /<(script|style|iframe|object|embed|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const HTML_TAGS = /<[^>]*>/g;

export const AI_TEXT_LIMITS = {
  accomplishment: 1_200,
  educationDetail: 1_000,
  jobPosting: 24_000,
  projectDetail: 1_200,
  summary: 2_000,
  totalContext: 48_000
} as const;

const normalizeCharacters = (value: string) => value
  .normalize('NFKC')
  .replace(CONTROL_CHARACTERS, ' ')
  .replace(DIRECTIONAL_CONTROLS, '')
  .replace(/\r\n?/g, '\n')
  .replace(/[\t ]+/g, ' ')
  .replace(/ *\n */g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

export const boundPlainText = (value: string, maximumLength: number) => (
  normalizeCharacters(value).slice(0, maximumLength)
);

export const richTextToAiPlainText = (value: unknown, maximumLength: number) => (
  boundPlainText(getRichTextPlainText(value), maximumLength)
);

export const normalizeUntrustedJobText = (value: string) => boundPlainText(
  value.replace(EXECUTABLE_BLOCKS, ' ').replace(HTML_TAGS, ' '),
  AI_TEXT_LIMITS.jobPosting
);

export const containsMarkup = (value: string) => /<[^>]+>/.test(value);

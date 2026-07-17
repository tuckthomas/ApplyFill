import type { JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';

export const richTextExtensions = [
  StarterKit.configure({
    blockquote: false,
    codeBlock: false,
    code: false,
    heading: false,
    horizontalRule: false,
    link: false,
    strike: false
  }),
  Underline
];

const EMPTY_DOCUMENT: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }]
};

export const EMPTY_RICH_TEXT_VALUE = JSON.stringify(EMPTY_DOCUMENT);

const ALLOWED_MARKS = new Set(['bold', 'italic', 'underline']);

const hasOnlyAllowedMarks = (marks: JSONContent['marks']) => marks?.every((mark) => (
  typeof mark.type === 'string'
  && ALLOWED_MARKS.has(mark.type)
  && (!mark.attrs || Object.keys(mark.attrs).length === 0)
)) ?? true;

const isInlineContent = (node: unknown): node is JSONContent => {
  if (!node || typeof node !== 'object') return false;
  const value = node as JSONContent;

  if (!hasOnlyAllowedMarks(value.marks)) return false;
  if (value.type === 'text') return typeof value.text === 'string' && !value.content && !value.attrs;
  return value.type === 'hardBreak' && !value.text && !value.content && !value.attrs && !value.marks;
};

const isParagraph = (node: unknown): node is JSONContent => {
  if (!node || typeof node !== 'object') return false;
  const value = node as JSONContent;
  return value.type === 'paragraph'
    && !value.attrs
    && !value.marks
    && (!value.content || value.content.every(isInlineContent));
};

const isListItem = (node: unknown): node is JSONContent => {
  if (!node || typeof node !== 'object') return false;
  const value = node as JSONContent;
  return value.type === 'listItem'
    && !value.attrs
    && !value.marks
    && Array.isArray(value.content)
    && value.content.length > 0
    && value.content.every((child) => isParagraph(child) || isList(child));
};

const isList = (node: unknown): node is JSONContent => {
  if (!node || typeof node !== 'object') return false;
  const value = node as JSONContent;
  return (value.type === 'bulletList' || value.type === 'orderedList')
    && !value.attrs
    && !value.marks
    && Array.isArray(value.content)
    && value.content.length > 0
    && value.content.every(isListItem);
};

const isSafeDocument = (value: unknown): value is JSONContent => {
  if (!value || typeof value !== 'object') return false;
  const document = value as JSONContent;
  return document.type === 'doc'
    && !document.attrs
    && !document.marks
    && Array.isArray(document.content)
    && document.content.length > 0
    && document.content.every((node) => isParagraph(node) || isList(node));
};

export const getRichTextDocument = (value: unknown): JSONContent => {
  if (typeof value !== 'string' || !value.trim()) return EMPTY_DOCUMENT;

  try {
    const parsed = JSON.parse(value) as unknown;
    return isSafeDocument(parsed) ? parsed : EMPTY_DOCUMENT;
  } catch {
    return EMPTY_DOCUMENT;
  }
};

export const serializeRichText = (value: JSONContent | string): string => JSON.stringify(
  typeof value === 'string' ? getRichTextDocument(value) : (isSafeDocument(value) ? value : EMPTY_DOCUMENT)
);

export const normalizeRichText = (value: unknown): string => serializeRichText(
  typeof value === 'string' ? value : EMPTY_DOCUMENT
);

export const createRichTextFromPlainText = (value: string): string => {
  const content = value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] }));

  return JSON.stringify(content.length ? { type: 'doc', content } : EMPTY_DOCUMENT);
};

export const getRichTextPlainText = (value: unknown): string => {
  const visit = (node: JSONContent): string => [
    node.text ?? '',
    ...(node.content?.map(visit) ?? [])
  ].join(node.type === 'paragraph' || node.type === 'listItem' ? '\n' : '');

  return visit(getRichTextDocument(value)).replace(/\n{3,}/g, '\n\n').trim();
};

import {
  MAX_FIELDS,
  MAX_OPTIONS,
  type ControlKind,
  type FieldDescriptor,
  type FieldOption,
} from './contracts';

export type FieldTarget = Element | Element[];
export type FieldRegistry = Map<string, FieldTarget>;

const prohibitedTypes = new Set(['hidden', 'password', 'submit', 'button', 'reset', 'image']);
const prohibitedAutocomplete = /^(?:cc-|current-password|new-password|one-time-code|webauthn)/i;
const paymentPattern = /\b(?:credit\s*card|debit\s*card|card\s*number|cvv|cvc|security\s*code|bank\s*account|routing\s*number)\b/i;

function normalize(value: string | null | undefined, max = 300): string {
  return (value ?? '').replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function textFromIds(ids: string | null): string {
  if (!ids) return '';
  return normalize(ids.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' '));
}

function explicitLabel(element: Element): string {
  const aria = normalize(element.getAttribute('aria-label')) || textFromIds(element.getAttribute('aria-labelledby'));
  if (aria) return aria;
  if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
    const labels = [...element.labels ?? []].map((label) => label.textContent ?? '').join(' ');
    if (normalize(labels)) return normalize(labels);
  }
  const parentLabel = element.closest('label');
  return normalize(parentLabel?.textContent);
}

function nearbyLabel(element: Element): string {
  const described = textFromIds(element.getAttribute('aria-describedby'));
  if (described) return described;
  const previous = element.previousElementSibling;
  if (previous?.matches('label, legend, [role="label"], .label, [class*="label"]')) return normalize(previous.textContent);
  const fieldsetLegend = element.closest('fieldset')?.querySelector(':scope > legend');
  return normalize(fieldsetLegend?.textContent);
}

function getOptions(element: Element): FieldOption[] {
  if (element instanceof HTMLSelectElement) {
    return [...element.options].slice(0, MAX_OPTIONS).map((option) => ({
      value: normalize(option.value, 500),
      label: normalize(option.textContent, 500),
    }));
  }
  if (element instanceof HTMLInputElement && element.list) {
    return [...element.list.options].slice(0, MAX_OPTIONS).map((option) => ({
      value: normalize(option.value, 500),
      label: normalize(option.label || option.value, 500),
    }));
  }
  return [];
}

function isVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement) || element.hidden || element.closest('[hidden], [aria-hidden="true"]')) return false;
  const style = getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function generatedId(index: number, element: Element, label: string): string {
  const seed = `${element.tagName}:${element.getAttribute('name') ?? ''}:${label}:${index}`;
  let hash = 2166136261;
  for (let offset = 0; offset < seed.length; offset += 1) {
    hash ^= seed.charCodeAt(offset);
    hash = Math.imul(hash, 16777619);
  }
  return `af-${index}-${(hash >>> 0).toString(36)}`;
}

function controlKind(element: Element): ControlKind {
  if (element instanceof HTMLTextAreaElement) return 'textarea';
  if (element instanceof HTMLSelectElement) return 'select';
  if (element instanceof HTMLInputElement) {
    if (element.type === 'checkbox') return 'checkbox';
    if (element.type === 'file') return 'unsupported';
    return 'input';
  }
  if (element.getAttribute('role') === 'combobox') return element instanceof HTMLElement && element.isContentEditable ? 'unsupported' : 'combobox';
  return 'unsupported';
}

function descriptorFor(element: Element, index: number): FieldDescriptor | undefined {
  if (!isVisible(element)) return undefined;
  const inputType = element instanceof HTMLInputElement ? element.type.toLowerCase() : undefined;
  if (inputType && prohibitedTypes.has(inputType)) return undefined;
  const autocomplete = normalize(element.getAttribute('autocomplete'), 80).toLowerCase();
  if (prohibitedAutocomplete.test(autocomplete)) return undefined;
  const label = explicitLabel(element) || normalize(element.getAttribute('placeholder')) || normalize(element.getAttribute('name')) || 'Unlabeled field';
  const nearby = nearbyLabel(element);
  if (paymentPattern.test(`${label} ${nearby} ${element.getAttribute('name') ?? ''}`)) return undefined;
  const control = controlKind(element);
  const unsupportedReason = inputType === 'file'
    ? 'Browsers do not allow extensions to assign a local file. Download the selected resume from ApplyFill and upload it manually.'
    : control === 'unsupported'
      ? 'This custom control must be completed manually.'
      : element.matches(':disabled, [aria-disabled="true"]')
        ? 'This control is disabled by the site.'
        : undefined;
  const id = generatedId(index, element, label);
  return {
    id,
    control: unsupportedReason ? 'unsupported' : control,
    inputType,
    label,
    nearbyLabel: nearby || undefined,
    name: normalize(element.getAttribute('name'), 160) || undefined,
    autocomplete: autocomplete || undefined,
    required: element.matches(':required, [aria-required="true"]'),
    options: getOptions(element),
    unsupportedReason,
    maxLength: element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
      ? (element.maxLength > 0 ? element.maxLength : undefined)
      : undefined,
  };
}

function radioDescriptor(radios: HTMLInputElement[], index: number): FieldDescriptor {
  const first = radios[0] as HTMLInputElement;
  const legend = nearbyLabel(first);
  const label = legend || explicitLabel(first) || normalize(first.name) || 'Radio group';
  return {
    id: generatedId(index, first, label),
    control: 'radio-group',
    inputType: 'radio',
    label,
    nearbyLabel: legend || undefined,
    name: normalize(first.name, 160) || undefined,
    autocomplete: normalize(first.autocomplete, 80) || undefined,
    required: radios.some((radio) => radio.required),
    options: radios.slice(0, MAX_OPTIONS).map((radio) => ({
      value: normalize(radio.value, 500),
      label: explicitLabel(radio) || normalize(radio.value, 500),
    })),
  };
}

export function discoverFields(root: ParentNode = document): { fields: FieldDescriptor[]; registry: FieldRegistry } {
  const fields: FieldDescriptor[] = [];
  const registry: FieldRegistry = new Map();
  const seenRadioNames = new Set<string>();
  const candidates = [...root.querySelectorAll('input, textarea, select, [role="combobox"]')];

  for (const element of candidates) {
    if (fields.length >= MAX_FIELDS) break;
    if (element instanceof HTMLInputElement && element.type === 'radio' && element.name) {
      if (seenRadioNames.has(element.name)) continue;
      seenRadioNames.add(element.name);
      const radios = candidates.filter((candidate): candidate is HTMLInputElement =>
        candidate instanceof HTMLInputElement && candidate.type === 'radio' && candidate.name === element.name && isVisible(candidate));
      if (radios.length === 0) continue;
      const descriptor = radioDescriptor(radios, fields.length);
      fields.push(descriptor);
      registry.set(descriptor.id, radios);
      continue;
    }

    const descriptor = descriptorFor(element, fields.length);
    if (!descriptor) continue;
    fields.push(descriptor);
    registry.set(descriptor.id, element);
  }
  return { fields, registry };
}

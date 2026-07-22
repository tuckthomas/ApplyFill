import { type CompletionReport, type FillResult, type FillSelection } from './contracts';
import { type FieldRegistry, type FieldTarget } from './discovery';

function dispatchEvents(element: Element): void {
  element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(element, value);
  if (!setter) element.value = value;
}

function truthy(value: string): boolean {
  return /^(?:true|yes|1|on)$/i.test(value.trim());
}

function selectOption(element: HTMLSelectElement, value: string): boolean {
  const option = [...element.options].find((candidate) =>
    candidate.value.localeCompare(value, undefined, { sensitivity: 'accent' }) === 0
    || candidate.textContent?.trim().localeCompare(value.trim(), undefined, { sensitivity: 'accent' }) === 0);
  if (!option) return false;
  element.value = option.value;
  return true;
}

function chooseRadio(elements: Element[], value: string): HTMLInputElement | undefined {
  return elements.find((element): element is HTMLInputElement => {
    if (!(element instanceof HTMLInputElement)) return false;
    const label = [...element.labels ?? []].map((entry) => entry.textContent ?? '').join(' ').trim();
    return element.value.localeCompare(value, undefined, { sensitivity: 'accent' }) === 0
      || label.localeCompare(value.trim(), undefined, { sensitivity: 'accent' }) === 0;
  });
}

function readValue(target: FieldTarget): string {
  const first = Array.isArray(target) ? target[0] : target;
  if (Array.isArray(target)) return (target.find((element) => element instanceof HTMLInputElement && element.checked) as HTMLInputElement | undefined)?.value ?? '';
  if (first instanceof HTMLInputElement && first.type === 'checkbox') return String(first.checked);
  if (first instanceof HTMLInputElement || first instanceof HTMLTextAreaElement || first instanceof HTMLSelectElement) return first.value;
  return first instanceof HTMLElement ? first.textContent ?? '' : '';
}

function highlight(target: FieldTarget): void {
  const element = (Array.isArray(target) ? target[0] : target) as HTMLElement | undefined;
  if (!element) return;
  const previousOutline = element.style.outline;
  const previousOffset = element.style.outlineOffset;
  element.style.outline = '3px solid #7c4fe8';
  element.style.outlineOffset = '2px';
  window.setTimeout(() => {
    if (!element.isConnected) return;
    element.style.outline = previousOutline;
    element.style.outlineOffset = previousOffset;
  }, 1_800);
}

function writeValue(target: FieldTarget, value: string): { ok: boolean; expected: string; detail?: string } {
  if (Array.isArray(target)) {
    const radio = chooseRadio(target, value);
    if (!radio) return { ok: false, expected: value, detail: 'No matching radio option.' };
    radio.checked = true;
    dispatchEvents(radio);
    return { ok: true, expected: radio.value };
  }
  if (!target.isConnected) return { ok: false, expected: value, detail: 'The site replaced or removed this control.' };
  if (target instanceof HTMLInputElement) {
    if (target.type === 'file') return { ok: false, expected: value, detail: 'File inputs require manual upload.' };
    if (target.type === 'checkbox') {
      target.checked = truthy(value);
      dispatchEvents(target);
      return { ok: true, expected: String(target.checked) };
    }
    const bounded = target.maxLength > 0 ? value.slice(0, target.maxLength) : value;
    setNativeValue(target, bounded);
    dispatchEvents(target);
    return { ok: true, expected: bounded };
  }
  if (target instanceof HTMLTextAreaElement) {
    const bounded = target.maxLength > 0 ? value.slice(0, target.maxLength) : value;
    setNativeValue(target, bounded);
    dispatchEvents(target);
    return { ok: true, expected: bounded };
  }
  if (target instanceof HTMLSelectElement) {
    if (!selectOption(target, value)) return { ok: false, expected: value, detail: 'No matching select option.' };
    dispatchEvents(target);
    return { ok: true, expected: target.value };
  }
  return { ok: false, expected: value, detail: 'Unsupported custom control.' };
}

export async function fillSelections(
  selections: FillSelection[],
  registry: FieldRegistry,
  labels: Map<string, string>,
): Promise<CompletionReport> {
  const results: FillResult[] = [];
  for (const selection of selections) {
    const label = labels.get(selection.fieldId) ?? 'Unknown field';
    if (!selection.selected || selection.classification === 'manual') {
      results.push({ fieldId: selection.fieldId, label, status: 'skipped' });
      continue;
    }
    if (selection.classification === 'unsupported') {
      results.push({ fieldId: selection.fieldId, label, status: 'unsupported' });
      continue;
    }
    const target = registry.get(selection.fieldId);
    if (!target) {
      results.push({ fieldId: selection.fieldId, label, status: 'failed', detail: 'The page changed after discovery.' });
      continue;
    }
    try {
      const write = writeValue(target, selection.value);
      if (!write.ok) {
        results.push({ fieldId: selection.fieldId, label, status: 'failed', detail: write.detail });
        continue;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      const actual = readValue(target);
      if (actual !== write.expected) {
        results.push({ fieldId: selection.fieldId, label, status: 'changed-by-site', detail: 'The site rewrote or rejected the proposed value.' });
        continue;
      }
      highlight(target);
      results.push({ fieldId: selection.fieldId, label, status: 'filled' });
    } catch {
      results.push({ fieldId: selection.fieldId, label, status: 'failed', detail: 'The site prevented this field from being filled.' });
    }
  }
  return { results, completedAt: Date.now(), requiresManualReview: true };
}

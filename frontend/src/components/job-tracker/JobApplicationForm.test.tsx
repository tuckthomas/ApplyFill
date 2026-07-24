// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DateFormatPreferenceProvider } from '../../features/preferences/DateFormatProvider';
import JobApplicationForm from './JobApplicationForm';
import { createEmptyApplicationForm } from './jobApplication';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver = class {
  disconnect() {}
  observe() {}
  unobserve() {}
} as unknown as typeof ResizeObserver;

const mounted: Array<{ container: HTMLDivElement; root: ReturnType<typeof createRoot> }> = [];

afterEach(async () => {
  await act(async () => mounted.splice(0).forEach(({ container, root }) => {
    root.unmount();
    container.remove();
  }));
});

describe('JobApplicationForm', () => {
  it('shows Agentic AI but disables it until the application is saved', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ container, root });

    await act(async () => root.render(
      <DateFormatPreferenceProvider>
        <JobApplicationForm
          agentContent={<div>Agent workspace</div>}
          error=""
          isImportingJobDescription={false}
          jobDescriptionError=""
          mode="add"
          onCancel={vi.fn()}
          onChange={vi.fn()}
          onImportJobDescription={vi.fn()}
          onSubmit={vi.fn()}
          value={createEmptyApplicationForm()}
        />
      </DateFormatPreferenceProvider>,
    ));

    const agentTab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find((button) => button.textContent === 'Agentic AI');
    expect(agentTab).toBeDefined();
    expect(agentTab?.disabled).toBe(true);
    expect(agentTab?.closest('.tabbed-form__disabled-tooltip')?.getAttribute('data-tooltip'))
      .toBe('Save the application before using Agentic AI.');
    expect(container.textContent).not.toContain('Agent workspace');
    expect(container.querySelector('label[for$="-applied-date"]')?.textContent).toBe('Application Date');
    expect(container.querySelector('label[for$="-job-url"]')?.textContent).toBe('Job Posting URL');
    expect(container.querySelector('label[for$="-credential"]')?.textContent).toBe('Sign-in');
    expect(container.querySelector('label[for$="-job-title"]')?.textContent).toBe('Job Title *');
    expect(container.querySelector('label[for$="-workplace-type"]')?.textContent).toBe('Workplace Type');
    expect([...container.querySelectorAll('button')].some((button) => button.textContent?.includes('Manage Sign-ins'))).toBe(false);
    const requiredFieldsNote = container.querySelector('.tracker-form-grid > .section-copy');
    expect(requiredFieldsNote?.textContent).toBe('* Required fields are marked with an asterisk.');
    expect(requiredFieldsNote?.querySelector('em')).not.toBeNull();
  });
});

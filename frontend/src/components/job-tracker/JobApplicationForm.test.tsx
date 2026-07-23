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
  it('shows and opens Agentic AI while adding an application', async () => {
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
    expect(agentTab?.disabled).toBe(false);

    await act(async () => agentTab?.click());
    expect(container.textContent).toContain('Agent workspace');
  });
});

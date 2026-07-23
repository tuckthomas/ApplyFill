// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProfileImportMode, ProfileImportProposal, ProfileImportSelection } from '../features/profile/resumeImport';
import { createDefaultProfileBuilderState } from '../features/profile/profileBuilder';
import { PROFILE_AUTOMATION_CONSENT_VERSION } from '../features/profile/profileConsent';
import ProfileEditor from './ProfileEditor';

const persistence = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
}));

vi.mock('../features/profile/profileBuilder', async (importOriginal) => ({
  ...await importOriginal<typeof import('../features/profile/profileBuilder')>(),
  loadProfileBuilderState: persistence.load,
  saveProfileBuilderState: persistence.save,
}));

vi.mock('../components/resume/ProfileResumeImportSection', () => ({
  default: function MockProfileResumeImportSection({ onSelectionChange }: {
    onSelectionChange: (
      proposal: ProfileImportProposal | null,
      selection: ProfileImportSelection | null,
      mode: ProfileImportMode | null,
    ) => void;
  }) {
    useEffect(() => {
      onSelectionChange({
        contact: {
          email: 'jordan@example.test',
          firstName: 'Jordan',
          lastName: 'Lee',
          middleName: '',
          phone: '+13175550123',
          webLinks: [],
        },
        education: [],
        experience: [],
        credentials: [],
        projects: [],
        skills: [],
      }, {
        contact: new Set(['firstName', 'lastName', 'email', 'phone']),
        education: new Set(),
        experience: new Set(),
        credentials: new Set(),
        projects: new Set(),
        skills: new Set(),
      }, 'replace');
    }, [onSelectionChange]);

    return <p>Resume review ready</p>;
  },
}));

describe('ProfileEditor resume import', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    persistence.load.mockReset();
    persistence.save.mockReset();
  });

  it('saves checked resume proposals before moving to Personal Info', async () => {
    const loaded = createDefaultProfileBuilderState({
      acceptedAtUtc: '2026-07-23T12:00:00.000Z',
      disclosureVersion: PROFILE_AUTOMATION_CONSENT_VERSION,
    });
    persistence.load.mockResolvedValue(loaded);
    persistence.save.mockResolvedValue({});
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/job-profile/builder?section=resume-import']}>
          <ProfileEditor />
        </MemoryRouter>,
      );
    });
    await act(async () => {});

    const nextButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Next Step'));
    expect(nextButton).toBeTruthy();

    await act(async () => {
      nextButton?.click();
    });

    expect(persistence.save).toHaveBeenCalledTimes(1);
    expect(persistence.save.mock.calls[0][0].data.profile).toMatchObject({
      email: 'jordan@example.test',
      firstName: 'Jordan',
      lastName: 'Lee',
      phone: '+13175550123',
    });
    expect(container.textContent).toContain('Personal Information');

    await act(async () => root.unmount());
  });
});

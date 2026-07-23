import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadApplications } from '../../components/job-tracker/jobApplication';
import { browserAgentClient } from '../browser-agent/browserAgentClient';
import {
  createDefaultProfileBuilderState,
  createLocalProfileDocument,
  loadProfileDocument,
} from '../profile/profileBuilder';
import { loadResumeCollection } from '../resume/resumeDocument';
import { loadSetting, resetSettingsRepositoryForTests } from '../preferences/settingsRepository';

afterEach(() => {
  resetSettingsRepositoryForTests();
  vi.unstubAllGlobals();
});

describe('frontend persistence boundaries', () => {
  it('loads substantive records and service settings from local APIs', async () => {
    const document = createLocalProfileDocument(createDefaultProfileBuilderState());
    const requestedPaths: string[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input));
      requestedPaths.push(url.pathname);
      if (url.pathname === '/api/v1/profiles/current') {
        return jsonResponse({
          concurrencyToken: 'profile-version-1',
          content: document,
          hasSensitiveApplicationData: false,
          id: 'profile-1',
          schemaVersion: 2,
          updatedAt: '2026-07-22T12:00:00Z',
        });
      }
      if (url.pathname === '/api/v1/resumes') return jsonResponse([]);
      if (url.pathname === '/api/v1/job-applications') return jsonResponse([]);
      if (url.pathname === '/api/v1/settings/dashboard') {
        return jsonResponse({
          concurrencyToken: 'dashboard-version-1',
          content: { layouts: {}, widgets: [] },
          key: 'dashboard',
          schemaVersion: 1,
          updatedAt: '2026-07-22T12:00:00Z',
        });
      }
      if (url.pathname === '/api/v1/settings/date-format') {
        return jsonResponse({
          concurrencyToken: 'date-format-version-1',
          content: { value: 'MM/DD/YYYY' },
          key: 'date-format',
          schemaVersion: 1,
          updatedAt: '2026-07-22T12:00:00Z',
        });
      }
      if (url.pathname === '/api/private-ai/status') {
        return jsonResponse({ message: 'Private AI is ready.', state: 'ready' });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const [profile, resumes, applications, privateAi, dashboard, dateFormat] = await Promise.all([
      loadProfileDocument(),
      loadResumeCollection(),
      loadApplications(),
      browserAgentClient.getPrivateAiStatus(),
      loadSetting<{ layouts: unknown; widgets: unknown[] }>('dashboard'),
      loadSetting<{ value: string }>('date-format'),
    ]);

    expect(profile?.data.profile.firstName).toBe('');
    expect(resumes.resumes).toEqual([]);
    expect(applications).toEqual([]);
    expect(privateAi.state).toBe('ready');
    expect(dashboard?.content.widgets).toEqual([]);
    expect(dateFormat?.content.value).toBe('MM/DD/YYYY');
    expect(requestedPaths).toEqual(expect.arrayContaining([
      '/api/v1/profiles/current',
      '/api/v1/resumes',
      '/api/v1/job-applications',
      '/api/v1/settings/dashboard',
      '/api/v1/settings/date-format',
      '/api/private-ai/status',
    ]));
  });
});

const jsonResponse = (value: unknown) => new Response(JSON.stringify(value), {
  headers: { 'Content-Type': 'application/json' },
  status: 200,
});

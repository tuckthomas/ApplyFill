import { describe, expect, it } from 'vitest';
import type { LocalProfileDocument } from '../profile/profileBuilder';
import { createRichTextFromPlainText } from '../rich-text/richText';
import type { LocalResumeDraft } from './resumeDocument';
import { createResumeSafeViewModel } from './resumeExport';

describe('resume-safe export boundary', () => {
  it('includes selected public content and cannot expose application-only fields', () => {
    const profile = {
      data: {
        profile: {
          firstName: 'Jane', middleName: 'Q', lastName: 'Doe', email: 'jane@example.com', phone: '+15551234567',
          city: 'Indianapolis', state: { label: 'Indiana', value: 'IN' }, country: { label: 'United States', value: 'US' },
          address1: '123 Private Street', address2: '', postalCode: '46201', alternativeNames: [],
          webLinks: [{ id: 1, name: 'Portfolio', url: 'https://example.com' }]
        },
        experience: [{
          id: 10, isSaved: true, jobTitle: 'Engineer', company: 'Example Co', city: 'Indianapolis',
          state: { label: 'Indiana', value: 'IN' }, country: { label: 'United States', value: 'US' },
          startDate: '01/01/2024', endDate: '', isCurrentJob: true,
          description: createRichTextFromPlainText('Built accessible products'),
          reasonForLeaving: createRichTextFromPlainText('Private reason'), supervisorName: 'Private Supervisor',
          companyPhone: '+15559876543', mayContactSupervisor: false, address1: 'Private office'
        }],
        education: [], projects: [], skills: [{ id: 30, name: 'TypeScript', level: 'Expert' }],
        applicationQuestions: {
          governmentIdentifiers: [{ id: 1, country: { label: 'United States', value: 'US' }, identifierType: 'SSN', value: '123-45-6789' }],
          workAuthorizations: [{ id: 2, country: { label: 'United States', value: 'US' }, authorizedToWork: 'Yes', requiresSponsorship: 'No' }],
          raceEthnicity: 'Private demographic answer', veteranStatus: null, disabilityStatus: null
        }
      }
    } as unknown as LocalProfileDocument;
  const resume: LocalResumeDraft = {
    contentOverrides: { experienceDetails: {}, projectDetails: {} },
      createdAtUtc: '2026-07-18T12:00:00.000Z',
      id: 'resume-1',
      selections: { credentialIds: [], educationIds: [], experienceIds: [10], projectIds: [], skillIds: [30] },
      sourceProfileUpdatedAtUtc: '2026-07-18T12:00:00.000Z',
      summary: 'Product-minded engineer',
      targetJobUrl: '',
      targetRole: 'Senior Engineer',
      template: 'classic',
      title: 'Senior Engineer Resume',
      updatedAtUtc: '2026-07-18T12:00:00.000Z'
    };

    const model = createResumeSafeViewModel(profile, resume);
    const serialized = JSON.stringify(model);
    expect(model.experience[0].details).toEqual(['Built accessible products']);
    expect(model.skills).toEqual(['TypeScript']);
    expect(serialized).not.toContain('123-45-6789');
    expect(serialized).not.toContain('Private reason');
    expect(serialized).not.toContain('Private Supervisor');
    expect(serialized).not.toContain('Private demographic answer');
    expect(serialized).not.toContain('Private Street');
    expect(serialized).not.toContain('+15559876543');
  });
});

import { describe, expect, it } from 'vitest';
import { arrangePdfTextItems, createModelSafeResumeImportText, createProfileImportProposal, extractResumeContact, mergeExtractedResumeContacts, mergeProfileImportProposal, parseProfileImportModelOutput } from './resumeImport';
import type { ProfileImportModelOutput } from './resumeImport';
import { createDefaultProfileBuilderState, createLocalProfileDocument, DEFAULT_PROFILE_BUILDER_DATA, parseProfileDocument } from './profileBuilder';

const modelOutput: ProfileImportModelOutput = {
  credentials: [{ credentialId: 'CERT-123', credentialUrl: '', details: ['Commercial lending'], doesNotExpire: true, expirationDate: '', issueDate: '2023-06', issuer: 'Example Institute', name: 'Credit Certificate', type: 'Certificate' }],
  education: [{ current: true, details: ['Dean’s list'], endDate: '2020-05', fieldOfStudy: 'Computer Science', gpa: '3.8', gpaScale: '4', level: 'Bachelor of Science', provider: 'Example University', startDate: '2016-08' }],
  experience: [{ company: 'Example Corp', current: true, endDate: '', highlights: ['Built reliable systems'], jobTitle: 'Engineer', startDate: '2020-06' }],
  projects: [{ current: false, details: ['Created a local-first app'], endDate: '2024-04', name: 'ApplyFill', organization: '', projectType: 'Personal', role: 'Developer', startDate: '2024-01' }],
  skills: [{ level: '', name: 'TypeScript' }]
};

describe('local resume import boundary', () => {
  it('groups consecutive roles at one employer but separates a later return', () => {
    const proposal = createProfileImportProposal({
      ...modelOutput,
      experience: [
        { company: 'Example Corp', current: false, endDate: '2022-01', highlights: [], jobTitle: 'Analyst', startDate: '2020-01' },
        { company: 'Example Corp', current: false, endDate: '2023-01', highlights: [], jobTitle: 'Senior Analyst', startDate: '2022-01' },
        { company: 'Other Corp', current: false, endDate: '2024-01', highlights: [], jobTitle: 'Manager', startDate: '2023-01' },
        { company: 'Example Corp', current: true, endDate: '', highlights: [], jobTitle: 'Director', startDate: '2024-01' }
      ]
    }, extractResumeContact(''), 100);

    expect(proposal.experience[0].employmentGroupId).toBe(proposal.experience[1].employmentGroupId);
    expect(proposal.experience[2].employmentGroupId).not.toBe(proposal.experience[1].employmentGroupId);
    expect(proposal.experience[3].employmentGroupId).not.toBe(proposal.experience[0].employmentGroupId);
  });

  it('detects contact values deterministically and removes them from model text', () => {
    const text = 'Jordan Lee\njordan@example.test | +1 (317) 555-0123 | https://github.com/jordan\n123 Main Street\nNational Insurance: QQ 12 34 56 C\nEXPERIENCE\nEngineer at Example Corp';
    const contact = extractResumeContact(text, 10);
    expect(contact).toMatchObject({ email: 'jordan@example.test', firstName: 'Jordan', lastName: 'Lee', phone: '+13175550123' });
    const safe = createModelSafeResumeImportText(text, contact);
    expect(safe).not.toContain('Jordan Lee');
    expect(createModelSafeResumeImportText(text.toUpperCase(), contact)).not.toContain('JORDAN LEE');
    expect(safe).not.toContain('jordan@example.test');
    expect(safe).not.toContain('317');
    expect(safe).not.toContain('Main Street');
    expect(safe).not.toContain('QQ 12 34 56 C');
    expect(safe).toContain('Engineer at Example Corp');
  });

  it('does not classify a resume section heading as a person name', () => {
    const contact = extractResumeContact('PROFESSIONAL SUMMARY\nCredit analyst\nperson@example.test\n(260) 226-7175');

    expect(contact.firstName).toBe('');
    expect(contact.lastName).toBe('');
  });

  it('accepts a punctuated middle initial in a resume name', () => {
    const contact = extractResumeContact('TUCKER       T. OLSON\nCONTACT\nperson@example.test');

    expect(contact).toMatchObject({ firstName: 'TUCKER', middleName: 'T.', lastName: 'OLSON' });
  });

  it('adds contact values detected after OCR without replacing stronger embedded-text values', () => {
    const embedded = extractResumeContact('Jordan Lee\njordan@example.test\nhttps://github.com/jordan', 10);
    const ocr = extractResumeContact('Jordan L. Lee\n+1 (317) 555-0123\nhttps://linkedin.com/in/jordan', 20);
    const merged = mergeExtractedResumeContacts(embedded, ocr);
    expect(merged).toMatchObject({
      email: 'jordan@example.test',
      firstName: 'Jordan',
      lastName: 'Lee',
      phone: '+13175550123',
    });
    expect(merged.webLinks.map((link) => link.name)).toEqual(['GitHub', 'LinkedIn']);
  });

  it('validates model output and creates restricted saved entries', () => {
    const output = parseProfileImportModelOutput(modelOutput);
    const proposal = createProfileImportProposal(output, extractResumeContact('Jordan Lee\njordan@example.test\nEngineer', 10), 100);
    expect(proposal.experience[0]).toMatchObject({ company: 'Example Corp', startDate: '06/2020', isSaved: true });
    expect(proposal.education[0]).toMatchObject({ gpa: '3.80', gpaScale: '4.00' });
    expect(proposal.education[0]).toMatchObject({ endDate: '05/2020', isCurrentlyEnrolled: false });
    expect(proposal.credentials[0]).toMatchObject({
      credentialId: 'CERT-123',
      issuer: 'Example Institute',
      name: 'Credit Certificate',
    });
    expect(proposal.education).toHaveLength(1);
    expect(proposal.experience[0].companyPhone).toBe('');
    expect(proposal.experience[0].reasonForLeaving).not.toContain('Example');
  });

  it('merges selected fields without overwriting or duplicating existing profile data', () => {
    const proposal = createProfileImportProposal(modelOutput, extractResumeContact('Jordan Lee\njordan@example.test\nEngineer', 10), 100);
    const current = {
      ...DEFAULT_PROFILE_BUILDER_DATA,
      profile: { ...DEFAULT_PROFILE_BUILDER_DATA.profile, firstName: 'Existing' },
      skills: [{ id: 1, level: null, name: 'TypeScript' }]
    };
    const merged = mergeProfileImportProposal(current, proposal, {
      contact: new Set(['firstName', 'lastName', 'email']),
      education: new Set(proposal.education.map((item) => item.id)),
      experience: new Set(proposal.experience.map((item) => item.id)),
      credentials: new Set(proposal.credentials.map((item) => item.id)),
      projects: new Set(proposal.projects.map((item) => item.id)),
      skills: new Set(proposal.skills.map((item) => item.id))
    });
    expect(merged.profile.firstName).toBe('Existing');
    expect(merged.profile.lastName).toBe('Lee');
    expect(merged.experience).toHaveLength(1);
    expect(merged.skills).toHaveLength(1);

    const duplicateProposal = {
      ...proposal,
      experience: [...proposal.experience, { ...proposal.experience[0], id: 9_999 }]
    };
    const duplicateMerged = mergeProfileImportProposal(DEFAULT_PROFILE_BUILDER_DATA, duplicateProposal, {
      contact: new Set(), education: new Set(), credentials: new Set(), projects: new Set(), skills: new Set(),
      experience: new Set(duplicateProposal.experience.map((item) => item.id))
    });
    expect(duplicateMerged.experience).toHaveLength(1);
  });

  it('moves previously saved certificate education entries into credentials', () => {
    const proposal = createProfileImportProposal(modelOutput, extractResumeContact('Jordan Lee'), 100);
    const state = createDefaultProfileBuilderState();
    state.data.education = [{
      ...proposal.education[0],
      fieldOfStudy: 'Commercial Lending Specialty',
      level: { label: 'Certificate', value: 'Certificate' },
      provider: 'Lake City University',
    }];

    const document = parseProfileDocument(JSON.stringify(createLocalProfileDocument(state)));

    expect(document.data.education).toHaveLength(0);
    expect(document.data.credentials).toEqual([expect.objectContaining({
      issuer: 'Lake City University',
      name: 'Commercial Lending Specialty',
      type: 'Certificate',
    })]);
  });

  it('rejects unknown model fields and malformed dates', () => {
    expect(() => parseProfileImportModelOutput({ ...modelOutput, secret: 'x' })).toThrow(/invalid/);
    expect(() => parseProfileImportModelOutput({ ...modelOutput, experience: [{ ...modelOutput.experience[0], startDate: 'June 2020' }] })).toThrow(/unsupported/);
  });

  it('preserves rows and separates two-column PDF text in reading order', () => {
    const items = [
      { str: 'RESUME TITLE', transform: [1, 0, 0, 12, 180, 760], width: 260, height: 12 },
      ...Array.from({ length: 10 }, (_, index) => ({ str: `LEFT ${index + 1}`, transform: [1, 0, 0, 10, 20, 700 - index * 20], width: 80, height: 10 })),
      ...Array.from({ length: 10 }, (_, index) => ({ str: `RIGHT ${index + 1}`, transform: [1, 0, 0, 10, 350, 700 - index * 20], width: 90, height: 10 })),
    ];
    const arranged = arrangePdfTextItems(items, 612, 1);
    expect(arranged).toContain('RESUME TITLE');
    expect(arranged).toContain('[Page 1, left column]\nLEFT 1\nLEFT 2');
    expect(arranged).toContain('[Page 1, right column]\nRIGHT 1\nRIGHT 2');
    expect(arranged.indexOf('LEFT 1')).toBeLessThan(arranged.indexOf('RIGHT 1'));
  });
});

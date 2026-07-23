import { describe, expect, it } from 'vitest';
import { pdf } from '@react-pdf/renderer';
import ResumePdfDocument from '../../components/resume/ResumePdfDocument';
import { createResumeDocxBlob } from './resumeDownloads';
import type { ResumeSafeViewModel } from './resumeExport';

const model: ResumeSafeViewModel = {
  contact: { email: 'jane@example.com', links: [], location: 'Indianapolis, Indiana', name: 'Jane Doe', phone: '+1 (555) 123-4567' },
  credentials: [],
  education: [],
  experience: [{ company: 'Example Co', dateRange: 'Jan 2024 – Present', details: ['Built accessible products'], jobTitle: 'Engineer', location: 'Indianapolis, Indiana' }],
  projects: [],
  skills: ['TypeScript'],
  summary: 'Product-minded engineer',
  title: 'Senior Engineer'
};

describe('client-side document renderers', () => {
  it('generates non-empty PDF and DOCX blobs without an API', async () => {
    const pdfBlob = await pdf(<ResumePdfDocument model={model} />).toBlob();
    const docxBlob = await createResumeDocxBlob(model);
    expect(pdfBlob.type).toBe('application/pdf');
    expect(pdfBlob.size).toBeGreaterThan(500);
    expect(docxBlob.type).toContain('officedocument');
    expect(docxBlob.size).toBeGreaterThan(500);
  });
});

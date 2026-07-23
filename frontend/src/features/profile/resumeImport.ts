import type { EducationEntry } from '../../components/resume/EducationSection';
import type { ExperienceEntry } from '../../components/resume/ExperienceSection';
import type { ProfileSectionData, WebLink } from '../../components/resume/ProfileSection';
import type { ProjectEntry } from '../../components/resume/ProjectsSection';
import type { SkillEntry, SkillLevel } from '../../components/resume/SkillsSection';
import { createRichTextFromPlainText } from '../rich-text/richText';
import { normalizePhoneNumber } from './phoneNumber';
import type { ProfileBuilderData } from './profileBuilder';

export const RESUME_IMPORT_MAX_BYTES = 10 * 1024 * 1024;
export const RESUME_IMPORT_MAX_TEXT = 30_000;
export const RESUME_IMPORT_MAX_PAGES = 15;
export const RESUME_IMPORT_MAX_RENDERED_BYTES = 14 * 1024 * 1024;
export const RESUME_IMPORT_ACCEPT = '.pdf,.docx,.txt,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export type ExtractedResumeContact = {
  email: string;
  firstName: string;
  lastName: string;
  middleName: string;
  phone: string;
  webLinks: WebLink[];
};

export type ProfileImportModelOutput = {
  education: Array<{
    current: boolean;
    details: string[];
    endDate: string;
    fieldOfStudy: string;
    gpa: string;
    gpaScale: string;
    level: string;
    provider: string;
    startDate: string;
  }>;
  experience: Array<{
    company: string;
    current: boolean;
    endDate: string;
    highlights: string[];
    jobTitle: string;
    startDate: string;
  }>;
  projects: Array<{
    current: boolean;
    details: string[];
    endDate: string;
    name: string;
    organization: string;
    projectType: string;
    role: string;
    startDate: string;
  }>;
  skills: Array<{ level: '' | SkillLevel; name: string }>;
};

export type ProfileImportProposal = {
  contact: ExtractedResumeContact;
  education: EducationEntry[];
  experience: ExperienceEntry[];
  projects: ProjectEntry[];
  skills: SkillEntry[];
};

export type ProfileImportSelection = {
  contact: Set<keyof Pick<ProfileSectionData, 'firstName' | 'middleName' | 'lastName' | 'email' | 'phone' | 'webLinks'>>;
  education: Set<number>;
  experience: Set<number>;
  projects: Set<number>;
  skills: Set<number>;
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const exactKeys = (value: Record<string, unknown>, keys: string[]) => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const boundedString = (value: unknown, maximum = 500) => typeof value === 'string' && value.length <= maximum;
const boundedStrings = (value: unknown, count = 20, length = 1_000) => Array.isArray(value)
  && value.length <= count && value.every((item) => boundedString(item, length));
const yearMonth = (value: unknown) => value === '' || (
  typeof value === 'string'
  && /^(?:19|20)\d{2}-(?:0[1-9]|1[0-2])$/.test(value)
);

const educationKeys = ['current', 'details', 'endDate', 'fieldOfStudy', 'gpa', 'gpaScale', 'level', 'provider', 'startDate'];
const experienceKeys = ['company', 'current', 'endDate', 'highlights', 'jobTitle', 'startDate'];
const projectKeys = ['current', 'details', 'endDate', 'name', 'organization', 'projectType', 'role', 'startDate'];
const skillKeys = ['level', 'name'];
const educationLevels = new Set([
  '', 'High school diploma or GED', 'Associate degree', 'Bachelor of Arts', 'Bachelor of Science',
  'Master of Arts', 'Master of Science', 'MBA', 'Doctorate', 'Certificate', 'Vocational training',
  'Online course', 'Other'
]);
const projectTypes = new Set(['', 'Open source', 'Professional', 'Personal', 'Academic', 'Volunteer', 'Other']);
const skillLevels = new Set(['', 'Novice', 'Intermediate', 'Advanced', 'Expert']);

const validGpa = (gpa: unknown, scale: unknown) => {
  if (gpa === '' && scale === '') return true;
  if (typeof gpa !== 'string' || typeof scale !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(gpa) || !/^\d+(?:\.\d{1,2})?$/.test(scale)) return false;
  const numericGpa = Number(gpa);
  const numericScale = Number(scale);
  return numericGpa >= 0 && numericScale > 0 && numericScale <= 100 && numericGpa <= numericScale;
};

export const parseProfileImportModelOutput = (value: unknown): ProfileImportModelOutput => {
  if (!isRecord(value) || !exactKeys(value, ['education', 'experience', 'projects', 'skills'])
    || !Array.isArray(value.education) || value.education.length > 20
    || !Array.isArray(value.experience) || value.experience.length > 30
    || !Array.isArray(value.projects) || value.projects.length > 20
    || !Array.isArray(value.skills) || value.skills.length > 100) {
    throw new Error('Private AI returned an invalid resume-import structure. Nothing was changed.');
  }

  const educationValid = value.education.every((item) => isRecord(item) && exactKeys(item, educationKeys)
    && typeof item.current === 'boolean' && boundedStrings(item.details)
    && yearMonth(item.startDate) && yearMonth(item.endDate)
    && boundedString(item.fieldOfStudy, 200) && boundedString(item.provider, 200)
    && boundedString(item.level, 80) && educationLevels.has(item.level as string)
    && validGpa(item.gpa, item.gpaScale));
  const experienceValid = value.experience.every((item) => isRecord(item) && exactKeys(item, experienceKeys)
    && typeof item.current === 'boolean' && boundedStrings(item.highlights)
    && yearMonth(item.startDate) && yearMonth(item.endDate)
    && boundedString(item.company, 200) && boundedString(item.jobTitle, 200));
  const projectsValid = value.projects.every((item) => isRecord(item) && exactKeys(item, projectKeys)
    && typeof item.current === 'boolean' && boundedStrings(item.details)
    && yearMonth(item.startDate) && yearMonth(item.endDate)
    && boundedString(item.name, 200) && boundedString(item.organization, 200) && boundedString(item.role, 200)
    && boundedString(item.projectType, 80) && projectTypes.has(item.projectType as string));
  const skillsValid = value.skills.every((item) => isRecord(item) && exactKeys(item, skillKeys)
    && boundedString(item.name, 120) && boundedString(item.level, 20) && skillLevels.has(item.level as string));

  if (!educationValid || !experienceValid || !projectsValid || !skillsValid) {
    throw new Error('Private AI returned unsupported resume-import values. Nothing was changed.');
  }
  return value as ProfileImportModelOutput;
};

const cleanText = (value: string) => value
  .split('\u0000').join('')
  .replace(/\r\n?/g, '\n')
  .replace(/[\t\f\v]+/g, ' ')
  .replace(/ +/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const resumeSectionHeading = /^(?:(?:professional|career|executive|personal|work|employment|volunteer|technical|core|key)\s+)*(?:summary|profile|experience|history|education|skills|competencies|projects|resume|curriculum vitae)$/i;

const likelyName = (line: string) => {
  const words = line.trim().split(/\s+/);
  return line.length <= 80 && words.length >= 2 && words.length <= 4
    && words.every((word) => /^[\p{L}][\p{L}'’-]*$/u.test(word))
    && !resumeSectionHeading.test(line.trim());
};

const linkLabel = (url: string) => {
  try {
    const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
    if (host.includes('linkedin.com')) return 'LinkedIn';
    if (host.includes('github.com')) return 'GitHub';
    return host;
  } catch {
    return 'Website';
  }
};

const escapeRegularExpression = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const extractResumeContact = (text: string, baseId = Date.now()): ExtractedResumeContact => {
  const normalized = cleanText(text);
  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
  const firstLines = lines.slice(0, 5);
  const firstSectionHeading = firstLines.findIndex((line) => resumeSectionHeading.test(line));
  const nameLine = firstLines.slice(0, firstSectionHeading < 0 ? firstLines.length : firstSectionHeading).find(likelyName) ?? '';
  const nameParts = nameLine.split(/\s+/).filter(Boolean);
  const email = normalized.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0] ?? '';
  const phoneCandidates = normalized.match(/(?:\+?\d[\d().\s-]{8,}\d)/g) ?? [];
  const phone = phoneCandidates.map((candidate) => {
    const digits = candidate.replace(/\D/g, '');
    return normalizePhoneNumber(digits.length === 10 ? `1${digits}` : digits);
  }).find((candidate) => candidate.length === 12) ?? '';
  const urls = [...new Set(normalized.match(/(?:https?:\/\/|www\.)[^\s<>()]+/gi) ?? [])]
    .slice(0, 10)
    .map((url) => url.replace(/[.,;:]+$/, ''));

  return {
    email,
    firstName: nameParts[0] ?? '',
    middleName: nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '',
    lastName: nameParts.length > 1 ? nameParts.at(-1) ?? '' : '',
    phone,
    webLinks: urls.map((url, index) => ({
      id: baseId + index,
      name: linkLabel(url),
      url: url.startsWith('http') ? url : `https://${url}`
    }))
  };
};

export const mergeExtractedResumeContacts = (
  primary: ExtractedResumeContact,
  secondary: ExtractedResumeContact,
): ExtractedResumeContact => {
  const seenLinks = new Set<string>();
  const webLinks = [...primary.webLinks, ...secondary.webLinks].filter((link) => {
    const normalized = link.url.trim().toLowerCase().replace(/\/$/, '');
    if (!normalized || seenLinks.has(normalized)) return false;
    seenLinks.add(normalized);
    return true;
  });
  return {
    email: primary.email || secondary.email,
    firstName: primary.firstName || secondary.firstName,
    lastName: primary.lastName || secondary.lastName,
    middleName: primary.middleName || secondary.middleName,
    phone: primary.phone || secondary.phone,
    webLinks,
  };
};

export const createModelSafeResumeImportText = (text: string, contact = extractResumeContact(text)) => {
  let redacted = cleanText(text);
  const exactValues = [
    contact.email, contact.phone.replace(/^\+/, ''),
    [contact.firstName, contact.middleName, contact.lastName].filter(Boolean).join(' '),
    ...contact.webLinks.flatMap((link) => [link.url, link.url.replace(/^https?:\/\//, '')])
  ].filter((value) => value.length >= 3);
  exactValues.forEach((value) => {
    redacted = redacted.replace(new RegExp(escapeRegularExpression(value), 'giu'), '[contact removed]');
  });
  redacted = redacted
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[contact removed]')
    .replace(/(?:\+?\d[\d().\s-]{8,}\d)/g, '[contact removed]')
    .replace(/(?:https?:\/\/|www\.)[^\s<>()]+/gi, '[contact removed]')
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[sensitive identifier removed]')
    .replace(/\b[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/gi, '[sensitive identifier removed]')
    .split('\n')
    .filter((line) => !/\b\d{1,6}\s+[\p{L}0-9.'’-]+(?:\s+[\p{L}0-9.'’-]+){0,5}\s+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way)\b/iu.test(line)
      && !/\b(?:social security|national insurance|social insurance|aadhaar|tax file number|government identifier|national identification|passport number)\b/iu.test(line))
    .join('\n');
  return cleanText(redacted).slice(0, RESUME_IMPORT_MAX_TEXT);
};

export type PositionedPdfTextItem = {
  str: string;
  transform: number[];
  width?: number;
  height?: number;
};

export type RenderedResumePage = {
  blob: Blob;
  pageNumber: number;
};

type PositionedText = { text: string; x: number; y: number; width: number; height: number };

const renderPositionedLines = (items: PositionedText[]) => {
  if (!items.length) return '';
  const typicalHeight = [...items].sort((left, right) => left.height - right.height)[Math.floor(items.length / 2)]?.height || 10;
  const tolerance = Math.max(2, typicalHeight * 0.4);
  const lines: Array<{ y: number; items: PositionedText[] }> = [];
  for (const item of [...items].sort((left, right) => right.y - left.y || left.x - right.x)) {
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= tolerance);
    if (line) {
      line.items.push(item);
      line.y = (line.y * (line.items.length - 1) + item.y) / line.items.length;
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }
  return lines
    .sort((left, right) => right.y - left.y)
    .map((line) => line.items.sort((left, right) => left.x - right.x).map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
};

/** Preserves PDF rows and column reading order instead of flattening a page into one line. */
export const arrangePdfTextItems = (
  rawItems: PositionedPdfTextItem[],
  pageWidth: number,
  pageNumber: number,
) => {
  const items: PositionedText[] = rawItems
    .filter((item) => item.str.trim() && item.transform.length >= 6)
    .map((item) => ({
      text: item.str.trim(),
      x: Number(item.transform[4]) || 0,
      y: Number(item.transform[5]) || 0,
      width: Math.max(0, item.width ?? 0),
      height: Math.max(1, item.height ?? Math.abs(item.transform[3] ?? 10)),
    }));
  if (!items.length) return '';

  const starts = [...new Set(items.map((item) => Math.round(item.x * 2) / 2))].sort((left, right) => left - right);
  const gaps = starts.slice(1).map((value, index) => ({ left: starts[index]!, right: value, size: value - starts[index]! }))
    .filter((gap) => gap.left >= pageWidth * 0.12 && gap.right <= pageWidth * 0.88);
  const widestGap = gaps.sort((left, right) => right.size - left.size)[0];
  const split = widestGap && widestGap.size >= pageWidth * 0.12 ? (widestGap.left + widestGap.right) / 2 : undefined;
  const left = split ? items.filter((item) => item.x < split && item.x + item.width <= split) : [];
  const right = split ? items.filter((item) => item.x >= split) : [];
  const hasColumns = split !== undefined && left.length >= 8 && right.length >= 8;
  if (!hasColumns || split === undefined) return `[Page ${pageNumber}]\n${renderPositionedLines(items)}`;

  const fullWidth = items.filter((item) => item.x < split && item.x + item.width > split);
  const fullWidthSet = new Set(fullWidth);
  const leftColumn = left.filter((item) => !fullWidthSet.has(item));
  const sections = [
    renderPositionedLines(fullWidth),
    `[Page ${pageNumber}, left column]\n${renderPositionedLines(leftColumn)}`,
    `[Page ${pageNumber}, right column]\n${renderPositionedLines(right)}`,
  ].filter((section) => section.trim());
  return sections.join('\n\n');
};

export const extractResumeText = async (file: File): Promise<string> => {
  if (file.size > RESUME_IMPORT_MAX_BYTES) throw new Error('Choose a resume no larger than 10 MB.');
  const extension = file.name.toLowerCase().split('.').pop();
  let text = '';
  if (extension === 'txt' || file.type === 'text/plain') {
    text = await file.text();
  } else if (extension === 'docx' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    text = result.value;
  } else if (extension === 'pdf' || file.type === 'application/pdf') {
    const [{ getDocument, GlobalWorkerOptions }, worker] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    ]);
    GlobalWorkerOptions.workerSrc = worker.default;
    const loadingTask = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const document = await loadingTask.promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= Math.min(document.numPages, 30); pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1 });
      pages.push(arrangePdfTextItems(
        content.items.filter((item): item is typeof item & PositionedPdfTextItem => 'str' in item),
        viewport.width,
        pageNumber,
      ));
    }
    await loadingTask.destroy();
    text = pages.join('\n');
  } else {
    throw new Error('Choose a PDF, DOCX, or plain-text resume.');
  }
  const cleaned = cleanText(text);
  const isPdf = extension === 'pdf' || file.type === 'application/pdf';
  if (cleaned.length < 40 && !isPdf) throw new Error('This file did not contain enough readable text to import.');
  return cleaned.slice(0, RESUME_IMPORT_MAX_TEXT);
};

const canvasBlob = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error('A resume page could not be prepared for Private AI.'));
  }, 'image/jpeg', 0.86);
});

const renderPlainTextPages = async (text: string): Promise<RenderedResumePage[]> => {
  const width = 1_200;
  const height = 1_600;
  const margin = 90;
  const lineHeight = 38;
  const canvas = globalThis.document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('This browser could not prepare resume pages for Private AI.');
  context.font = '28px Arial, sans-serif';
  const maximumLineWidth = width - margin * 2;
  const wrappedLines: string[] = [];
  for (const sourceLine of text.split('\n')) {
    const words = sourceLine.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      wrappedLines.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maximumLineWidth) {
        wrappedLines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) wrappedLines.push(line);
  }

  const linesPerPage = Math.floor((height - margin * 2) / lineHeight);
  const rendered: RenderedResumePage[] = [];
  for (let offset = 0; offset < wrappedLines.length && rendered.length < RESUME_IMPORT_MAX_PAGES; offset += linesPerPage) {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#111827';
    context.font = '28px Arial, sans-serif';
    context.textBaseline = 'top';
    wrappedLines.slice(offset, offset + linesPerPage).forEach((line, index) => {
      context.fillText(line, margin, margin + index * lineHeight, maximumLineWidth);
    });
    rendered.push({ blob: await canvasBlob(canvas), pageNumber: rendered.length + 1 });
  }
  canvas.width = 1;
  canvas.height = 1;
  return rendered;
};

export const renderResumePageImages = async (
  file: File,
  extractedText?: string,
): Promise<RenderedResumePage[]> => {
  const extension = file.name.toLowerCase().split('.').pop();
  if (extension !== 'pdf' && file.type !== 'application/pdf') {
    const text = extractedText ?? await extractResumeText(file);
    return renderPlainTextPages(text);
  }
  const [{ getDocument, GlobalWorkerOptions }, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  ]);
  GlobalWorkerOptions.workerSrc = worker.default;
  const loadingTask = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdfDocument = await loadingTask.promise;
  const rendered: RenderedResumePage[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= Math.min(pdfDocument.numPages, RESUME_IMPORT_MAX_PAGES); pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const unscaled = page.getViewport({ scale: 1 });
      const scale = Math.min(2, 1_600 / Math.max(unscaled.width, unscaled.height));
      const viewport = page.getViewport({ scale });
      const canvas = globalThis.document.createElement('canvas');
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('This browser could not prepare resume pages for Private AI.');
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      rendered.push({ blob: await canvasBlob(canvas), pageNumber });
      canvas.width = 1;
      canvas.height = 1;
    }
  } finally {
    await loadingTask.destroy();
  }
  return rendered;
};

const estimatedDate = (value: string) => value ? `${value.slice(5, 7)}/${value.slice(0, 4)}` : '';
const normalizedGpa = (value: string) => value ? Number(value).toFixed(2) : '';

export const createProfileImportProposal = (
  output: ProfileImportModelOutput,
  contact: ExtractedResumeContact,
  baseId = Date.now()
): ProfileImportProposal => ({
  contact,
  education: output.education.filter((item) => item.provider.trim()).map((item, index) => {
    const isCurrent = item.current && !item.endDate;
    return {
      id: baseId + 1_000 + index,
      level: { label: item.level || 'Other', value: item.level || 'Other' },
      fieldOfStudy: item.fieldOfStudy.trim(), provider: item.provider.trim(), country: null, city: '', state: null,
      isRemote: false, isCurrentlyEnrolled: isCurrent, startDate: estimatedDate(item.startDate), startDatePrecision: 'Estimated',
      endDate: isCurrent ? '' : estimatedDate(item.endDate), endDatePrecision: 'Estimated',
      gpa: normalizedGpa(item.gpa), gpaScale: normalizedGpa(item.gpaScale),
      additionalDetails: createRichTextFromPlainText(item.details.join('\n')), isEditing: false, isSaved: true
    };
  }),
  experience: output.experience.filter((item) => item.company.trim() || item.jobTitle.trim()).map((item, index) => {
    const isCurrent = item.current && !item.endDate;
    return {
      id: baseId + 2_000 + index,
      jobTitle: item.jobTitle.trim(), company: item.company.trim(), startDate: estimatedDate(item.startDate), startDatePrecision: 'Estimated',
      endDate: isCurrent ? '' : estimatedDate(item.endDate), endDatePrecision: 'Estimated', isCurrentJob: isCurrent,
      address1: '', address2: '', city: '', state: null, postalCode: '', country: null, companyPhone: '', supervisorName: '',
      mayContactSupervisor: false, description: createRichTextFromPlainText(item.highlights.join('\n')), reasonForLeaving: createRichTextFromPlainText(''),
      rewriteMessage: '', validationMessage: '', isEditing: false, isSaved: true
    };
  }),
  projects: output.projects.filter((item) => item.name.trim()).map((item, index) => {
    const isCurrent = item.current && !item.endDate;
    return {
      id: baseId + 3_000 + index,
      name: item.name.trim(), projectType: { label: item.projectType || 'Other', value: item.projectType || 'Other' },
      role: item.role.trim(), organization: item.organization.trim(), projectUrl: '', startDate: estimatedDate(item.startDate), startDatePrecision: 'Estimated',
      endDate: isCurrent ? '' : estimatedDate(item.endDate), endDatePrecision: 'Estimated', isOngoing: isCurrent,
      description: createRichTextFromPlainText(item.details.join('\n')), isEditing: false, isSaved: true, rewriteMessage: ''
    };
  }),
  skills: output.skills.filter((item) => item.name.trim()).map((item, index) => ({
    id: baseId + 4_000 + index, name: item.name.trim(), level: item.level || null
  }))
});

const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

const appendSelectedUnique = <Item extends { id: number }>(
  current: Item[],
  proposed: Item[],
  selected: Set<number>,
  key: (item: Item) => string
) => {
  const seen = new Set(current.map((item) => normalize(key(item))));
  return [...current, ...proposed.filter((item) => {
    const normalizedKey = normalize(key(item));
    if (!selected.has(item.id) || seen.has(normalizedKey)) return false;
    seen.add(normalizedKey);
    return true;
  })];
};

export const mergeProfileImportProposal = (
  current: ProfileBuilderData,
  proposal: ProfileImportProposal,
  selected: ProfileImportSelection
): ProfileBuilderData => {
  const contactFields = ['firstName', 'middleName', 'lastName', 'email', 'phone'] as const;
  const profile = { ...current.profile };
  contactFields.forEach((field) => {
    if (selected.contact.has(field) && !profile[field] && proposal.contact[field]) profile[field] = proposal.contact[field];
  });
  if (selected.contact.has('webLinks')) {
    const existingUrls = new Set(profile.webLinks.map((link) => normalize(link.url)));
    profile.webLinks = [...profile.webLinks, ...proposal.contact.webLinks.filter((link) => !existingUrls.has(normalize(link.url)))];
  }

  return {
    ...current,
    profile,
    education: appendSelectedUnique(current.education, proposal.education, selected.education,
      (item) => `${item.provider}|${item.fieldOfStudy}|${item.startDate}`),
    experience: appendSelectedUnique(current.experience, proposal.experience, selected.experience,
      (item) => `${item.company}|${item.jobTitle}|${item.startDate}`),
    projects: appendSelectedUnique(current.projects, proposal.projects, selected.projects,
      (item) => `${item.name}|${item.organization}`),
    skills: appendSelectedUnique(current.skills, proposal.skills, selected.skills, (item) => item.name)
  };
};

import type { Paragraph as DocxParagraph } from 'docx';
import type { ResumeSafeViewModel } from './resumeExport';

const safeFileStem = (value: string) => value.trim()
  .replace(/[^a-z0-9]+/gi, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase() || 'resume';

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = fileName;
  window.document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const resumeFileName = (title: string, extension: 'docx' | 'json' | 'pdf') => (
  `${safeFileStem(title)}.${extension}`
);

export const createResumeDocxBlob = async (model: ResumeSafeViewModel): Promise<Blob> => {
  const { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } = await import('docx');
  const detailParagraphs = (details: string[]) => details.map((detail) => new Paragraph({
    bullet: { level: 0 },
    children: [new TextRun(detail)],
    spacing: { after: 40 }
  }));
  const sectionHeading = (text: string) => new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 180, after: 80 },
    text
  });
  const contact = [model.contact.email, model.contact.phone, model.contact.location]
    .filter(Boolean)
    .join(' | ');
  const children: DocxParagraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.TITLE,
      spacing: { after: 60 },
      text: model.contact.name || 'Your Name'
    }),
    ...(model.title ? [new Paragraph({ alignment: AlignmentType.CENTER, text: model.title })] : []),
    ...(contact ? [new Paragraph({ alignment: AlignmentType.CENTER, text: contact })] : []),
    ...(model.contact.links.length ? [new Paragraph({
      alignment: AlignmentType.CENTER,
      text: model.contact.links.map((link) => `${link.label}: ${link.url}`).join(' | ')
    })] : [])
  ];

  if (model.summary) {
    children.push(sectionHeading('Professional Summary'), new Paragraph(model.summary));
  }
  if (model.experience.length) {
    children.push(sectionHeading('Experience'));
    model.experience.forEach((item) => children.push(
      new Paragraph({
        children: [
          new TextRun({ bold: true, text: item.jobTitle }),
          new TextRun({ text: item.dateRange ? `\t${item.dateRange}` : '' })
        ],
        spacing: { before: 100, after: 30 }
      }),
      new Paragraph({ children: [new TextRun({ italics: true, text: [item.company, item.location].filter(Boolean).join(' | ') })] }),
      ...detailParagraphs(item.details)
    ));
  }
  if (model.credentials.length) {
    children.push(sectionHeading('Certifications & Licenses'));
    model.credentials.forEach((item) => children.push(
      new Paragraph({
        children: [new TextRun({ bold: true, text: item.name }), new TextRun({ text: item.dateRange ? `\t${item.dateRange}` : '' })],
        spacing: { before: 100, after: 30 }
      }),
      new Paragraph([item.type, item.issuer, item.credentialId].filter(Boolean).join(' | ')),
      ...detailParagraphs(item.details)
    ));
  }
  if (model.projects.length) {
    children.push(sectionHeading('Projects'));
    model.projects.forEach((item) => children.push(
      new Paragraph({
        children: [new TextRun({ bold: true, text: item.name }), new TextRun({ text: item.dateRange ? `\t${item.dateRange}` : '' })],
        spacing: { before: 100, after: 30 }
      }),
      new Paragraph({ children: [new TextRun({ italics: true, text: [item.role, item.organization, item.projectType].filter(Boolean).join(' | ') })] }),
      ...detailParagraphs(item.details)
    ));
  }
  if (model.education.length) {
    children.push(sectionHeading('Education'));
    model.education.forEach((item) => children.push(
      new Paragraph({
        children: [
          new TextRun({ bold: true, text: [item.credential, item.fieldOfStudy].filter(Boolean).join(' in ') }),
          new TextRun({ text: item.dateRange ? `\t${item.dateRange}` : '' })
        ],
        spacing: { before: 100, after: 30 }
      }),
      new Paragraph([item.provider, item.location, item.gpa ? `GPA ${item.gpa}` : ''].filter(Boolean).join(' | ')),
      ...detailParagraphs(item.details)
    ));
  }
  if (model.skills.length) {
    children.push(sectionHeading('Skills'), new Paragraph(model.skills.join(' • ')));
  }

  const document = new Document({
    sections: [{
      children,
      properties: {
        page: { margin: { bottom: 720, left: 720, right: 720, top: 720 } }
      }
    }],
    styles: {
      default: { document: { run: { font: 'Arial', size: 20 } } }
    }
  });
  return Packer.toBlob(document);
};

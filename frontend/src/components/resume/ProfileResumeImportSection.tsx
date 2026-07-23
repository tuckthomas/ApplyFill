import { useEffect, useRef, useState } from 'react';
import { StopCircle, Upload } from 'lucide-react';
import Button from '../ui/Button';
import Checkbox from '../ui/Checkbox';
import { importResumeWithPrivateAi } from '../../features/private-ai/privateAiClient';
import type { ResumeImportProgress } from '../../features/private-ai/privateAiClient';
import {
  createModelSafeResumeImportText,
  createProfileImportProposal,
  extractResumeContact,
  extractResumeText,
  mergeExtractedResumeContacts,
  renderResumePageImages,
  RESUME_IMPORT_ACCEPT
} from '../../features/profile/resumeImport';
import type { ProfileImportProposal, ProfileImportSelection } from '../../features/profile/resumeImport';
import type { RenderedResumePage } from '../../features/profile/resumeImport';

type ProfileResumeImportSectionProps = {
  onBusyChange: (isBusy: boolean) => void;
  onSelectionChange: (
    proposal: ProfileImportProposal | null,
    selection: ProfileImportSelection | null,
  ) => void;
};

type ContactKey = ProfileImportSelection['contact'] extends Set<infer Key> ? Key : never;

const toggleSet = <Value,>(current: Set<Value>, value: Value, checked: boolean) => {
  const next = new Set(current);
  if (checked) next.add(value); else next.delete(value);
  return next;
};

const createSelection = (proposal: ProfileImportProposal): ProfileImportSelection => {
  const contact = new Set<ContactKey>();
  (['firstName', 'middleName', 'lastName', 'email', 'phone'] as const).forEach((key) => {
    if (proposal.contact[key]) contact.add(key);
  });
  if (proposal.contact.webLinks.length) contact.add('webLinks');
  return {
    contact,
    education: new Set(proposal.education.map((item) => item.id)),
    experience: new Set(proposal.experience.map((item) => item.id)),
    credentials: new Set(proposal.credentials.map((item) => item.id)),
    projects: new Set(proposal.projects.map((item) => item.id)),
    skills: new Set(proposal.skills.map((item) => item.id))
  };
};

const formatElapsed = (seconds: number) => {
  seconds = Math.floor(seconds);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`;
};

const progressCeilings: Record<string, number> = {
  opening: 2,
  rendering: 3.9,
  uploading: 4.9,
  preparing: 14.9,
  reading: 39.9,
  organizing: 47.9,
  education: 59.9,
  experience: 71.9,
  credentials: 81.9,
  projects: 89.9,
  skills: 95.9,
  finishing: 99.9,
  complete: 100,
};

export default function ProfileResumeImportSection({ onBusyChange, onSelectionChange }: ProfileResumeImportSectionProps) {
  const [fileName, setFileName] = useState('');
  const [proposal, setProposal] = useState<ProfileImportProposal | null>(null);
  const [selection, setSelection] = useState<ProfileImportSelection | null>(null);
  const [status, setStatus] = useState('Choose a resume to begin.');
  const [progress, setProgress] = useState<ResumeImportProgress | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [displayClock, setDisplayClock] = useState(Date.now());
  const controllerRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef(Date.now());
  const progressReceivedAtRef = useRef(Date.now());
  const lastReportedProgressRef = useRef<Pick<ResumeImportProgress, 'progress' | 'stage'> | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);
  useEffect(() => {
    onSelectionChange(proposal, selection);
  }, [onSelectionChange, proposal, selection]);
  useEffect(() => {
    onBusyChange(isExtracting || isRunning);
  }, [isExtracting, isRunning, onBusyChange]);
  useEffect(() => () => onBusyChange(false), [onBusyChange]);
  useEffect(() => {
    if (!isExtracting && !isRunning) return;
    const timer = window.setInterval(() => setDisplayClock(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [isExtracting, isRunning]);

  const reportProgress = (update: ResumeImportProgress) => {
    const previous = lastReportedProgressRef.current;
    if (!previous || previous.stage !== update.stage || previous.progress !== update.progress) {
      progressReceivedAtRef.current = Date.now();
      lastReportedProgressRef.current = { progress: update.progress, stage: update.stage };
    }
    setProgress(update);
  };

  const parsePreparedResume = async (
    file: File,
    safeText: string,
    renderedPages: RenderedResumePage[],
    extractedContact: ProfileImportProposal['contact'],
  ) => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsRunning(true);
    reportProgress({
      elapsedSeconds: 0,
      message: 'Reading your resume…',
      progress: 4,
      stage: 'uploading',
    });
    setStatus('Reading your resume…');
    try {
      const result = await importResumeWithPrivateAi(
        file,
        safeText,
        renderedPages,
        controller.signal,
        (update) => {
          reportProgress(update);
          setStatus(update.message);
        },
      );
      const detectedContact = extractResumeContact(result.detectedText);
      const reviewedContact = mergeExtractedResumeContacts(extractedContact, detectedContact);
      const nextProposal = createProfileImportProposal(result.proposal, reviewedContact);
      setProposal(nextProposal);
      setSelection(createSelection(nextProposal));
      reportProgress({ elapsedSeconds: 0, message: 'Ready for review.', progress: 100, stage: 'complete' });
      const count = nextProposal.education.length + nextProposal.experience.length + nextProposal.credentials.length + nextProposal.projects.length + nextProposal.skills.length;
      setStatus(`${count} professional item${count === 1 ? '' : 's'} plus detected contact fields are ready for review. Nothing has been saved yet.`);
    } catch (error) {
      setProgress(null);
      setStatus(error instanceof DOMException && error.name === 'AbortError'
        ? 'Resume parsing cancelled. Your profile was not changed.'
        : error instanceof Error ? error.message : 'The resume could not be parsed. Your profile was not changed.');
    } finally {
      controllerRef.current = null;
      setIsRunning(false);
    }
  };

  const chooseFile = async (file: File | undefined) => {
    controllerRef.current?.abort();
    startedAtRef.current = Date.now();
    progressReceivedAtRef.current = startedAtRef.current;
    lastReportedProgressRef.current = null;
    setDisplayClock(startedAtRef.current);
    setFileName(file?.name ?? '');
    setProposal(null);
    setSelection(null);
    setProgress(null);
    if (!file) {
      setStatus('Choose a resume to begin.');
      return;
    }
    setIsExtracting(true);
    reportProgress({ elapsedSeconds: 0, message: `Opening ${file.name}…`, progress: 1, stage: 'opening' });
    setStatus(`Reading ${file.name}…`);
    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      let text = '';
      try {
        text = await extractResumeText(file);
      } catch (error) {
        if (!isPdf) throw error;
        // A scanned PDF may contain no selectable text. Its rendered pages still go
        // through the local vision/OCR path below.
      }
      reportProgress({ elapsedSeconds: 0, message: 'Preparing the resume pages…', progress: 3, stage: 'rendering' });
      const renderedPages = await renderResumePageImages(file, text);
      if (!renderedPages.length) throw new Error('This resume did not contain a readable page.');
      const extractedContact = extractResumeContact(text);
      const safeText = createModelSafeResumeImportText(text, extractedContact);
      setIsExtracting(false);
      await parsePreparedResume(file, safeText, renderedPages, extractedContact);
    } catch (error) {
      setProgress(null);
      setStatus(error instanceof Error ? error.message : 'The resume could not be read.');
    } finally {
      setIsExtracting(false);
    }
  };

  const selectedCount = selection ? selection.contact.size + selection.education.size + selection.experience.size + selection.credentials.size + selection.projects.size + selection.skills.size : 0;
  const displayedElapsedSeconds = Math.max(0, (displayClock - startedAtRef.current) / 1000);
  const reportedProgress = progress?.progress ?? 0;
  const progressCeiling = progress ? (progressCeilings[progress.stage] ?? reportedProgress) : reportedProgress;
  const secondsSinceProgress = Math.max(0, (displayClock - progressReceivedAtRef.current) / 1000);
  const displayedProgress = Math.min(
    progressCeiling,
    reportedProgress + (progressCeiling - reportedProgress) * (1 - Math.exp(-secondsSinceProgress / 6)),
  );
  const displayedProgressLabel = displayedProgress.toFixed(1);
  const contactRows = proposal ? ([
    { key: 'firstName', label: 'First name', value: proposal.contact.firstName },
    { key: 'middleName', label: 'Middle name or initial', value: proposal.contact.middleName },
    { key: 'lastName', label: 'Last name', value: proposal.contact.lastName },
    { key: 'email', label: 'Email', value: proposal.contact.email },
    { key: 'phone', label: 'Phone', value: proposal.contact.phone },
    { key: 'webLinks', label: 'Profile links', value: proposal.contact.webLinks.map((link) => link.url).join(', ') }
  ] satisfies Array<{ key: ContactKey; label: string; value: string }>).filter((row) => row.value) : [];

  return (
    <div className="page-stack profile-resume-import">
      <header className="profile-resume-import-header">
        <div>
          <h3 className="section-title">Import an Existing Resume</h3>
          <p className="section-copy">Start your Job Profile from a PDF, Word, or plain-text resume. You review everything before it is added.</p>
        </div>
      </header>

      <div className="profile-resume-import-picker">
        <label className="form-label" htmlFor="profile-resume-file">Existing Resume</label>
        <div className="profile-resume-file-control">
          <input
            accept={RESUME_IMPORT_ACCEPT}
            className="visually-hidden"
            disabled={isExtracting || isRunning}
            id="profile-resume-file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              void chooseFile(file);
            }}
            type="file"
          />
          <label aria-disabled={isExtracting || isRunning} className={`btn btn-secondary profile-resume-file-button${isExtracting || isRunning ? ' is-disabled' : ''}`} htmlFor="profile-resume-file">
            <Upload aria-hidden="true" size={17} /> {fileName ? 'Choose a Different Resume' : 'Choose Resume'}
          </label>
          <span className={`profile-resume-file-display${fileName ? ' has-file' : ''}`}>{fileName || 'No resume selected'}</span>
        </div>
        <p className="field-hint">PDF, Word (.docx), or text file, up to 10 MB.</p>
      </div>

      {progress && (isExtracting || isRunning) ? (
        <div className="profile-resume-import-progress">
          <div
            aria-label="Resume reading progress"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={displayedProgress}
            aria-valuetext={`${progress.message} ${displayedProgressLabel}% complete, ${formatElapsed(displayedElapsedSeconds)} elapsed`}
            className="local-ai-progress"
            role="progressbar"
          >
            <span style={{ width: `${displayedProgress}%` }} />
          </div>
          <div className="profile-resume-import-progress-copy" role="status" aria-live="polite">
            <strong>{progress.message}</strong>
            <span>{displayedProgressLabel}% · {formatElapsed(displayedElapsedSeconds)} elapsed</span>
          </div>
          {isRunning ? <Button onClick={() => controllerRef.current?.abort()}><StopCircle aria-hidden="true" size={17} /> Cancel</Button> : null}
        </div>
      ) : (
        <p className="field-hint local-ai-status" role="status" aria-live="polite">{status}</p>
      )}

      {proposal && selection ? (
        <section className="profile-import-review" aria-labelledby="profile-import-review-title">
          <div className="local-ai-review-header">
            <div>
              <h4 id="profile-import-review-title">Review Proposed Profile Data</h4>
              <p className="field-hint">Keep the information you want checked. Checked items are added when you continue, while existing non-empty contact fields and duplicate entries are preserved.</p>
            </div>
            <strong>{selectedCount} selected</strong>
          </div>

          {contactRows.length ? (
            <div className="profile-import-group">
              <h5>Contact fields detected from the resume</h5>
              {contactRows.map((row) => <Checkbox checked={selection.contact.has(row.key)} key={row.key} label={`${row.label}: ${row.value}`} onChange={(event) => setSelection((current) => current ? { ...current, contact: toggleSet(current.contact, row.key, event.target.checked) } : current)} />)}
            </div>
          ) : null}

          {proposal.experience.length ? <div className="profile-import-group"><h5>Work experience</h5>{proposal.experience.map((item) => <Checkbox checked={selection.experience.has(item.id)} key={item.id} label={`${item.jobTitle || 'Role not identified'} — ${item.company || 'Company not identified'}${item.startDate ? ` (${item.startDate}–${item.isCurrentJob ? 'Present' : item.endDate || 'unknown'})` : ''}`} onChange={(event) => setSelection((current) => current ? { ...current, experience: toggleSet(current.experience, item.id, event.target.checked) } : current)} />)}</div> : null}
          {proposal.education.length ? <div className="profile-import-group"><h5>Education</h5>{proposal.education.map((item) => <Checkbox checked={selection.education.has(item.id)} key={item.id} label={`${item.level?.label ?? 'Education'} — ${item.provider}${item.fieldOfStudy ? `, ${item.fieldOfStudy}` : ''}`} onChange={(event) => setSelection((current) => current ? { ...current, education: toggleSet(current.education, item.id, event.target.checked) } : current)} />)}</div> : null}
          {proposal.credentials.length ? <div className="profile-import-group"><h5>Certifications &amp; Licenses</h5>{proposal.credentials.map((item) => <Checkbox checked={selection.credentials.has(item.id)} key={item.id} label={`${item.name} — ${item.issuer || item.type}`} onChange={(event) => setSelection((current) => current ? { ...current, credentials: toggleSet(current.credentials, item.id, event.target.checked) } : current)} />)}</div> : null}
          {proposal.projects.length ? <div className="profile-import-group"><h5>Projects</h5>{proposal.projects.map((item) => <Checkbox checked={selection.projects.has(item.id)} key={item.id} label={`${item.name}${item.role ? ` — ${item.role}` : ''}`} onChange={(event) => setSelection((current) => current ? { ...current, projects: toggleSet(current.projects, item.id, event.target.checked) } : current)} />)}</div> : null}
          {proposal.skills.length ? <div className="profile-import-group"><h5>Skills</h5><div className="profile-import-skill-grid">{proposal.skills.map((item) => <Checkbox checked={selection.skills.has(item.id)} key={item.id} label={item.name} onChange={(event) => setSelection((current) => current ? { ...current, skills: toggleSet(current.skills, item.id, event.target.checked) } : current)} />)}</div></div> : null}
        </section>
      ) : null}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Sparkles, StopCircle, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from '../ui/Button';
import Checkbox from '../ui/Checkbox';
import type { LocalAiRuntime } from '../../features/local-ai/runtime/types';
import { runProfileImportWorkflow } from '../../features/local-ai/workflows/profileImport';
import {
  createModelSafeResumeImportText,
  createProfileImportProposal,
  extractResumeContact,
  extractResumeText,
  RESUME_IMPORT_ACCEPT
} from '../../features/profile/resumeImport';
import type { ProfileImportProposal, ProfileImportSelection } from '../../features/profile/resumeImport';

type ProfileResumeImportSectionProps = {
  onApply: (proposal: ProfileImportProposal, selection: ProfileImportSelection) => void;
  runtime: LocalAiRuntime;
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
    projects: new Set(proposal.projects.map((item) => item.id)),
    skills: new Set(proposal.skills.map((item) => item.id))
  };
};

export default function ProfileResumeImportSection({ onApply, runtime }: ProfileResumeImportSectionProps) {
  const [fileName, setFileName] = useState('');
  const [modelText, setModelText] = useState('');
  const [contact, setContact] = useState<ProfileImportProposal['contact'] | null>(null);
  const [proposal, setProposal] = useState<ProfileImportProposal | null>(null);
  const [selection, setSelection] = useState<ProfileImportSelection | null>(null);
  const [status, setStatus] = useState('Choose a resume to begin. The file is read in this browser and is not uploaded.');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isApplied, setIsApplied] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const chooseFile = async (file: File | undefined) => {
    controllerRef.current?.abort();
    setFileName(file?.name ?? '');
    setModelText('');
    setContact(null);
    setProposal(null);
    setSelection(null);
    setIsApplied(false);
    if (!file) {
      setStatus('Choose a resume to begin. The file is read in this browser and is not uploaded.');
      return;
    }
    setIsExtracting(true);
    setStatus(`Reading ${file.name} locally…`);
    try {
      const text = await extractResumeText(file);
      const extractedContact = extractResumeContact(text);
      const safeText = createModelSafeResumeImportText(text, extractedContact);
      setContact(extractedContact);
      setModelText(safeText);
      setStatus(runtime.snapshot.state === 'ready'
        ? 'Your resume is ready. Choose Read Resume with Private AI to continue.'
        : 'Your resume is ready. Set up Private AI once, then return and choose this file again.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The resume could not be read.');
    } finally {
      setIsExtracting(false);
    }
  };

  const parseResume = async () => {
    if (!contact || !modelText || isRunning) return;
    if (runtime.snapshot.state !== 'ready') {
      setStatus('Set up Private AI in Settings before reading this resume.');
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsRunning(true);
    setProposal(null);
    setSelection(null);
    setStatus('Preparing your resume privately on this computer…');
    try {
      const output = await runProfileImportWorkflow(runtime, modelText, {
        signal: controller.signal,
        onProgress: (progress) => setStatus(progress.message)
      });
      const nextProposal = createProfileImportProposal(output, contact);
      setProposal(nextProposal);
      setSelection(createSelection(nextProposal));
      const count = nextProposal.education.length + nextProposal.experience.length + nextProposal.projects.length + nextProposal.skills.length;
      setStatus(`${count} professional item${count === 1 ? '' : 's'} plus detected contact fields are ready for review. Nothing has been saved yet.`);
    } catch (error) {
      setStatus(error instanceof DOMException && error.name === 'AbortError'
        ? 'Local resume parsing cancelled. Your profile was not changed.'
        : error instanceof Error ? error.message : 'The resume could not be parsed. Your profile was not changed.');
    } finally {
      controllerRef.current = null;
      setIsRunning(false);
    }
  };

  const selectedCount = selection ? selection.contact.size + selection.education.size + selection.experience.size + selection.projects.size + selection.skills.size : 0;
  const contactRows = proposal ? ([
    { key: 'firstName', label: 'First name', value: proposal.contact.firstName },
    { key: 'middleName', label: 'Middle name', value: proposal.contact.middleName },
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

      <div className="local-ai-privacy-note">
        <strong>Your resume stays private:</strong> it is read only in this tab and is never stored or uploaded. ApplyFill removes contact and sensitive details before Private AI reads the work and education sections.
      </div>

      <div className="profile-resume-import-picker">
        <label className="form-label" htmlFor="profile-resume-file">Existing Resume</label>
        <div className="profile-resume-file-control">
          <input
            accept={RESUME_IMPORT_ACCEPT}
            className="visually-hidden"
            disabled={isExtracting || isRunning}
            id="profile-resume-file"
            onChange={(event) => void chooseFile(event.target.files?.[0])}
            type="file"
          />
          <label aria-disabled={isExtracting || isRunning} className={`btn btn-secondary profile-resume-file-button${isExtracting || isRunning ? ' is-disabled' : ''}`} htmlFor="profile-resume-file">
            <Upload aria-hidden="true" size={17} /> {fileName ? 'Choose a Different Resume' : 'Choose Resume'}
          </label>
          <span className={`profile-resume-file-display${fileName ? ' has-file' : ''}`}>{fileName || 'No resume selected'}</span>
        </div>
        <p className="field-hint">PDF, Word (.docx), or text file, up to 10 MB. Image-only scans are not supported yet.</p>
      </div>

      <div className="resume-builder-actions">
        <Button disabled={!modelText || isExtracting || isRunning || runtime.snapshot.state !== 'ready'} onClick={() => void parseResume()} variant="primary">
          <Sparkles aria-hidden="true" size={17} /> {isRunning ? 'Reading Resume…' : 'Read Resume with Private AI'}
        </Button>
        {isRunning ? <Button onClick={() => controllerRef.current?.abort()}><StopCircle aria-hidden="true" size={17} /> Cancel</Button> : null}
        {runtime.snapshot.state !== 'ready' && !isRunning ? <Link className="btn btn-secondary" to="/settings">Set Up Private AI</Link> : null}
      </div>

      <p className="field-hint local-ai-status" role="status" aria-live="polite">{status}</p>
      {runtime.snapshot.state !== 'ready' && !isRunning ? <p className="field-hint">Private AI must be set up once before it can read a resume. The selected file is not retained when you leave this page.</p> : null}

      {proposal && selection ? (
        <section className="profile-import-review" aria-labelledby="profile-import-review-title">
          <div className="local-ai-review-header">
            <div>
              <h4 id="profile-import-review-title">Review Proposed Profile Data</h4>
              <p className="field-hint">Existing non-empty contact fields and duplicate entries will not be overwritten. Verify dates and descriptions before continuing.</p>
            </div>
            <Button disabled={!selectedCount || isApplied} onClick={() => {
              onApply(proposal, selection);
              setIsApplied(true);
              setStatus(`${selectedCount} selected proposal${selectedCount === 1 ? '' : 's'} added to the unsaved profile. Continue through each section to verify them, then finish to save.`);
            }} variant="primary">{isApplied ? 'Added to Profile' : `Add Selected (${selectedCount})`}</Button>
          </div>

          {contactRows.length ? (
            <div className="profile-import-group">
              <h5>Contact fields detected without AI</h5>
              {contactRows.map((row) => <Checkbox checked={selection.contact.has(row.key)} key={row.key} label={`${row.label}: ${row.value}`} onChange={(event) => setSelection((current) => current ? { ...current, contact: toggleSet(current.contact, row.key, event.target.checked) } : current)} />)}
            </div>
          ) : null}

          {proposal.experience.length ? <div className="profile-import-group"><h5>Work experience</h5>{proposal.experience.map((item) => <Checkbox checked={selection.experience.has(item.id)} key={item.id} label={`${item.jobTitle || 'Role not identified'} — ${item.company || 'Company not identified'}${item.startDate ? ` (${item.startDate}–${item.isCurrentJob ? 'Present' : item.endDate || 'unknown'})` : ''}`} onChange={(event) => setSelection((current) => current ? { ...current, experience: toggleSet(current.experience, item.id, event.target.checked) } : current)} />)}</div> : null}
          {proposal.education.length ? <div className="profile-import-group"><h5>Education</h5>{proposal.education.map((item) => <Checkbox checked={selection.education.has(item.id)} key={item.id} label={`${item.level?.label ?? 'Education'} — ${item.provider}${item.fieldOfStudy ? `, ${item.fieldOfStudy}` : ''}`} onChange={(event) => setSelection((current) => current ? { ...current, education: toggleSet(current.education, item.id, event.target.checked) } : current)} />)}</div> : null}
          {proposal.projects.length ? <div className="profile-import-group"><h5>Projects</h5>{proposal.projects.map((item) => <Checkbox checked={selection.projects.has(item.id)} key={item.id} label={`${item.name}${item.role ? ` — ${item.role}` : ''}`} onChange={(event) => setSelection((current) => current ? { ...current, projects: toggleSet(current.projects, item.id, event.target.checked) } : current)} />)}</div> : null}
          {proposal.skills.length ? <div className="profile-import-group"><h5>Skills</h5><div className="profile-import-skill-grid">{proposal.skills.map((item) => <Checkbox checked={selection.skills.has(item.id)} key={item.id} label={item.name} onChange={(event) => setSelection((current) => current ? { ...current, skills: toggleSet(current.skills, item.id, event.target.checked) } : current)} />)}</div></div> : null}
        </section>
      ) : null}
    </div>
  );
}

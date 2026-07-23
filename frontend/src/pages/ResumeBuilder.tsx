import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { PDFViewer, usePDF } from '@react-pdf/renderer';
import { ArrowLeft, BrainCircuit, Clipboard, Download, FileJson, FileText, Save, Upload } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import ResumePdfDocument from '../components/resume/ResumePdfDocument';
import LocalAiTailoringPanel from '../components/resume/LocalAiTailoringPanel';
import Button from '../components/ui/Button';
import Checkbox from '../components/ui/Checkbox';
import { loadProfileDocument } from '../features/profile/profileBuilder';
import type { LocalProfileDocument } from '../features/profile/profileBuilder';
import {
  cloneImportedResume,
  createPortableResumeDocument,
  createResumeDraft,
  loadResumeCollection,
  parsePortableResumeDocument,
  saveResumeDraft
} from '../features/resume/resumeDocument';
import type { LocalResumeDraft, ResumeSelections } from '../features/resume/resumeDocument';
import { createResumeDocxBlob, downloadBlob, resumeFileName } from '../features/resume/resumeDownloads';
import { saveResumeArtifact } from '../features/resume/resumeArtifacts';
import { createResumeSafeViewModel } from '../features/resume/resumeExport';

const EMPTY_MODEL = {
  contact: { email: '', links: [], location: '', name: '', phone: '' },
  education: [], experience: [], projects: [], skills: [], summary: '', title: ''
};

export default function ResumeBuilder() {
  const navigate = useNavigate();
  const { resumeId } = useParams();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<LocalProfileDocument | null>(null);
  const [resume, setResume] = useState<LocalResumeDraft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [showLocalAi, setShowLocalAi] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    Promise.all([loadProfileDocument(), loadResumeCollection()])
      .then(([loadedProfile, collection]) => {
        if (!isCurrent) return;
        setProfile(loadedProfile);
        if (!loadedProfile) return;
        const existing = resumeId ? collection.resumes.find((item) => item.id === resumeId) : undefined;
        if (resumeId && !existing) {
          setMessage('That saved resume could not be found. A new draft has been opened instead.');
        }
        setResume(existing ?? createResumeDraft(loadedProfile));
      })
      .catch(() => { if (isCurrent) setMessage('Resume data could not be loaded from ApplyFill.'); })
      .finally(() => { if (isCurrent) setIsLoading(false); });
    return () => { isCurrent = false; };
  }, [resumeId]);

  const model = useMemo(
    () => profile && resume ? createResumeSafeViewModel(profile, resume) : EMPTY_MODEL,
    [profile, resume]
  );
  const pdfDocument = useMemo(() => <ResumePdfDocument model={model} />, [model]);
  const [pdfInstance, updatePdfInstance] = usePDF({ document: pdfDocument });

  useEffect(() => {
    updatePdfInstance(pdfDocument);
  }, [pdfDocument, updatePdfInstance]);

  useEffect(() => {
    let isCurrent = true;
    if (!pdfInstance.blob) {
      setPageCount(null);
      return () => { isCurrent = false; };
    }
    pdfInstance.blob.arrayBuffer()
      .then(async (bytes) => (await import('pdf-lib')).PDFDocument.load(bytes))
      .then((document) => { if (isCurrent) setPageCount(document.getPageCount()); })
      .catch(() => { if (isCurrent) setPageCount(null); });
    return () => { isCurrent = false; };
  }, [pdfInstance.blob]);

  const updateResume = <Key extends keyof LocalResumeDraft>(key: Key, value: LocalResumeDraft[Key]) => {
    setResume((current) => current ? { ...current, [key]: value } : current);
  };

  const toggleSelection = (key: keyof ResumeSelections, id: number, checked: boolean) => {
    setResume((current) => {
      if (!current) return current;
      const selection = new Set(current.selections[key]);
      if (checked) selection.add(id); else selection.delete(id);
      return { ...current, selections: { ...current.selections, [key]: [...selection] } };
    });
  };

  const saveDraft = async () => {
    if (!resume) return;
    if (!resume.title.trim()) {
      setMessage('Give this resume a title before saving it.');
      return;
    }
    if (resume.targetJobUrl.trim()) {
      try {
        const url = new URL(resume.targetJobUrl);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported URL');
      } catch {
        setMessage('Enter a valid HTTP or HTTPS target job URL.');
        return;
      }
    }
    try {
      const saved = await saveResumeDraft({
        ...resume,
        targetJobUrl: resume.targetJobUrl.trim(),
        targetRole: resume.targetRole.trim(),
        title: resume.title.trim()
      });
      setResume(saved);
      navigate(`/resumes/builder/${saved.id}`, { replace: true });
      setMessage('Resume draft saved in ApplyFill.');
    } catch {
      setMessage('The resume draft could not be saved.');
    }
  };

  const copyJson = async () => {
    if (!resume) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(createPortableResumeDocument(resume), null, 2));
      setMessage('Resume JSON copied to your clipboard.');
    } catch {
      setMessage('The browser did not allow clipboard access.');
    }
  };

  const downloadJson = () => {
    if (!resume) return;
    const json = JSON.stringify(createPortableResumeDocument(resume), null, 2);
    downloadBlob(new Blob([json], { type: 'application/json' }), resumeFileName(resume.title, 'json'));
    setMessage('Resume JSON downloaded.');
  };

  const importJson = async (file: File | undefined) => {
    if (!file) return;
    try {
      const imported = cloneImportedResume(parsePortableResumeDocument(await file.text()));
      const saved = await saveResumeDraft(imported);
      setResume(saved);
      navigate(`/resumes/builder/${saved.id}`, { replace: true });
      setMessage('Resume JSON imported as a new local draft.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The resume JSON could not be imported.');
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const downloadPdf = () => {
    if (!resume || !pdfInstance.blob) return;
    downloadBlob(pdfInstance.blob, resumeFileName(resume.title, 'pdf'));
    setMessage('PDF downloaded directly from this browser.');
  };

  const saveForApplications = async () => {
    if (!resume || !pdfInstance.blob) return;
    try {
      setMessage('Saving this reviewed PDF for the Browser Agent...');
      await saveResumeArtifact(resume.id, pdfInstance.blob, resumeFileName(resume.title, 'pdf'));
      setMessage('This PDF is ready for the Browser Agent to upload when an application asks for your resume.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The PDF could not be saved for applications. Save the resume draft and try again.');
    }
  };

  const downloadDocx = async () => {
    if (!resume) return;
    try {
      setMessage('Generating the DOCX compatibility export in this browser...');
      const blob = await createResumeDocxBlob(model);
      downloadBlob(blob, resumeFileName(resume.title, 'docx'));
      setMessage('DOCX compatibility export downloaded.');
    } catch {
      setMessage('The DOCX export could not be generated.');
    }
  };

  if (isLoading) return <p className="section-copy" role="status">Loading local resume data...</p>;

  if (!profile || !resume) {
    return (
      <div className="page-stack">
        <header className="page-header">
          <div>
            <h2 className="page-title">Resume Builder</h2>
            <p className="page-copy">Create your Job Profile before building a resume from it.</p>
          </div>
        </header>
        <section className="surface-panel empty-state" aria-labelledby="missing-profile-title">
          <FileText size={52} strokeWidth={1.4} aria-hidden="true" />
          <h3 className="section-title" id="missing-profile-title">A local profile is required</h3>
          <p className="section-copy">Resume exports use only the resume-safe fields you select from your saved Job Profile.</p>
          <Button onClick={() => navigate('/job-profile/builder')} variant="primary">Build Job Profile</Button>
        </section>
      </div>
    );
  }

  const savedExperience = profile.data.experience.filter((entry) => entry.isSaved);
  const savedEducation = profile.data.education.filter((entry) => entry.isSaved);
  const savedProjects = profile.data.projects.filter((entry) => entry.isSaved);

  return (
    <div className="page-stack resume-builder-page">
      <button className="icon-button" type="button" onClick={() => navigate('/resumes')} aria-label="Back to Resume Builder" data-tooltip="Back to Resume Builder">
        <ArrowLeft size={22} aria-hidden="true" />
      </button>
      <header className="page-header">
        <div>
          <h2 className="page-title">Resume Builder</h2>
          <p className="page-copy">Tailor a local resume and generate PDF, DOCX, or JSON without uploading it.</p>
        </div>
        <span className="status-pill">Stored on this computer</span>
      </header>

      {message ? <p className="profile-data-message" role="status">{message}</p> : null}
      {pageCount && pageCount > 2 ? (
        <p className="field-error" role="alert">The current PDF is {pageCount} pages. Review the selected content before submitting it.</p>
      ) : null}

      {showLocalAi ? (
        <LocalAiTailoringPanel
          onClose={() => setShowLocalAi(false)}
          onResumeChange={setResume}
          profile={profile}
          resume={resume}
        />
      ) : (
        <div className="resume-local-ai-entry">
          <Button onClick={() => setShowLocalAi(true)} variant="primary"><BrainCircuit aria-hidden="true" size={18} /> Tailor with Private AI</Button>
          <p className="field-hint">Private AI runs locally only when you start it and receives only the professional sections you selected below.</p>
        </div>
      )}

      <div className="resume-builder-grid">
        <section className="surface-panel resume-builder-controls" aria-labelledby="resume-details-title">
          <div>
            <h3 id="resume-details-title" className="section-title">Resume Details</h3>
            <p className="section-copy">Drafts and generated files remain on this device unless you download or share them.</p>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="resume-title">Resume Title *</label>
            <input id="resume-title" type="text" className="form-input" value={resume.title} onChange={(event) => updateResume('title', event.target.value)} placeholder="e.g. Senior Software Engineer" />
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="target-role">Target Role</label>
              <input id="target-role" type="text" className="form-input" value={resume.targetRole} onChange={(event) => updateResume('targetRole', event.target.value)} placeholder="e.g. Senior Software Engineer" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="target-job-url">Target Job URL</label>
              <input id="target-job-url" type="url" className="form-input" value={resume.targetJobUrl} onChange={(event) => updateResume('targetJobUrl', event.target.value)} placeholder="https://..." />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="resume-summary">Professional Summary</label>
            <textarea id="resume-summary" className="form-input resume-summary-input" value={resume.summary} onChange={(event) => updateResume('summary', event.target.value)} placeholder="Write a concise summary tailored to this role." />
          </div>

          <div className="resume-content-selections">
            <h3 className="section-title">Select Resume Content</h3>
            <p className="section-copy">Application-only information and reasons for leaving are never available to the renderer.</p>

            <fieldset className="resume-selection-group">
              <legend>Experience</legend>
              {savedExperience.length ? savedExperience.map((entry) => (
                <Checkbox key={entry.id} checked={resume.selections.experienceIds.includes(entry.id)} onChange={(event) => toggleSelection('experienceIds', entry.id, event.target.checked)} label={<span><strong>{entry.jobTitle || 'Untitled role'}</strong><small>{entry.company}</small></span>} />
              )) : <p className="field-hint">No saved experience entries.</p>}
            </fieldset>
            <fieldset className="resume-selection-group">
              <legend>Projects</legend>
              {savedProjects.length ? savedProjects.map((entry) => (
                <Checkbox key={entry.id} checked={resume.selections.projectIds.includes(entry.id)} onChange={(event) => toggleSelection('projectIds', entry.id, event.target.checked)} label={<span><strong>{entry.name || 'Untitled project'}</strong><small>{entry.role || entry.organization}</small></span>} />
              )) : <p className="field-hint">No saved project entries.</p>}
            </fieldset>
            <fieldset className="resume-selection-group">
              <legend>Education</legend>
              {savedEducation.length ? savedEducation.map((entry) => (
                <Checkbox key={entry.id} checked={resume.selections.educationIds.includes(entry.id)} onChange={(event) => toggleSelection('educationIds', entry.id, event.target.checked)} label={<span><strong>{entry.provider || 'Untitled education'}</strong><small>{entry.level?.label}</small></span>} />
              )) : <p className="field-hint">No saved education entries.</p>}
            </fieldset>
            <fieldset className="resume-selection-group">
              <legend>Skills</legend>
              {profile.data.skills.length ? profile.data.skills.map((entry) => (
                <Checkbox key={entry.id} checked={resume.selections.skillIds.includes(entry.id)} onChange={(event) => toggleSelection('skillIds', entry.id, event.target.checked)} label={entry.name} />
              )) : <p className="field-hint">No saved skills.</p>}
            </fieldset>
          </div>

          <div className="resume-builder-actions" aria-label="Resume controls">
            <Button onClick={() => void saveDraft()} variant="primary"><Save size={17} aria-hidden="true" /> Save Draft</Button>
            <Button disabled={!pdfInstance.blob || pdfInstance.loading} onClick={() => void saveForApplications()}><Upload size={17} aria-hidden="true" /> Save for Applications</Button>
            <Button disabled={!pdfInstance.blob || pdfInstance.loading} onClick={downloadPdf}><Download size={17} aria-hidden="true" /> PDF</Button>
            <Button onClick={() => void downloadDocx()}><FileText size={17} aria-hidden="true" /> DOCX</Button>
            <Button onClick={downloadJson}><FileJson size={17} aria-hidden="true" /> JSON</Button>
            <Button onClick={() => void copyJson()}><Clipboard size={17} aria-hidden="true" /> Copy JSON</Button>
            <Button onClick={() => importInputRef.current?.click()}><Upload size={17} aria-hidden="true" /> Import JSON</Button>
            <input ref={importInputRef} aria-hidden="true" className="visually-hidden" type="file" accept="application/json,.json" onChange={(event: ChangeEvent<HTMLInputElement>) => void importJson(event.target.files?.[0])} tabIndex={-1} />
          </div>
        </section>

        <section className="surface-panel resume-preview-panel" aria-labelledby="preview-title">
          <div className="resume-preview-header">
            <div>
              <h3 id="preview-title" className="section-title">Live PDF Preview</h3>
              <p className="section-copy">The preview and PDF download use the same client-side document component.</p>
            </div>
            <span className="status-pill">{pageCount ? `${pageCount} page${pageCount === 1 ? '' : 's'}` : 'Rendering'}</span>
          </div>
          {pdfInstance.error ? (
            <div className="empty-state"><p className="field-error">The PDF preview could not be rendered.</p></div>
          ) : (
            <PDFViewer className="resume-pdf-viewer" showToolbar>{pdfDocument}</PDFViewer>
          )}
        </section>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { BrainCircuit, RotateCcw, Sparkles, StopCircle, Undo2, X } from 'lucide-react';
import Button from '../ui/Button';
import Checkbox from '../ui/Checkbox';
import type { LocalProfileDocument } from '../../features/profile/profileBuilder';
import type { LocalResumeDraft } from '../../features/resume/resumeDocument';
import {
  applyResumeAiPatches,
  createAiSafeResumeSnapshot,
  prepareResumeForAiPatches,
  validateResumeAiPatch
} from '../../features/local-ai/contracts';
import type { ResumeAiPatch } from '../../features/local-ai/contracts';
import { tailorResumeWithPrivateAi } from '../../features/private-ai/privateAiClient';

type LocalAiTailoringPanelProps = {
  onClose: () => void;
  onResumeChange: (resume: LocalResumeDraft) => void;
  profile: LocalProfileDocument;
  resume: LocalResumeDraft;
};

type ReviewPatch = ResumeAiPatch & { afterDraft: string };

export default function LocalAiTailoringPanel({ onClose, onResumeChange, profile, resume }: LocalAiTailoringPanelProps) {
  const [jobText, setJobText] = useState('');
  const [patches, setPatches] = useState<ReviewPatch[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [analysis, setAnalysis] = useState<{ employer: string; role: string; requiredSkills: string[]; preferredSkills: string[]; responsibilities: string[]; keywords: string[] } | null>(null);
  const [relevance, setRelevance] = useState<Array<{ opaqueId: string; reason: string; score: number }>>([]);
  const [generatedRevision, setGeneratedRevision] = useState('');
  const [status, setStatus] = useState('Nothing is sent to Private AI until you start.');
  const [isRunning, setIsRunning] = useState(false);
  const [undoResume, setUndoResume] = useState<LocalResumeDraft | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const snapshot = useMemo(() => createAiSafeResumeSnapshot(profile, resume), [profile, resume]);
  const isStale = Boolean(generatedRevision && generatedRevision !== snapshot.sourceRevision);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const generate = async () => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsRunning(true);
    setPatches([]);
    setAnalysis(null);
    setRelevance([]);
    setStatus('Preparing an allowlisted, contact-free snapshot…');
    try {
      setStatus('Private AI is reviewing the approved professional sections…');
      const result = await tailorResumeWithPrivateAi(profile, resume, jobText, controller.signal);
      const review = result.patches.map((patch) => ({ ...patch, afterDraft: patch.after }));
      setAnalysis(result.analysis);
      setRelevance([...result.relevance.items].sort((left, right) => right.score - left.score));
      setPatches(review);
      setSelected(new Set(review.map((patch) => patch.patchId)));
      setGeneratedRevision(result.sourceRevision);
      setStatus(review.length
        ? `${review.length} suggestion${review.length === 1 ? '' : 's'} ready for review. Nothing has changed yet.`
        : 'Analysis completed, but Private AI proposed no supported changes.');
    } catch (error) {
      setStatus(error instanceof DOMException && error.name === 'AbortError'
        ? 'Private AI cancelled. Your resume was not changed.'
        : error instanceof Error ? error.message : 'Private AI failed. Your resume was not changed.');
    } finally {
      controllerRef.current = null;
      setIsRunning(false);
    }
  };

  const apply = (selectedPatches: ReviewPatch[]) => {
    if (isStale) {
      setStatus('These suggestions are stale because the resume or profile changed. Regenerate before accepting them.');
      return;
    }
    try {
      const approved = selectedPatches.map(({ afterDraft, ...patch }) => validateResumeAiPatch({ ...patch, after: afterDraft }, snapshot));
      const prepared = prepareResumeForAiPatches(resume, snapshot);
      const next = applyResumeAiPatches(prepared, approved);
      setUndoResume(resume);
      onResumeChange(next);
      const acceptedSummary = approved.some((patch) => patch.target === 'summary');
      setPatches((current) => current.filter((patch) => !approved.some((item) => item.patchId === patch.patchId)
        && !(acceptedSummary && patch.target === 'summary')));
      setSelected((current) => new Set([...current].filter((id) => !approved.some((item) => item.patchId === id))));
      setGeneratedRevision(createAiSafeResumeSnapshot(profile, next).sourceRevision);
      setStatus(`${approved.length} suggestion${approved.length === 1 ? '' : 's'} applied to this unsaved draft.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The selected suggestions could not be applied.');
    }
  };

  return (
    <section className="surface-panel local-ai-tailoring-panel" aria-labelledby="local-ai-tailoring-title">
      <div className="local-ai-panel-header">
        <div className="settings-preferences-heading">
          <BrainCircuit aria-hidden="true" size={24} />
          <div>
            <h3 className="section-title" id="local-ai-tailoring-title">Tailor with Private AI</h3>
            <p className="section-copy">Runs through ApplyFill on this computer. Suggestions never change your resume until you accept them.</p>
          </div>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close Private AI tailoring" data-tooltip="Close"><X aria-hidden="true" size={20} /></button>
      </div>

      <div className="local-ai-privacy-note">
        <strong>Excluded from the model:</strong> name, contact details, addresses, profile links, government IDs, authorization and sponsorship answers, demographics, reasons for leaving, supervisors, and company phone numbers.
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="local-ai-job-posting">Job posting text *</label>
        <textarea
          className="form-input local-ai-job-input"
          id="local-ai-job-posting"
          maxLength={24_000}
          onChange={(event) => setJobText(event.target.value)}
          placeholder="Paste the job posting text. Links are not fetched."
          value={jobText}
        />
        <p className="field-hint">The posting is treated as untrusted quoted text. Instructions inside it cannot change AI permissions or request additional profile fields.</p>
      </div>

      <details className="local-ai-preflight" open>
        <summary>Review the exact source sections shared locally</summary>
        <dl className="local-ai-preflight-grid">
          <div><dt>Summary</dt><dd>{snapshot.summary ? 'Included' : 'Empty'}</dd></div>
          <div><dt>Experience</dt><dd>{snapshot.experience.length} selected</dd></div>
          <div><dt>Projects</dt><dd>{snapshot.projects.length} selected</dd></div>
          <div><dt>Education</dt><dd>{snapshot.education.length} selected</dd></div>
          <div><dt>Skills</dt><dd>{snapshot.skills.length} selected</dd></div>
        </dl>
        <p className="field-hint">Only the sections selected under “Select Resume Content” are included. Change those checkboxes before generation to narrow the snapshot.</p>
      </details>

      <div className="resume-builder-actions">
        <Button disabled={isRunning || !jobText.trim()} onClick={() => void generate()} variant="primary">
          <Sparkles aria-hidden="true" size={17} /> {patches.length ? 'Regenerate' : 'Analyze & Suggest'}
        </Button>
        {isRunning ? <Button onClick={() => controllerRef.current?.abort()}><StopCircle aria-hidden="true" size={17} /> Cancel</Button> : null}
        {patches.length ? <Button onClick={() => { setPatches([]); setSelected(new Set()); setAnalysis(null); setRelevance([]); setStatus('Suggestions rejected. Your resume was not changed.'); }}><RotateCcw aria-hidden="true" size={17} /> Reject All</Button> : null}
        {undoResume ? <Button onClick={() => { onResumeChange(undoResume); setUndoResume(null); setStatus('The last accepted AI patch group was undone.'); }}><Undo2 aria-hidden="true" size={17} /> Undo Accepted Changes</Button> : null}
      </div>

      <p className="field-hint local-ai-status" role="status" aria-live="polite">{status}</p>
      {isStale ? <p className="field-error" role="alert">The source changed after generation. These suggestions cannot be accepted until you regenerate them.</p> : null}

      {analysis ? (
        <section className="local-ai-analysis" aria-labelledby="local-ai-analysis-title">
          <h4 id="local-ai-analysis-title">Private Job Analysis</h4>
          <p><strong>{analysis.role || 'Role not identified'}</strong>{analysis.employer ? ` at ${analysis.employer}` : ''}</p>
          <p><strong>Required skills:</strong> {analysis.requiredSkills.join(', ') || 'None identified'}</p>
          <p><strong>Preferred skills:</strong> {analysis.preferredSkills.join(', ') || 'None identified'}</p>
          <p><strong>Keywords:</strong> {analysis.keywords.join(', ') || 'None identified'}</p>
          {relevance.length ? <ol className="local-ai-relevance-list" aria-label="Selected content ranked by relevance">{relevance.map((item) => <li key={item.opaqueId}><strong>{Math.round(item.score * 100)}%</strong> {item.opaqueId}: {item.reason}</li>)}</ol> : null}
        </section>
      ) : null}

      {patches.length ? (
        <section className="local-ai-review" aria-labelledby="local-ai-review-title">
          <div className="local-ai-review-header">
            <div><h4 id="local-ai-review-title">Review Proposed Changes</h4><p className="field-hint">Edit any proposed text before accepting it. Unsupported facts and numeric claims are blocked.</p></div>
            <Button disabled={!selected.size || isStale} onClick={() => apply(patches.filter((patch) => selected.has(patch.patchId)))} variant="primary">Accept Selected ({selected.size})</Button>
          </div>
          {patches.map((patch) => (
            <article className="local-ai-diff" key={patch.patchId}>
              <Checkbox checked={selected.has(patch.patchId)} label={`Select ${patch.target.replaceAll('-', ' ')} suggestion`} onChange={(event) => setSelected((current) => {
                const next = new Set(current);
                if (event.target.checked) next.add(patch.patchId); else next.delete(patch.patchId);
                return next;
              })} />
              <div className="local-ai-diff-columns">
                <div><strong>Before</strong><p>{patch.before || 'No existing summary'}</p></div>
                <div><label className="form-label" htmlFor={`patch-${patch.patchId}`}>Proposed</label><textarea className="form-input" id={`patch-${patch.patchId}`} value={patch.afterDraft} onChange={(event) => setPatches((current) => current.map((item) => item.patchId === patch.patchId ? { ...item, afterDraft: event.target.value } : item))} /></div>
              </div>
              <div className="local-ai-patch-actions">
                <span className="status-pill">Evidence: {patch.evidenceIds.join(', ') || 'none'}</span>
                <Button disabled={isStale} onClick={() => apply([patch])}>Accept This Change</Button>
                <Button onClick={() => { setPatches((current) => current.filter((item) => item.patchId !== patch.patchId)); setSelected((current) => { const next = new Set(current); next.delete(patch.patchId); return next; }); }}>Reject</Button>
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </section>
  );
}

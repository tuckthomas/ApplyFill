import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  CirclePlay,
  Clock3,
  Hand,
  History,
  LoaderCircle,
  LockKeyhole,
  Pause,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
  Square,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import Button from '../components/ui/Button';
import AppSelect from '../components/ui/AppSelect';
import ManagedBrowserViewport from '../components/browser-agent/ManagedBrowserViewport';
import { browserAgentClient, loadBrowserAgentStartResources } from '../features/browser-agent';
import type {
  BrowserAgentClient,
  BrowserAgentQuestionAnswer,
  BrowserConnectionState,
  BrowserInput,
  BrowserRunCommand,
  BrowserRunSnapshot,
  BrowserRunState,
  BrowserRunSummary,
  BrowserAgentStartResources,
  PrivateAiStatus,
} from '../features/browser-agent';
import './BrowserAgent.css';

type BrowserAgentPageProps = {
  client?: BrowserAgentClient;
  embedded?: boolean;
  initialApplication?: { companyName: string; credentialId: string; jobTitle: string; targetJobUrl: string };
  loadStartResources?: () => Promise<BrowserAgentStartResources>;
  onRunChange?: (runId: string | null) => void;
  runIdOverride?: string | null;
};

type BrowserAgentBusyAction = BrowserRunCommand | 'answer' | 'delete' | 'recover';

const isNotFoundError = (error: unknown) => Boolean(
  error
  && typeof error === 'object'
  && 'status' in error
  && error.status === 404,
);

const runStatePresentation: Record<BrowserRunState, { label: string; message: string; tone: string }> = {
  ready: { label: 'Ready', message: 'ApplyFill is ready to begin.', tone: 'neutral' },
  'agent-running': { label: 'ApplyFill is working', message: 'ApplyFill is completing the application step by step.', tone: 'active' },
  pausing: { label: 'Pausing', message: 'Finishing the current safe action, then pausing.', tone: 'active' },
  paused: { label: 'Paused', message: 'The application is saved at a safe checkpoint.', tone: 'neutral' },
  'user-control': { label: 'You have control', message: 'You can click and type in the application page.', tone: 'user' },
  'waiting-for-user': { label: 'Waiting for you', message: 'ApplyFill needs an answer or a manual step before continuing.', tone: 'attention' },
  recovering: { label: 'Recovering', message: 'ApplyFill is restoring the last safe checkpoint.', tone: 'active' },
  'ready-for-review': { label: 'Ready for review', message: 'Review the application before approving submission.', tone: 'attention' },
  submitting: { label: 'Submitting', message: 'ApplyFill is verifying the submission result.', tone: 'active' },
  stopped: { label: 'Stopped', message: 'This run is stopped. Its safe checkpoint may still be reopened.', tone: 'neutral' },
  completed: { label: 'Completed', message: 'The application submission was confirmed.', tone: 'success' },
  failed: { label: 'Needs attention', message: 'ApplyFill stopped safely because it could not continue.', tone: 'danger' },
};

const transientPrivateAiStates = new Set<PrivateAiStatus['state']>(['checking', 'downloading', 'installing', 'updating']);

const isValidApplicationUrl = (value: string) => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol)
      && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
};

const formatUpdatedAt = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Recently' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const humanSetupStage = (status: PrivateAiStatus) => {
  if (status.state === 'checking') return 'Checking this computer';
  if (status.state === 'downloading') return 'Downloading Private AI';
  if (status.state === 'installing') return 'Finishing setup';
  if (status.state === 'updating') return 'Updating Private AI';
  return status.stage || 'Preparing Private AI';
};

export function BrowserAgentPage({
  client = browserAgentClient,
  embedded = false,
  initialApplication,
  loadStartResources = loadBrowserAgentStartResources,
  onRunChange,
  runIdOverride,
}: BrowserAgentPageProps) {
  const { runId: routeRunId } = useParams();
  const runId = runIdOverride === undefined ? routeRunId : runIdOverride ?? undefined;
  const navigate = useNavigate();
  const [privateAi, setPrivateAi] = useState<PrivateAiStatus | null>(null);
  const [history, setHistory] = useState<BrowserRunSummary[]>([]);
  const [run, setRun] = useState<BrowserRunSnapshot | null>(null);
  const [connectionState, setConnectionState] = useState<BrowserConnectionState>('disconnected');
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [pageLoading, setPageLoading] = useState(true);
  const [commandBusy, setCommandBusy] = useState<BrowserAgentBusyAction | null>(null);
  const [message, setMessage] = useState('');
  const [recoverableRunId, setRecoverableRunId] = useState<string | null>(null);
  const [startUrl, setStartUrl] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [startResources, setStartResources] = useState<BrowserAgentStartResources>({ applications: [], profileId: null, resumes: [] });
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [stopDialogOpen, setStopDialogOpen] = useState(false);
  const [questionValue, setQuestionValue] = useState('');
  const [selectedOption, setSelectedOption] = useState('');
  const [saveAnswer, setSaveAnswer] = useState(false);
  const inputErrorShown = useRef(false);

  useEffect(() => {
    if (runId || !initialApplication) return;
    setStartUrl(initialApplication.targetJobUrl);
    setCompanyName(initialApplication.companyName);
    setJobTitle(initialApplication.jobTitle);
  }, [initialApplication, runId]);

  const refreshLandingData = useCallback(async (signal?: AbortSignal) => {
    const [statusResult, runsResult, resourcesResult] = await Promise.allSettled([
      client.getPrivateAiStatus(signal),
      client.listRuns(signal),
      loadStartResources(),
    ]);
    if (statusResult.status === 'fulfilled') setPrivateAi(statusResult.value);
    else if (!signal?.aborted) setMessage('ApplyFill is still starting. Try again in a moment.');
    if (runsResult.status === 'fulfilled') setHistory(runsResult.value);
    if (resourcesResult.status === 'fulfilled') {
      setStartResources(resourcesResult.value);
      if (resourcesResult.value.resumes.length === 1) setSelectedResumeId(resourcesResult.value.resumes[0].id);
    } else if (!signal?.aborted) {
      setMessage('ApplyFill could not load your Job Profile and resumes. Try again.');
    }
  }, [client, loadStartResources]);

  useEffect(() => {
    const controller = new AbortController();
    setPageLoading(true);
    if (runId) {
      setRun(null);
      setRecoverableRunId(null);
      client.getRun(runId, controller.signal)
        .then((snapshot) => {
          setRun(snapshot);
          setRecoverableRunId(null);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          if (isNotFoundError(error)) {
            setRecoverableRunId(runId);
            setMessage('This saved application is not open right now. You can resume it from its latest safe checkpoint.');
          } else {
            setMessage(error instanceof Error ? error.message : 'This application run could not be opened.');
          }
        })
        .finally(() => { if (!controller.signal.aborted) setPageLoading(false); });
      void client.getPrivateAiStatus(controller.signal).then(setPrivateAi).catch(() => undefined);
    } else {
      setRun(null);
      refreshLandingData(controller.signal)
        .finally(() => { if (!controller.signal.aborted) setPageLoading(false); });
    }
    return () => controller.abort();
  }, [client, refreshLandingData, runId]);

  useEffect(() => {
    if (!runId) return;
    let active = true;
    let disconnect: (() => Promise<void>) | undefined;
    setConnectionState('connecting');
    void client.connect(runId, (event) => {
      if (!active) return;
      if (event.type === 'connection') setConnectionState(event.state);
      if (event.type === 'snapshot' && event.snapshot.id === runId) {
        setRun((current) => current && current.id === event.snapshot.id && current.revision >= event.snapshot.revision
          ? current
          : event.snapshot);
      }
      if (event.type === 'frame' && event.runId === runId) {
        setRun((current) => {
          if (!current) return current;
          const currentGeneration = current.framePageGeneration ?? -1;
          const currentSequence = current.frameSequence ?? -1;
          if (event.pageGeneration < currentGeneration ||
            (event.pageGeneration === currentGeneration && event.sequence <= currentSequence)) return current;
          return {
            ...current,
            frameHeight: event.height,
            frameSequence: event.sequence,
            framePageGeneration: event.pageGeneration,
            frameDeviceScaleFactor: event.deviceScaleFactor,
            frameUpdatedAt: event.frameUpdatedAt,
            frameUrl: event.frameUrl,
            frameWidth: event.width,
          };
        });
      }
    }).then((teardown) => {
      if (active) disconnect = teardown;
      else void teardown();
    }).catch(() => {
      if (active) setConnectionState('disconnected');
    });
    return () => {
      active = false;
      if (disconnect) void disconnect();
    };
  }, [client, connectionAttempt, runId]);

  useEffect(() => {
    if (!privateAi || !transientPrivateAiStates.has(privateAi.state)) return;
    const timer = window.setInterval(() => {
      void client.getPrivateAiStatus().then(setPrivateAi).catch(() => undefined);
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [client, privateAi]);

  useEffect(() => {
    setQuestionValue('');
    setSelectedOption('');
    setSaveAnswer(false);
  }, [run?.pendingQuestion?.id]);

  useEffect(() => {
    if (!run || run.controlOwner !== 'user') return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const warnBeforeInternalNavigation = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href]');
      if (!link || link.pathname.startsWith('/agent')) return;
      if (!window.confirm('You currently control the application page. Leave Browser Agent and return control to ApplyFill?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    document.addEventListener('click', warnBeforeInternalNavigation, true);
    return () => {
      window.removeEventListener('beforeunload', warnBeforeLeaving);
      document.removeEventListener('click', warnBeforeInternalNavigation, true);
    };
  }, [run]);

  const setupPrivateAi = async () => {
    setMessage('');
    try {
      setPrivateAi(await client.setupPrivateAi());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Private AI setup was interrupted. Try again to continue.');
    }
  };

  const retryLandingData = async () => {
    setMessage('');
    setPageLoading(true);
    try {
      await refreshLandingData();
    } finally {
      setPageLoading(false);
    }
  };

  const startRun = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    if (!isValidApplicationUrl(startUrl)) {
      setMessage('Enter the full web address of a job posting or application.');
      return;
    }
    if (!startResources.profileId) {
      setMessage('Complete and save your Job Profile before starting an application.');
      return;
    }
    const normalizedStartUrl = new URL(startUrl).href;
    const trackedApplication = startResources.applications.find((application) => {
      try {
        return new URL(application.targetJobUrl).href === normalizedStartUrl;
      } catch {
        return false;
      }
    });
    setCommandBusy('resume');
    try {
      const snapshot = await client.startRun({
        targetUrl: startUrl,
        companyName: companyName.trim() || trackedApplication?.companyName || undefined,
        credentialId: initialApplication?.credentialId || trackedApplication?.credentialId || undefined,
        jobApplicationId: trackedApplication?.id,
        jobTitle: jobTitle.trim() || trackedApplication?.jobTitle || undefined,
        profileId: startResources.profileId,
        resumeId: selectedResumeId || undefined,
      });
      setRun(snapshot);
      if (embedded) onRunChange?.(snapshot.id);
      else navigate(`/agent/${snapshot.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The application could not be started.');
    } finally {
      setCommandBusy(null);
    }
  };

  const sendCommand = async (command: BrowserRunCommand) => {
    if (!run) return;
    setMessage('');
    setCommandBusy(command);
    try {
      setRun(await client.command(run.id, command, run.revision));
      if (command === 'stop') setStopDialogOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That control could not be completed. The application was not changed.');
      try {
        setRun(await client.getRun(run.id));
      } catch {
        // The existing snapshot remains visible with a clear connection warning.
      }
    } finally {
      setCommandBusy(null);
    }
  };

  const answerQuestion = async () => {
    if (!run?.pendingQuestion) return;
    const question = run.pendingQuestion;
    const isSensitiveApproval = question.category === 'sensitive-approval';
    const answer: BrowserAgentQuestionAnswer = {
      optionId: selectedOption || undefined,
      value: isSensitiveApproval ? undefined : questionValue.trim() || undefined,
      saveToProfile: isSensitiveApproval ? false : saveAnswer,
    };
    if (!answer.optionId && !answer.value) {
      setMessage('Choose an answer or type a response before continuing.');
      return;
    }
    setMessage('');
    setCommandBusy('answer');
    try {
      if (isSensitiveApproval) {
        if (!['approve', 'deny'].includes(answer.optionId ?? '')) {
          setMessage('Choose whether ApplyFill may use this saved answer for this application.');
          return;
        }
        if (!question.approvalId || !question.approvalConcurrencyToken) {
          setMessage('This approval request is incomplete. Refresh the application before continuing.');
          return;
        }
        await client.decideSensitiveApproval(
          run.id,
          question.approvalId,
          answer.optionId === 'approve',
          question.approvalConcurrencyToken,
        );
      }
      setRun(await client.answerQuestion(run.id, question.id, answer, run.revision));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Your answer could not be saved. Try again.');
    } finally {
      setCommandBusy(null);
    }
  };

  const recoverRun = async () => {
    if (!recoverableRunId) return;
    setMessage('');
    setCommandBusy('recover');
    try {
      const snapshot = await client.recoverRun(recoverableRunId);
      setRun(snapshot);
      setRecoverableRunId(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'This application could not be resumed from its saved checkpoint.');
    } finally {
      setCommandBusy(null);
    }
  };

  const sendInput = (input: BrowserInput) => {
    if (!run || run.controlOwner !== 'user') return;
    void client.sendInput(run.id, input).catch(() => {
      if (inputErrorShown.current) return;
      inputErrorShown.current = true;
      setMessage('Page input was interrupted. ApplyFill paused input while it reconnects.');
    });
  };

  const removeRun = async (summary: BrowserRunSummary) => {
    const confirmed = window.confirm(`Delete the saved run for ${summary.jobTitle || 'this application'}? Its browser session, temporary files, and recovery checkpoint will also be removed.`);
    if (!confirmed) return;
    setCommandBusy('delete');
    try {
      await client.deleteRun(summary.id);
      setHistory((current) => current.filter((item) => item.id !== summary.id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'This run could not be deleted.');
    } finally {
      setCommandBusy(null);
    }
  };

  if (pageLoading) {
    return <div className="browser-agent-loading" role="status"><LoaderCircle className="animate-spin" aria-hidden="true" /> Opening Browser Agent…</div>;
  }

  return (
    <div className="browser-agent-page">
      {!embedded ? <header className="browser-agent-page-header">
        <div>
          <div className="browser-agent-eyebrow"><ShieldCheck aria-hidden="true" size={17} /> Private, reviewable application help</div>
          <h1>Browser Agent</h1>
          <p>ApplyFill works through job applications while you watch. Pause or take control at any time.</p>
        </div>
        {run ? <Button onClick={() => {
          if (run.controlOwner === 'user' && !window.confirm('Return control to ApplyFill and leave the live application page?')) return;
          navigate('/agent');
        }}><History aria-hidden="true" size={17} /> Application Runs</Button> : null}
      </header> : run ? <div className="browser-agent-embedded-actions">
        <Button onClick={() => {
          if (run.controlOwner === 'user' && !window.confirm('Return control to ApplyFill and leave the live application page?')) return;
          onRunChange?.(null);
        }}><History aria-hidden="true" size={17} /> Application Runs</Button>
      </div> : null}

      {message ? (
        <div className="browser-agent-message" role="alert">
          <AlertTriangle aria-hidden="true" size={20} />
          <span>{message}</span>
          {!runId ? <button className="browser-agent-message-retry" onClick={() => void retryLandingData()} type="button">Try Again</button> : null}
          <button aria-label="Dismiss message" onClick={() => setMessage('')} type="button"><X size={18} /></button>
        </div>
      ) : null}

      {recoverableRunId ? (
        <section aria-labelledby="browser-agent-recovery-title" className="browser-agent-recovery surface-panel">
          <div><RefreshCw aria-hidden="true" size={22} /><div><h2 id="browser-agent-recovery-title">Resume this application?</h2><p>ApplyFill will reopen the private application page from its latest safe checkpoint. Nothing will be submitted.</p></div></div>
          <Button disabled={commandBusy !== null} onClick={() => void recoverRun()} variant="primary">
            {commandBusy === 'recover' ? <LoaderCircle aria-hidden="true" className="animate-spin" size={17} /> : <CirclePlay aria-hidden="true" size={17} />} Resume This Application
          </Button>
        </section>
      ) : null}

      {run ? (
        <BrowserAgentWorkspace
          commandBusy={commandBusy}
          connectionState={connectionState}
          onAnswer={() => void answerQuestion()}
          onCommand={(command) => void sendCommand(command)}
          onInput={sendInput}
          onRetryConnection={() => setConnectionAttempt((value) => value + 1)}
          onSaveAnswerChange={setSaveAnswer}
          onSelectedOptionChange={setSelectedOption}
          onStop={() => setStopDialogOpen(true)}
          onValueChange={setQuestionValue}
          questionValue={questionValue}
          run={run}
          saveAnswer={saveAnswer}
          selectedOption={selectedOption}
        />
      ) : !recoverableRunId ? (
        <BrowserAgentLanding
          commandBusy={commandBusy}
          companyName={companyName}
          history={history}
          jobTitle={jobTitle}
          profileReady={Boolean(startResources.profileId)}
          resumes={startResources.resumes}
          selectedResumeId={selectedResumeId}
          onCompanyNameChange={setCompanyName}
          onDeleteRun={(summary) => void removeRun(summary)}
          onJobTitleChange={setJobTitle}
          onOpenRun={(id) => embedded ? onRunChange?.(id) : navigate(`/agent/${id}`)}
          onResumeChange={setSelectedResumeId}
          onSetup={() => void setupPrivateAi()}
          onStart={(event) => void startRun(event)}
          onUrlChange={setStartUrl}
          privateAi={privateAi}
          startUrl={startUrl}
        />
      ) : null}

      {stopDialogOpen && run ? (
        <div className="browser-agent-dialog-backdrop" onMouseDown={() => setStopDialogOpen(false)}>
          <section aria-labelledby="stop-run-title" aria-modal="true" className="browser-agent-dialog" onKeyDown={(event) => { if (event.key === 'Escape') setStopDialogOpen(false); }} onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <div className="browser-agent-dialog-icon"><Square aria-hidden="true" size={23} /></div>
            <h2 id="stop-run-title">Stop this application run?</h2>
            <p>ApplyFill will stop working and close the live page. {run.checkpointRetained ? 'The latest safe checkpoint will be kept so you can reopen it.' : 'This application cannot be resumed from its current step.'}</p>
            <div className="browser-agent-dialog-actions">
              <Button autoFocus disabled={commandBusy !== null} onClick={() => setStopDialogOpen(false)}>Keep Running</Button>
              <Button disabled={commandBusy !== null} onClick={() => void sendCommand('stop')} variant="danger"><Square aria-hidden="true" size={16} /> Stop Run</Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

type BrowserAgentLandingProps = {
  commandBusy: BrowserAgentBusyAction | null;
  companyName: string;
  history: BrowserRunSummary[];
  jobTitle: string;
  profileReady: boolean;
  privateAi: PrivateAiStatus | null;
  resumes: Array<{ id: string; title: string }>;
  selectedResumeId: string;
  startUrl: string;
  onCompanyNameChange: (value: string) => void;
  onDeleteRun: (run: BrowserRunSummary) => void;
  onJobTitleChange: (value: string) => void;
  onOpenRun: (id: string) => void;
  onResumeChange: (value: string) => void;
  onSetup: () => void;
  onStart: (event: React.FormEvent<HTMLFormElement>) => void;
  onUrlChange: (value: string) => void;
};

function BrowserAgentLanding(props: BrowserAgentLandingProps) {
  const setupInProgress = props.privateAi ? transientPrivateAiStates.has(props.privateAi.state) : false;
  const aiReady = props.privateAi?.state === 'ready';
  const activeSetup = props.privateAi && setupInProgress ? props.privateAi : null;
  return (
    <div className="browser-agent-landing-grid">
      <main className="browser-agent-start-panel surface-panel">
        {!aiReady ? (
          <section className="private-ai-setup" aria-labelledby="private-ai-setup-title">
            <div className="private-ai-setup-icon"><LockKeyhole aria-hidden="true" size={27} /></div>
            <div className="private-ai-setup-copy">
              <h2 id="private-ai-setup-title">Set Up Private AI</h2>
              <p>{props.privateAi?.downloadSize
                ? `A one-time download of about ${props.privateAi.downloadSize} lets ApplyFill understand application pages on this computer. Your profile and application answers stay here.`
                : 'A one-time setup lets ApplyFill understand application pages on this computer. Your profile and application answers stay here.'}</p>
              {activeSetup ? (
                <div className="private-ai-progress-wrap">
                  <div aria-label={`${humanSetupStage(activeSetup)} ${activeSetup.progress ?? 0}%`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={activeSetup.progress ?? 0} className="private-ai-progress" role="progressbar"><span style={{ width: `${activeSetup.progress ?? 0}%` }} /></div>
                  <strong>{humanSetupStage(activeSetup)} — {activeSetup.progress ?? 0}%</strong>
                </div>
              ) : (
                <Button disabled={!props.privateAi || setupInProgress} onClick={props.onSetup} variant="primary">
                  {props.privateAi?.state === 'failed' ? <RefreshCw aria-hidden="true" size={18} /> : <LockKeyhole aria-hidden="true" size={18} />}
                  {props.privateAi?.state === 'failed' ? 'Try Setup Again' : 'Set Up Private AI'}
                </Button>
              )}
              {props.privateAi?.state === 'failed' ? <p className="private-ai-recovery">Setup was interrupted. Choose Try Setup Again to continue; finished parts will not download twice.</p> : null}
              {props.privateAi?.diagnosticsId ? <details className="browser-agent-diagnostics"><summary>Advanced diagnostics</summary><p>Report ID: <code>{props.privateAi.diagnosticsId}</code></p><button onClick={() => void navigator.clipboard.writeText(props.privateAi?.diagnosticsId ?? '')} type="button">Copy report ID</button></details> : null}
            </div>
          </section>
        ) : (
          <div className="private-ai-ready" role="status"><CheckCircle2 aria-hidden="true" size={20} /><span><strong>Private AI is ready.</strong> Start with a job posting or application link.</span></div>
        )}

        <form className="browser-agent-start-form" onSubmit={props.onStart}>
          <div>
            <h2>Start an application</h2>
            <p>Paste the link. ApplyFill opens it here and stays with the application across every page.</p>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="agent-application-url">Job posting or application link</label>
            <input autoComplete="url" className="form-input" disabled={!aiReady} id="agent-application-url" onChange={(event) => props.onUrlChange(event.target.value)} placeholder="https://company.com/jobs/..." required type="url" value={props.startUrl} />
          </div>
          <div className="browser-agent-optional-fields">
            <div className="form-group">
              <label className="form-label" htmlFor="agent-company-name">Company <span>(optional)</span></label>
              <input className="form-input" disabled={!aiReady} id="agent-company-name" onChange={(event) => props.onCompanyNameChange(event.target.value)} value={props.companyName} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="agent-job-title">Job title <span>(optional)</span></label>
              <input className="form-input" disabled={!aiReady} id="agent-job-title" onChange={(event) => props.onJobTitleChange(event.target.value)} value={props.jobTitle} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="agent-resume">Resume <span>(optional)</span></label>
            <AppSelect<{ label: string; value: string }>
              inputId="agent-resume"
              isClearable
              isDisabled={!aiReady || !props.profileReady}
              isSearchable={props.resumes.length > 6}
              onChange={(option) => props.onResumeChange(option?.value ?? '')}
              options={props.resumes.map((resume) => ({ label: resume.title, value: resume.id }))}
              placeholder={props.resumes.length ? 'Choose a resume' : 'No saved resumes'}
              value={props.resumes
                .filter((resume) => resume.id === props.selectedResumeId)
                .map((resume) => ({ label: resume.title, value: resume.id }))[0] ?? null}
            />
            <p className="field-hint">ApplyFill can upload the selected resume when the application asks for one.</p>
          </div>
          {!props.profileReady ? <p className="field-error" role="alert">Complete and save your Job Profile before starting an application.</p> : null}
          <Button disabled={!aiReady || !props.profileReady || !props.startUrl.trim() || props.commandBusy !== null} type="submit" variant="primary"><Play aria-hidden="true" size={18} /> Start Application</Button>
        </form>
      </main>

      <aside className="browser-run-history surface-panel" aria-labelledby="browser-run-history-title">
        <div className="browser-run-history-heading"><History aria-hidden="true" size={21} /><h2 id="browser-run-history-title">Application Runs</h2></div>
        {props.history.length ? (
          <ul>
            {props.history.map((run) => (
              <li key={run.id}>
                <button className="browser-run-history-open" onClick={() => props.onOpenRun(run.id)} type="button">
                  <strong>{run.jobTitle || 'Job application'}</strong>
                  <span>{run.companyName || run.currentDomain || 'Application'}</span>
                  <small>{runStatePresentation[run.state].label} · {formatUpdatedAt(run.updatedAt)}</small>
                </button>
                <button aria-label={`Delete ${run.jobTitle || 'application'} run`} className="browser-run-delete" disabled={props.commandBusy === 'delete'} onClick={() => props.onDeleteRun(run)} type="button"><Trash2 aria-hidden="true" size={17} /></button>
              </li>
            ))}
          </ul>
        ) : <div className="browser-run-history-empty"><Clock3 aria-hidden="true" size={28} /><p>No application runs yet.</p></div>}
      </aside>
    </div>
  );
}

type BrowserAgentWorkspaceProps = {
  commandBusy: BrowserAgentBusyAction | null;
  connectionState: BrowserConnectionState;
  questionValue: string;
  run: BrowserRunSnapshot;
  saveAnswer: boolean;
  selectedOption: string;
  onAnswer: () => void;
  onCommand: (command: BrowserRunCommand) => void;
  onInput: (input: BrowserInput) => void;
  onRetryConnection: () => void;
  onSaveAnswerChange: (checked: boolean) => void;
  onSelectedOptionChange: (value: string) => void;
  onStop: () => void;
  onValueChange: (value: string) => void;
};

function BrowserAgentWorkspace(props: BrowserAgentWorkspaceProps) {
  const { run } = props;
  const presentation = runStatePresentation[run.state];
  const agentControlled = run.controlOwner === 'agent';
  const canPause = agentControlled && ['agent-running', 'recovering', 'submitting'].includes(run.state);
  const canTakeControl = agentControlled && !['stopped', 'completed', 'submitting'].includes(run.state);
  const canReturnControl = run.controlOwner === 'user' && run.state === 'user-control';
  const canResume = run.canResume && ['paused', 'stopped', 'failed'].includes(run.state);
  const hasBlockingCommand = props.commandBusy !== null;

  return (
    <div className="browser-agent-workspace">
      <section className="browser-run-summary" aria-label="Current application">
        <div>
          <span className="browser-run-kicker">{run.companyName || run.currentDomain || 'Application'}</span>
          <h2>{run.jobTitle || 'Job application'}</h2>
        </div>
        <dl>
          <div><dt>Stage</dt><dd>{run.applicationStage || 'Opening application'}</dd></div>
          <div><dt>Website</dt><dd title={run.currentUrl}>{run.currentDomain || 'Opening'}</dd></div>
          <div><dt>Control</dt><dd>{run.controlOwner === 'user' ? 'You' : run.controlOwner === 'agent' ? 'ApplyFill' : 'Paused'}</dd></div>
        </dl>
      </section>

      <div aria-atomic="true" aria-live="polite" className={`browser-run-status tone-${presentation.tone}`} role="status">
        {run.state === 'agent-running' || run.state === 'recovering' || run.state === 'pausing' || run.state === 'submitting'
          ? <LoaderCircle aria-hidden="true" className="animate-spin" size={21} />
          : run.controlOwner === 'user' ? <UserRound aria-hidden="true" size={21} /> : <Bot aria-hidden="true" size={21} />}
        <div><strong>{presentation.label}</strong><span>{run.statusMessage || presentation.message}</span></div>
      </div>

      <div className="browser-agent-toolbar" role="toolbar" aria-label="Application controls">
        {canPause ? <Button disabled={hasBlockingCommand} onClick={() => props.onCommand('pause')}><Pause aria-hidden="true" size={17} /> {run.state === 'pausing' ? 'Pausing…' : 'Pause'}</Button> : null}
        {canResume ? <Button disabled={hasBlockingCommand} onClick={() => props.onCommand('resume')} variant="primary"><CirclePlay aria-hidden="true" size={17} /> Resume</Button> : null}
        {canTakeControl ? <Button disabled={hasBlockingCommand} onClick={() => props.onCommand('take-control')}><Hand aria-hidden="true" size={17} /> Take Control</Button> : null}
        {canReturnControl ? <Button disabled={hasBlockingCommand} onClick={() => props.onCommand('return-control')} variant="primary"><Bot aria-hidden="true" size={17} /> Return to ApplyFill</Button> : null}
        {!['stopped', 'completed'].includes(run.state) ? <Button className="browser-agent-stop-button" disabled={hasBlockingCommand} onClick={props.onStop} variant="danger"><Square aria-hidden="true" size={16} /> Stop</Button> : null}
        {hasBlockingCommand ? <span className="browser-toolbar-busy" role="status"><LoaderCircle aria-hidden="true" className="animate-spin" size={17} /> Updating control…</span> : null}
      </div>

      {run.controlReason ? <p className="browser-control-reason"><LockKeyhole aria-hidden="true" size={17} /> {run.controlReason}</p> : null}

      <div className="browser-agent-workspace-grid">
        <ManagedBrowserViewport
          connectionState={props.connectionState}
          onInput={props.onInput}
          onRetryConnection={props.onRetryConnection}
          run={run}
        />
        <aside className="browser-agent-activity" aria-labelledby="browser-agent-activity-title">
          <h2 id="browser-agent-activity-title">Progress</h2>
          {run.currentAction ? <div className="browser-current-action"><LoaderCircle aria-hidden="true" className="animate-spin" size={18} /><div><strong>Now</strong><span>{run.currentAction}</span></div></div> : null}
          <ol>
            {run.activity.slice(0, 8).map((item) => (
              <li className={`activity-${item.kind}`} key={item.id}>
                <span className="browser-activity-marker">{item.kind === 'completed' ? <Check aria-hidden="true" size={14} /> : item.kind === 'error' || item.kind === 'warning' ? <AlertTriangle aria-hidden="true" size={14} /> : <span />}</span>
                <div><strong>{item.summary}</strong>{item.detail ? <span>{item.detail}</span> : null}</div>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      {run.pendingQuestion ? (
        <section className="browser-agent-question" aria-labelledby="browser-agent-question-title">
          <div className="browser-agent-question-heading">
            <div className="browser-agent-question-icon"><UserRound aria-hidden="true" size={22} /></div>
            <div><span>ApplyFill needs your help</span><h2 id="browser-agent-question-title">{run.pendingQuestion.prompt}</h2><p>{run.pendingQuestion.context}</p></div>
          </div>
          {run.pendingQuestion.options?.length ? (
            <fieldset className="browser-question-options"><legend>Choose an answer</legend>{run.pendingQuestion.options.map((option) => <label key={option.id}><input checked={props.selectedOption === option.id} name="browser-agent-answer" onChange={() => props.onSelectedOptionChange(option.id)} type="radio" value={option.id} /><span><strong>{option.label}</strong>{option.description ? <small>{option.description}</small> : null}</span></label>)}</fieldset>
          ) : null}
          {run.pendingQuestion.allowFreeText ? <div className="form-group"><label className="form-label" htmlFor="browser-agent-question-value">Your answer</label><textarea className="form-input" id="browser-agent-question-value" onChange={(event) => props.onValueChange(event.target.value)} rows={3} value={props.questionValue} /></div> : null}
          {run.pendingQuestion.canSaveToProfile ? <label className="browser-save-answer"><input checked={props.saveAnswer} onChange={(event) => props.onSaveAnswerChange(event.target.checked)} type="checkbox" /><span>Save this answer to my Job Profile for future applications</span></label> : null}
          <div className="browser-question-actions">
            <Button disabled={hasBlockingCommand} onClick={props.onAnswer} variant="primary"><Send aria-hidden="true" size={17} /> Use This Answer</Button>
            {run.controlOwner !== 'user' ? <Button disabled={hasBlockingCommand} onClick={() => props.onCommand('take-control')}><Hand aria-hidden="true" size={17} /> Handle It Myself</Button> : null}
          </div>
        </section>
      ) : null}

      {run.state === 'ready-for-review' && run.review ? <FinalReview commandBusy={hasBlockingCommand} onSubmit={() => props.onCommand('approve-submit')} run={run} /> : null}
    </div>
  );
}

function FinalReview({ commandBusy, onSubmit, run }: { commandBusy: boolean; onSubmit: () => void; run: BrowserRunSnapshot }) {
  const review = run.review;
  if (!review) return null;
  return (
    <section className="browser-final-review" aria-labelledby="browser-final-review-title">
      <div className="browser-final-review-heading"><ShieldCheck aria-hidden="true" size={24} /><div><span>Final submission checkpoint</span><h2 id="browser-final-review-title">Review before submitting</h2><p>Nothing has been submitted yet. Confirm these details for this application.</p></div></div>
      <div className="browser-review-grid">
        <div><h3>Completed sections</h3><ul>{review.sectionsAnswered.map((item) => <li key={item}><CheckCircle2 aria-hidden="true" size={16} /> {item}</li>)}</ul></div>
        <div><h3>Documents</h3><p>Resume: {review.resumeName || 'None selected'}</p><p>Cover letter: {review.coverLetterName || 'None selected'}</p></div>
        <div><h3>Sensitive disclosures</h3>{review.sensitiveDisclosures.length ? <ul>{review.sensitiveDisclosures.map((item) => <li key={item}>{item}</li>)}</ul> : <p>None</p>}</div>
        <div><h3>Warnings</h3>{review.unresolvedWarnings.length ? <ul className="browser-review-warnings">{review.unresolvedWarnings.map((item) => <li key={item}><AlertTriangle aria-hidden="true" size={16} /> {item}</li>)}</ul> : <p>No unresolved warnings.</p>}</div>
      </div>
      <p className="browser-final-submit-note"><LockKeyhole aria-hidden="true" size={17} /> Approval applies only to {run.jobTitle || 'this application'} at {run.companyName || run.currentDomain}. ApplyFill will stop if it cannot confirm the result.</p>
      <Button disabled={commandBusy || review.unresolvedWarnings.length > 0} onClick={onSubmit} variant="primary"><Send aria-hidden="true" size={17} /> Approve and Submit Application</Button>
      {review.unresolvedWarnings.length > 0 ? <p className="field-hint">Resolve every warning before submission can be approved.</p> : null}
    </section>
  );
}

export default BrowserAgentPage;

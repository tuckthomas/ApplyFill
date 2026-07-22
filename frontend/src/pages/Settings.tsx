import { useEffect, useState } from 'react';
import { BrainCircuit, CalendarDays, Download, Gauge, HardDrive, FileText, Plug, RefreshCw, ShieldCheck, Trash2, Unplug } from 'lucide-react';
import AppSelect from '../components/ui/AppSelect';
import Button from '../components/ui/Button';
import { useDateFormatPreference } from '../features/preferences/dateFormatPreference';
import type { DateFormatPreference } from '../features/preferences/dateFormatPreference';
import { clearApplyFillLocalData } from '../features/storage/localDatabase';
import {
  removeCachedModel,
  loadDeployedModelManifest,
  localAiRuntime
} from '../features/local-ai';
import type { ModelManifestEntry, RuntimeProgress, RuntimeSnapshot } from '../features/local-ai';
import { downloadBlob } from '../features/resume/resumeDownloads';
import Checkbox from '../components/ui/Checkbox';
import { loadProfileDocument } from '../features/profile/profileBuilder';
import {
  AUTOFILL_EXTENSION_ID_KEY,
  AUTOFILL_INCLUDE_SENSITIVE_KEY,
  getAutofillPairingStatus,
  isValidExtensionId,
  pairAutofillExtension,
  unpairAutofillExtension,
} from '../features/autofill/extensionHandoff';

type DateFormatOption = {
  label: string;
  value: DateFormatPreference;
};

const DATE_FORMAT_OPTIONS: DateFormatOption[] = [
  { label: 'Month/day/year (MM/DD/YYYY)', value: 'MM/DD/YYYY' },
  { label: 'Day/month/year (DD/MM/YYYY)', value: 'DD/MM/YYYY' }
];

const RETIRED_ACCELERATOR_STORAGE_KEY = 'applyfill.local-ai.accelerator';

const settingsSections = [
  {
    title: 'Backups and Downloads',
    status: 'Available',
    icon: FileText,
    copy: 'Download copies of your profile and resumes whenever you want. Resume files are created on this device.'
  },
  {
    title: 'Where Your Data Is Saved',
    status: 'Local only',
    icon: HardDrive,
    copy: 'Your profile, resumes, applications, and dashboard stay in this browser. ApplyFill does not keep a cloud copy or automatic backup.'
  },
  {
    title: 'Protect Your Information',
    status: 'Important',
    icon: ShieldCheck,
    copy: 'Downloaded backups may contain sensitive personal information. Store them somewhere private and secure.'
  }
];

const runtimeStateLabel: Record<RuntimeSnapshot['state'], string> = {
  unsupported: 'Not supported',
  idle: 'Not started',
  downloading: 'Downloading',
  compiling: 'Getting ready',
  ready: 'Ready',
  running: 'Working',
  failed: 'Needs attention',
  disposed: 'Stopped'
};

const acceleratorLabel = (value: string | undefined) => {
  if (!value) return 'Not running';
  if (value === 'experimental-npu' || value === 'webnn-npu') return 'AI processor';
  if (value === 'webgpu' || value === 'webnn-gpu') return 'Graphics processor';
  return 'Regular processor';
};

const friendlyProgressMessage = (progress: RuntimeProgress) => {
  if (progress.phase === 'compiling') return 'Finishing setup…';
  if (progress.phase === 'generating') return 'Private AI is working…';
  if (progress.total && progress.total > 0) {
    return `Downloading private AI… ${Math.min(100, Math.floor(progress.completed / progress.total * 100))}%`;
  }
  return 'Downloading private AI…';
};

const byteSize = (value: number | undefined) => {
  if (value === undefined) return 'Unknown';
  if (value < 1024 ** 2) return `${Math.round(value / 1024)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(2)} GB`;
};

export default function Settings() {
  const { dateFormat, setDateFormat } = useDateFormatPreference();
  const [storageMessage, setStorageMessage] = useState('');
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<RuntimeSnapshot>(localAiRuntime.snapshot);
  const [aiMessage, setAiMessage] = useState('Private AI is not set up yet.');
  const [progress, setProgress] = useState<RuntimeProgress | null>(null);
  const [storageEstimate, setStorageEstimate] = useState<{ persisted: boolean; quota?: number; usage?: number } | null>(null);
  const [availableModel, setAvailableModel] = useState<ModelManifestEntry | null>(null);
  const [extensionId, setExtensionId] = useState(() => localStorage.getItem(AUTOFILL_EXTENSION_ID_KEY) ?? '');
  const [includeSensitiveAutofill, setIncludeSensitiveAutofill] = useState(
    () => localStorage.getItem(AUTOFILL_INCLUDE_SENSITIVE_KEY) === 'true',
  );
  const [extensionConnected, setExtensionConnected] = useState(false);
  const [extensionMessage, setExtensionMessage] = useState('No extension is paired yet.');
  const isResumeApproved = availableModel?.approvedTasks.includes('resume-tailoring-draft') ?? false;

  useEffect(() => localAiRuntime.subscribe(setRuntimeSnapshot), []);

  useEffect(() => {
    localStorage.removeItem(RETIRED_ACCELERATOR_STORAGE_KEY);
  }, []);

  useEffect(() => {
    if (!isValidExtensionId(extensionId)) return;
    let active = true;
    void getAutofillPairingStatus(extensionId)
      .then((result) => {
        if (!active) return;
        setExtensionConnected(result.paired === true);
        setExtensionMessage(result.paired
          ? 'The extension is paired and ready on every job application. Your saved profile is updated automatically.'
          : 'This extension has not been paired with ApplyFill yet.');
      })
      .catch(() => {
        if (active) setExtensionMessage('ApplyFill could not reach the saved extension. Make sure it is installed and enabled.');
      });
    return () => { active = false; };
  }, [extensionId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadDeployedModelManifest(controller.signal)
      .then((manifest) => setAvailableModel(manifest.models.find((model) => model.approvedTasks.includes('evaluation'))
        ?? manifest.models.find((model) => model.id === manifest.defaultModelId)
        ?? null))
      .catch(() => setAvailableModel(null));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([navigator.storage?.estimate?.(), navigator.storage?.persisted?.()])
      .then(([estimate, persisted]) => {
        if (active) setStorageEstimate({ persisted: Boolean(persisted), quota: estimate?.quota, usage: estimate?.usage });
      })
      .catch(() => { if (active) setStorageEstimate(null); });
    return () => { active = false; };
  }, []);

  const initializeModel = async () => {
    if (!availableModel) return;
    setProgress(null);
    setAiMessage('Getting Local AI ready. The first setup may take several minutes…');
    try {
      const diagnostics = await localAiRuntime.initialize({
        acceleratorPreference: 'automatic',
        model: availableModel,
        onProgress: (next) => { setProgress(next); setAiMessage(friendlyProgressMessage(next)); }
      });
      setProgress(null);
      setAiMessage(`Private AI is ready${diagnostics.actualAccelerator ? ` and using this computer's ${acceleratorLabel(diagnostics.actualAccelerator).toLowerCase()}` : ''}.`);
    } catch {
      setProgress(null);
      const webGpuAvailable = localAiRuntime.snapshot.diagnostics.capabilities?.accelerators.webgpu.available;
      setAiMessage(webGpuAvailable === false
        ? 'Private AI cannot run in this browser. ApplyFill features that do not need AI still work normally.'
        : 'Private AI setup was interrupted. Completed download pieces were saved, so choosing Try Setup Again will continue instead of starting over.');
    }
  };

  const resetRuntime = async () => {
    try {
      await localAiRuntime.reset();
      setProgress(null);
      setAiMessage('Local AI was stopped. Your profile and saved work were not changed.');
    } catch {
      setAiMessage('Local AI could not be stopped. Reload ApplyFill and try again.');
    }
  };

  const removeModel = async () => {
    if (!availableModel) return;
    try {
      await localAiRuntime.reset();
      const removed = await removeCachedModel(availableModel);
      const estimate = await navigator.storage?.estimate?.();
      const persisted = await navigator.storage?.persisted?.();
      setStorageEstimate({ persisted: Boolean(persisted), quota: estimate?.quota, usage: estimate?.usage });
      setProgress(null);
      setAiMessage(removed ? 'The Local AI download was removed. Your profile and saved work were not changed.' : 'There was no Local AI download to remove. Your profile and saved work were not changed.');
    } catch {
      setAiMessage('The Local AI download could not be removed. Try again.');
    }
  };

  const benchmark = async () => {
    setAiMessage('Running a private speed test on this computer…');
    try {
      await localAiRuntime.generate({ input: 'Return exactly: LOCAL BENCHMARK COMPLETE', maxOutputTokens: 16 });
      const diagnostics = localAiRuntime.snapshot.diagnostics;
      setAiMessage(`Speed test complete. Local AI began responding in ${diagnostics.firstTokenLatencyMs?.toFixed(0) ?? 'an unknown number of'} milliseconds and processed ${diagnostics.generationTokensPerSecond?.toFixed(1) ?? 'an unknown number of'} tokens per second.`);
    } catch {
      setAiMessage('The speed test could not finish. Make sure Local AI is ready and try again.');
    }
  };

  const exportDiagnostics = () => {
    downloadBlob(new Blob([localAiRuntime.exportDiagnostics()], { type: 'application/json' }), 'applyfill-local-ai-diagnostics.json');
    setAiMessage('Technical report downloaded. It does not contain your profile, job information, prompts, or AI responses.');
  };

  const requestPersistentStorage = async () => {
    try {
      const persisted = await navigator.storage.persist();
      const estimate = await navigator.storage.estimate();
      setStorageEstimate({ persisted, quota: estimate.quota, usage: estimate.usage });
      setAiMessage(persisted ? 'This browser agreed to protect ApplyFill data from automatic cleanup.' : 'This browser may still remove ApplyFill data when storage is low. Download backups regularly.');
    } catch {
      setAiMessage('ApplyFill could not ask this browser to protect its saved data. Download backups regularly.');
    }
  };

  const deleteLocalData = async () => {
    const confirmed = window.confirm(
      'Permanently delete the paired extension copy, local profile, resume drafts, job tracker, and dashboard data from this browser? Download any backups you need first.'
    );
    if (!confirmed) return;
    try {
      if (localStorage.getItem(AUTOFILL_EXTENSION_ID_KEY)) await unpairAutofillExtension();
      await clearApplyFillLocalData();
      setExtensionConnected(false);
      setExtensionId('');
      setStorageMessage('The extension copy, local profile, resume drafts, tracker, and dashboard data were deleted from this browser.');
    } catch {
      setStorageMessage('Local data was not deleted because ApplyFill could not first remove the extension copy. Enable the paired extension and try again.');
    }
  };

  const pairExtension = async () => {
    setExtensionMessage(extensionConnected ? 'Updating the extension with your saved profile…' : 'Pairing the extension with ApplyFill…');
    try {
      const profile = await loadProfileDocument();
      if (!profile?.isComplete) throw new Error('Complete My Profile before using job application autofill.');
      if (!isValidExtensionId(extensionId)) throw new Error('Enter the 32-character ID shown on the extension details page.');
      await pairAutofillExtension(extensionId, profile, includeSensitiveAutofill);
      setExtensionConnected(true);
      setExtensionMessage('The extension is paired and ready on every job application. ApplyFill will update it whenever you save your profile.');
    } catch (error) {
      setExtensionConnected(false);
      setExtensionMessage(error instanceof Error ? error.message : 'The extension could not be paired.');
    }
  };

  const unpairExtension = async () => {
    try {
      await unpairAutofillExtension();
      setExtensionMessage('The extension was unpaired and its saved ApplyFill profile copy was deleted.');
      setExtensionConnected(false);
      setExtensionId('');
    } catch {
      setExtensionMessage('ApplyFill could not remove the extension copy. Enable the extension and try again; the pairing has not been cleared.');
    }
  };

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h2 className="page-title">Settings</h2>
          <p className="page-copy">Choose how ApplyFill works in this browser.</p>
        </div>
      </header>

      <section className="surface-panel settings-preferences-panel" aria-labelledby="regional-preferences-title">
        <div className="settings-preferences-heading">
          <CalendarDays aria-hidden="true" size={24} />
          <div>
            <h3 className="section-title" id="regional-preferences-title">Dates</h3>
            <p className="section-copy">Choose how dates appear throughout ApplyFill.</p>
          </div>
        </div>
        <div className="form-group settings-date-format-field">
          <label className="form-label" htmlFor="date-format-preference">Date Format</label>
          <AppSelect<DateFormatOption>
            inputId="date-format-preference"
            isSearchable={false}
            onChange={(option) => {
              if (option) setDateFormat(option.value);
            }}
            options={DATE_FORMAT_OPTIONS}
            value={DATE_FORMAT_OPTIONS.find((option) => option.value === dateFormat)}
          />
        </div>
      </section>

      <section className="surface-panel autofill-extension-panel" aria-labelledby="autofill-extension-title">
        <div className="settings-preferences-heading">
          <Plug aria-hidden="true" size={24} />
          <div>
            <h3 className="section-title" id="autofill-extension-title">Job Application Autofill</h3>
            <p className="section-copy">Pair the browser extension once. It stays ready across job applications and browser restarts, while every fill still requires your review.</p>
          </div>
          <span className="status-pill">{extensionConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <div className="form-group autofill-extension-id-field">
          <label className="form-label" htmlFor="autofill-extension-id">Extension ID</label>
          <input className="form-input" id="autofill-extension-id" maxLength={32} onChange={(event) => {
            setExtensionId(event.target.value.toLowerCase());
            setExtensionConnected(false);
          }} placeholder="Paste the ID from the extension details page" spellCheck={false} value={extensionId} />
        </div>
        <Checkbox checked={includeSensitiveAutofill} label="Keep sensitive application answers in the extension" onChange={(event) => setIncludeSensitiveAutofill(event.target.checked)} />
        <p className="field-hint">Optional. This stores government IDs, work authorization, sponsorship, and demographic answers only in this browser's extension storage. Local AI never sees them, and you must confirm each sensitive field before it is filled.</p>
        <p className="field-hint">After pairing, open the extension on a job application and choose Inspect This Application. That gives ApplyFill temporary access to the current page; it does not reconnect your profile. Recognized fields and private AI suggestions then appear in one review.</p>
        <p className="field-hint" role="status" aria-live="polite">{extensionMessage}</p>
        <div className="resume-builder-actions">
          <Button disabled={!extensionId.trim()} onClick={() => void pairExtension()} variant="primary"><Plug aria-hidden="true" size={17} /> {extensionConnected ? 'Update Extension Profile' : 'Pair Extension Once'}</Button>
          <Button disabled={!extensionConnected} onClick={() => void unpairExtension()}><Unplug aria-hidden="true" size={17} /> Unpair Extension</Button>
        </div>
      </section>

      <section className="surface-panel local-ai-settings-panel" aria-labelledby="local-ai-settings-title">
        <div className="settings-preferences-heading">
          <BrainCircuit aria-hidden="true" size={24} />
          <div>
            <h3 className="section-title" id="local-ai-settings-title">Private AI on This Computer</h3>
            <p className="section-copy">Download it once, then ApplyFill privately handles resume imports, writing help, and harder application questions on this computer.</p>
          </div>
          <span className="status-pill">{runtimeStateLabel[runtimeSnapshot.state]}</span>
        </div>

        <div className="local-ai-model-card">
          <div>
            <h4>Private AI Download</h4>
            <p className="section-copy">{availableModel
              ? `About ${byteSize(availableModel.artifact.byteSize)}. ApplyFill automatically chooses compatible hardware; you do not need to configure anything.`
              : 'The Private AI download is not available in this build.'}</p>
          </div>
          {!isResumeApproved ? <span className="status-pill">Unavailable</span> : null}
        </div>

        {progress ? <div className="local-ai-progress" role="progressbar" aria-label={aiMessage} aria-valuemin={0} aria-valuemax={progress.total ?? undefined} aria-valuenow={progress.completed}><span style={{ width: progress.total ? `${Math.min(100, progress.completed / progress.total * 100)}%` : '20%' }} /></div> : null}
        <p className="field-hint" role="status" aria-live="polite">{aiMessage}</p>

        <div className="resume-builder-actions" aria-label="Local AI controls">
          <Button disabled={!availableModel || ['downloading', 'compiling', 'running'].includes(runtimeSnapshot.state)} onClick={() => void initializeModel()} variant="primary"><Download aria-hidden="true" size={17} /> {runtimeSnapshot.state === 'ready' ? 'Restart Private AI' : runtimeSnapshot.state === 'failed' ? 'Try Setup Again' : 'Set Up Private AI'}</Button>
        </div>

        <p className="field-hint">Private AI works while ApplyFill is open. Stopping or removing it does not delete your profile or resumes.</p>
        {/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? <p className="field-hint">Local AI is currently desktop-targeted on this device. Profile editing, tracking, and document features remain available.</p> : null}

        <details className="settings-advanced">
          <summary>Advanced Local AI Settings</summary>
          <div className="local-ai-settings-grid">
            <div className="local-ai-diagnostics-list">
              <div><span>Currently using</span><strong>{acceleratorLabel(runtimeSnapshot.diagnostics.actualAccelerator)}</strong></div>
              <div><span>Browser storage</span><strong>{storageEstimate ? `${byteSize(storageEstimate.usage)} used of ${byteSize(storageEstimate.quota)}; ${storageEstimate.persisted ? 'protected from automatic cleanup' : 'may be cleared when space is low'}` : 'Unavailable'}</strong></div>
            </div>
          </div>
          <div className="resume-builder-actions" aria-label="Advanced Local AI controls">
            <Button disabled={runtimeSnapshot.state !== 'ready'} onClick={() => void benchmark()}><Gauge aria-hidden="true" size={17} /> Run Speed Test</Button>
            <Button disabled={runtimeSnapshot.state === 'running' || runtimeSnapshot.state === 'disposed'} onClick={() => void resetRuntime()}><RefreshCw aria-hidden="true" size={17} /> Stop Local AI</Button>
            <Button disabled={!availableModel || runtimeSnapshot.state === 'running'} onClick={() => void removeModel()}><Trash2 aria-hidden="true" size={17} /> Remove Local AI Download</Button>
            <Button onClick={exportDiagnostics}><FileText aria-hidden="true" size={17} /> Download Technical Report</Button>
          </div>
        </details>
      </section>

      <section className="surface-panel settings-preferences-panel" aria-labelledby="local-data-title">
        <div className="settings-preferences-heading">
          <HardDrive aria-hidden="true" size={24} />
          <div>
            <h3 className="section-title" id="local-data-title">Your Saved Data</h3>
            <p className="section-copy">ApplyFill saves your work only in this browser. Ask the browser to protect it from automatic cleanup, or permanently delete it.</p>
            {storageMessage ? <p className="field-hint" role="status">{storageMessage}</p> : null}
          </div>
        </div>
        <div className="resume-builder-actions">
          <Button disabled={storageEstimate?.persisted === true} onClick={() => void requestPersistentStorage()}><HardDrive aria-hidden="true" size={17} /> Protect Saved Data</Button>
          <Button onClick={() => void deleteLocalData()} variant="danger">
            <Trash2 size={17} aria-hidden="true" />
            Delete All Saved Data
          </Button>
        </div>
      </section>

      <section className="responsive-grid" aria-label="Application settings">
        {settingsSections.map((section) => {
          const Icon = section.icon;

          return (
            <article className="surface-panel page-stack" style={{ padding: '24px' }} key={section.title}>
              <div className="toolbar-row">
                <Icon size={24} aria-hidden="true" />
                <span className="status-pill">{section.status}</span>
              </div>
              <div>
                <h3 className="section-title">{section.title}</h3>
                <p className="section-copy">{section.copy}</p>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

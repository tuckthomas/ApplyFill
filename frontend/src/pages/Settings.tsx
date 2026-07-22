import { useEffect, useState } from 'react';
import { BrainCircuit, CalendarDays, CheckCircle2, Download, Gauge, HardDrive, FileText, Plug, RefreshCw, ShieldCheck, Trash2, Unplug } from 'lucide-react';
import AppSelect from '../components/ui/AppSelect';
import Button from '../components/ui/Button';
import { useDateFormatPreference } from '../features/preferences/dateFormatPreference';
import type { DateFormatPreference } from '../features/preferences/dateFormatPreference';
import { clearApplyFillLocalData } from '../features/storage/localDatabase';
import {
  candidateModels,
  removeCachedModel,
  loadDeployedModelManifest,
  localAiRuntime
} from '../features/local-ai';
import type { AcceleratorPreference, ModelManifestEntry, RuntimeProgress, RuntimeSnapshot } from '../features/local-ai';
import { downloadBlob } from '../features/resume/resumeDownloads';
import Checkbox from '../components/ui/Checkbox';
import { loadProfileDocument } from '../features/profile/profileBuilder';
import {
  AUTOFILL_EXTENSION_ID_KEY,
  connectAutofillExtension,
  createScopedAutofillValues,
  disconnectAutofillExtension,
  inspectAutofillExtension,
  isValidExtensionId
} from '../features/autofill/extensionHandoff';
import { createLocalAiAutofillProposals } from '../features/autofill/localAutofillMapper';

type DateFormatOption = {
  label: string;
  value: DateFormatPreference;
};

const DATE_FORMAT_OPTIONS: DateFormatOption[] = [
  { label: 'Month/day/year (MM/DD/YYYY)', value: 'MM/DD/YYYY' },
  { label: 'Day/month/year (DD/MM/YYYY)', value: 'DD/MM/YYYY' }
];

type AcceleratorOption = { label: string; value: AcceleratorPreference };
const ACCELERATOR_OPTIONS: AcceleratorOption[] = [
  { label: 'Automatic', value: 'automatic' },
  { label: 'Experimental NPU (WebNN)', value: 'experimental-npu' },
  { label: 'GPU (WebGPU)', value: 'webgpu' },
  { label: 'CPU (WASM)', value: 'wasm' }
];

const ACCELERATOR_STORAGE_KEY = 'applyfill.local-ai.accelerator';

const settingsSections = [
  {
    title: 'Document Export',
    status: 'Portable',
    icon: FileText,
    copy: 'Profiles and resume drafts have validated JSON exports. PDF and DOCX files are generated directly in this browser.'
  },
  {
    title: 'Local Storage',
    status: 'This browser',
    icon: HardDrive,
    copy: 'Profiles, resume drafts, tracked applications, and dashboard settings stay in this browser. There is no ApplyFill account database or automatic cloud backup.'
  },
  {
    title: 'Security',
    status: 'Required',
    icon: ShieldCheck,
    copy: 'Downloaded backups contain sensitive personal data and are not encrypted. Browser-local AI also does not encrypt IndexedDB or protect an unlocked browser profile.'
  }
];

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
  const [aiMessage, setAiMessage] = useState('Local AI has not been initialized.');
  const [progress, setProgress] = useState<RuntimeProgress | null>(null);
  const [storageEstimate, setStorageEstimate] = useState<{ persisted: boolean; quota?: number; usage?: number } | null>(null);
  const [accelerator, setAccelerator] = useState<AcceleratorPreference>(() => {
    const saved = localStorage.getItem(ACCELERATOR_STORAGE_KEY);
    return ACCELERATOR_OPTIONS.some((option) => option.value === saved) ? saved as AcceleratorPreference : 'automatic';
  });
  const [availableModel, setAvailableModel] = useState<ModelManifestEntry | null>(null);
  const [extensionId, setExtensionId] = useState(() => localStorage.getItem(AUTOFILL_EXTENSION_ID_KEY) ?? '');
  const [connectionCode, setConnectionCode] = useState('');
  const [includeSensitiveAutofill, setIncludeSensitiveAutofill] = useState(false);
  const [extensionConnected, setExtensionConnected] = useState(false);
  const [extensionMessage, setExtensionMessage] = useState('No job-site tab is connected.');
  const isResumeApproved = availableModel?.approvedTasks.includes('resume-tailoring-draft') ?? false;

  useEffect(() => localAiRuntime.subscribe(setRuntimeSnapshot), []);

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

  const setAcceleratorPreference = (value: AcceleratorPreference) => {
    setAccelerator(value);
    localStorage.setItem(ACCELERATOR_STORAGE_KEY, value);
  };

  const checkCompatibility = async () => {
    setAiMessage('Checking local browser accelerators…');
    try {
      const capabilities = await localAiRuntime.detectCapabilities();
      const available = Object.entries(capabilities.accelerators).filter(([, value]) => value.available).map(([name]) => name);
      setAiMessage(available.length ? `Available local accelerators: ${available.join(', ')}.` : 'No supported local accelerator was detected. Non-AI features remain available.');
    } catch {
      setAiMessage('Local AI compatibility could not be checked in this browser.');
    }
  };

  const initializeModel = async () => {
    if (!availableModel) return;
    setProgress(null);
    setAiMessage('Preparing the approved local model…');
    try {
      const diagnostics = await localAiRuntime.initialize({
        acceleratorPreference: accelerator,
        model: availableModel,
        onProgress: (next) => { setProgress(next); setAiMessage(next.message); }
      });
      setAiMessage(`Local model ready on ${diagnostics.actualAccelerator ?? 'the selected accelerator'}${diagnostics.fallbackReason ? `. Fallback: ${diagnostics.fallbackReason}` : '.'}`);
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : 'The local model could not be initialized.');
    }
  };

  const resetRuntime = async () => {
    try {
      await localAiRuntime.reset();
      setProgress(null);
      setAiMessage('The model was removed from active memory. No profile data was deleted.');
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : 'The local AI runtime could not be reset.');
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
      setAiMessage(removed ? `Removed ${removed} verified model chunk${removed === 1 ? '' : 's'}. Profile and resume data were not changed.` : 'No cached model chunks were found. Profile and resume data were not changed.');
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : 'The cached model could not be removed.');
    }
  };

  const benchmark = async () => {
    setAiMessage('Running a content-free local benchmark…');
    try {
      await localAiRuntime.generate({ input: 'Return exactly: LOCAL BENCHMARK COMPLETE', maxOutputTokens: 16 });
      const diagnostics = localAiRuntime.snapshot.diagnostics;
      setAiMessage(`Benchmark complete. First token: ${diagnostics.firstTokenLatencyMs?.toFixed(0) ?? 'unavailable'} ms; speed: ${diagnostics.generationTokensPerSecond?.toFixed(1) ?? 'unavailable'} tokens/second.`);
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : 'The local benchmark failed.');
    }
  };

  const exportDiagnostics = () => {
    downloadBlob(new Blob([localAiRuntime.exportDiagnostics()], { type: 'application/json' }), 'applyfill-local-ai-diagnostics.json');
    setAiMessage('Privacy-safe runtime diagnostics downloaded. They contain no profile, job, prompt, or generated text.');
  };

  const requestPersistentStorage = async () => {
    try {
      const persisted = await navigator.storage.persist();
      const estimate = await navigator.storage.estimate();
      setStorageEstimate({ persisted, quota: estimate.quota, usage: estimate.usage });
      setAiMessage(persisted ? 'The browser granted persistent site storage.' : 'The browser did not grant persistent storage. Download backups because site data may be evicted.');
    } catch {
      setAiMessage('Persistent storage could not be requested in this browser.');
    }
  };

  const deleteLocalData = async () => {
    const confirmed = window.confirm(
      'Permanently delete the local profile, resume drafts, job tracker, and dashboard data from this browser? Download any backups you need first.'
    );
    if (!confirmed) return;
    try {
      await clearApplyFillLocalData();
      setStorageMessage('Local profile, resume drafts, tracker, and dashboard data were deleted from this browser.');
    } catch {
      setStorageMessage('Local data could not be deleted. Check browser site-storage permissions and try again.');
    }
  };

  const connectExtension = async () => {
    setExtensionMessage('Connecting to the user-started extension session…');
    try {
      const profile = await loadProfileDocument();
      if (!profile?.isComplete) throw new Error('Complete My Profile before creating an autofill packet.');
      if (!isValidExtensionId(extensionId)) throw new Error('Enter the 32-character extension ID from the Chromium extension details page.');
      const values = createScopedAutofillValues(profile, includeSensitiveAutofill);
      setExtensionMessage('Inspecting redacted field descriptors from the approved job tab…');
      const fields = await inspectAutofillExtension(extensionId, connectionCode);
      setExtensionMessage(runtimeSnapshot.state === 'ready'
        ? 'Mapping ambiguous fields with the approved local model…'
        : 'Local AI is not ready; known fields will use deterministic mapping and ambiguous fields will remain manual.');
      const aiMapping = await createLocalAiAutofillProposals({ runtime: localAiRuntime, profile, fields, values });
      const scopedValues = [...values, ...aiMapping.generatedValues];
      await connectAutofillExtension({ extensionId, connectionCode, values: scopedValues, proposals: aiMapping.proposals });
      localStorage.setItem(AUTOFILL_EXTENSION_ID_KEY, extensionId.trim());
      setExtensionConnected(true);
      setExtensionMessage(`${scopedValues.length} scoped values and ${aiMapping.proposals.length} local-AI proposal${aiMapping.proposals.length === 1 ? '' : 's'} are ready for review inside the extension. Nothing has been filled or submitted.`);
    } catch (error) {
      setExtensionConnected(false);
      setExtensionMessage(error instanceof Error ? error.message : 'The extension could not be connected.');
    }
  };

  const disconnectExtension = async () => {
    try {
      await disconnectAutofillExtension(extensionId, connectionCode);
      setExtensionMessage('The extension session was cleared from memory.');
    } catch {
      setExtensionMessage('The local connection was cleared. The extension session was already absent or unreachable.');
    } finally {
      setExtensionConnected(false);
      setConnectionCode('');
      setIncludeSensitiveAutofill(false);
    }
  };

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h2 className="page-title">Settings</h2>
          <p className="page-copy">Control regional preferences, desktop Local AI, exports, storage, and security boundaries.</p>
        </div>
      </header>

      <section className="surface-panel settings-preferences-panel" aria-labelledby="regional-preferences-title">
        <div className="settings-preferences-heading">
          <CalendarDays aria-hidden="true" size={24} />
          <div>
            <h3 className="section-title" id="regional-preferences-title">Regional Preferences</h3>
            <p className="section-copy">Control how dates are entered and displayed throughout ApplyFill.</p>
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
            <h3 className="section-title" id="autofill-extension-title">Local Autofill Extension</h3>
            <p className="section-copy">Connect one user-approved job-site tab to this browser-only profile. The extension previews every mapping and never submits.</p>
          </div>
          <span className="status-pill">{extensionConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <div className="autofill-extension-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="autofill-extension-id">Chromium Extension ID</label>
            <input className="form-input" id="autofill-extension-id" maxLength={32} onChange={(event) => setExtensionId(event.target.value.toLowerCase())} placeholder="Paste the ID from Manage extensions" spellCheck={false} value={extensionId} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="autofill-connection-code">One-time Connection Code</label>
            <input className="form-input" id="autofill-connection-code" onChange={(event) => setConnectionCode(event.target.value)} placeholder="Open the extension on the job tab, then paste its code" spellCheck={false} value={connectionCode} />
          </div>
        </div>
        <Checkbox checked={includeSensitiveAutofill} label="Include application-only sensitive answers in this packet" onChange={(event) => setIncludeSensitiveAutofill(event.target.checked)} />
        <p className="field-hint">When selected, government identifiers, work authorization, sponsorship, and voluntary demographics enter the extension's short-lived memory. They bypass AI, stay masked, and require another per-field confirmation immediately before insertion.</p>
        <p className="field-hint" role="status" aria-live="polite">{extensionMessage}</p>
        <div className="resume-builder-actions">
          <Button disabled={extensionConnected || !extensionId.trim() || !connectionCode.trim()} onClick={() => void connectExtension()} variant="primary"><Plug aria-hidden="true" size={17} /> Connect for Review</Button>
          <Button disabled={!extensionConnected} onClick={() => void disconnectExtension()}><Unplug aria-hidden="true" size={17} /> Disconnect & Clear Session</Button>
        </div>
      </section>

      <section className="surface-panel local-ai-settings-panel" aria-labelledby="local-ai-settings-title">
        <div className="settings-preferences-heading">
          <BrainCircuit aria-hidden="true" size={24} />
          <div>
            <h3 className="section-title" id="local-ai-settings-title">Desktop Local AI</h3>
            <p className="section-copy">LiteRT runs supported models inside this browser. No ApplyFill server or cloud AI provider is used.</p>
          </div>
          <span className="status-pill">{runtimeSnapshot.state}</span>
        </div>

        <div className="local-ai-settings-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="local-ai-accelerator">Accelerator Preference</label>
            <AppSelect<AcceleratorOption>
              inputId="local-ai-accelerator"
              isSearchable={false}
              onChange={(option) => { if (option) setAcceleratorPreference(option.value); }}
              options={ACCELERATOR_OPTIONS}
              value={ACCELERATOR_OPTIONS.find((option) => option.value === accelerator)}
            />
            <p className="field-hint"><strong>NPU</strong> is a dedicated local AI processor; <strong>WebNN</strong> is the experimental browser path to it. If the model cannot use it, ApplyFill reports the fallback instead of hiding it.</p>
          </div>
          <div className="local-ai-diagnostics-list">
            <div><span>Requested</span><strong>{runtimeSnapshot.diagnostics.desiredAccelerator ?? accelerator}</strong></div>
            <div><span>Actual</span><strong>{runtimeSnapshot.diagnostics.actualAccelerator ?? 'Not running'}</strong></div>
            <div><span>Fallback</span><strong>{runtimeSnapshot.diagnostics.fallbackReason ?? 'None reported'}</strong></div>
            <div><span>Storage</span><strong>{storageEstimate ? `${byteSize(storageEstimate.usage)} of ${byteSize(storageEstimate.quota)}; ${storageEstimate.persisted ? 'persistent' : 'evictable'}` : 'Unavailable'}</strong></div>
          </div>
        </div>

        <div className="local-ai-model-card">
          <div>
            <h4>{availableModel?.displayName ?? 'No evaluation model deployed'}</h4>
            <p className="section-copy">{availableModel
              ? `${byteSize(availableModel.artifact.byteSize)} explicit download · ${availableModel.license.name}. ${isResumeApproved ? 'Approved for resume tailoring.' : 'Provisional: benchmark and evaluation only; resume suggestions remain blocked.'}`
              : `${candidateModels.length} candidate models are documented, but downloads remain disabled until quality, privacy, hardware, integrity, and license gates pass.`}</p>
          </div>
          <span className="status-pill">{isResumeApproved ? 'Approved' : availableModel ? 'Provisional evaluation' : 'Evaluation required'}</span>
        </div>

        {progress ? <div className="local-ai-progress" role="progressbar" aria-label={progress.message} aria-valuemin={0} aria-valuemax={progress.total ?? undefined} aria-valuenow={progress.completed}><span style={{ width: progress.total ? `${Math.min(100, progress.completed / progress.total * 100)}%` : '20%' }} /></div> : null}
        <p className="field-hint" role="status" aria-live="polite">{aiMessage}</p>

        <div className="resume-builder-actions" aria-label="Local AI controls">
          <Button onClick={() => void checkCompatibility()}><CheckCircle2 aria-hidden="true" size={17} /> Compatibility Test</Button>
          <Button disabled={!availableModel || ['downloading', 'compiling', 'running'].includes(runtimeSnapshot.state)} onClick={() => void initializeModel()} variant="primary"><Download aria-hidden="true" size={17} /> Download / Update Model</Button>
          <Button disabled={runtimeSnapshot.state !== 'ready'} onClick={() => void benchmark()}><Gauge aria-hidden="true" size={17} /> Run Benchmark</Button>
          <Button disabled={runtimeSnapshot.state === 'running' || runtimeSnapshot.state === 'disposed'} onClick={() => void resetRuntime()}><RefreshCw aria-hidden="true" size={17} /> Release Model Memory</Button>
          <Button disabled={!availableModel || runtimeSnapshot.state === 'running'} onClick={() => void removeModel()}><Trash2 aria-hidden="true" size={17} /> Remove Cached Model</Button>
          <Button onClick={exportDiagnostics}><FileText aria-hidden="true" size={17} /> Export Diagnostics</Button>
          <Button disabled={storageEstimate?.persisted === true} onClick={() => void requestPersistentStorage()}><HardDrive aria-hidden="true" size={17} /> Request Persistent Storage</Button>
        </div>

        <p className="field-hint">Resetting local AI is separate from “Delete Local Data” and does not erase your profile. Local inference keeps approved inputs on this device, but it does not encrypt IndexedDB or protect data from another person or extension using this browser profile.</p>
        {/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? <p className="field-hint">Local AI is currently desktop-targeted on this device. Profile editing, tracking, and document features remain available.</p> : null}
      </section>

      <section className="surface-panel settings-preferences-panel" aria-labelledby="local-data-title">
        <div className="settings-preferences-heading">
          <HardDrive aria-hidden="true" size={24} />
          <div>
            <h3 className="section-title" id="local-data-title">Local Data</h3>
            <p className="section-copy">Delete the sensitive data ApplyFill stores in this browser. This cannot be undone.</p>
            {storageMessage ? <p className="field-hint" role="status">{storageMessage}</p> : null}
          </div>
        </div>
        <Button onClick={() => void deleteLocalData()} variant="danger">
          <Trash2 size={17} aria-hidden="true" />
          Delete Local Data
        </Button>
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

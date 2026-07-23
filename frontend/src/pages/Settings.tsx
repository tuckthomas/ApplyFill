import { useEffect, useState } from 'react';
import { BrainCircuit, CalendarDays, Database, ShieldCheck } from 'lucide-react';
import AppSelect from '../components/ui/AppSelect';
import Button from '../components/ui/Button';
import { useDateFormatPreference } from '../features/preferences/dateFormatPreference';
import type { DateFormatPreference } from '../features/preferences/dateFormatPreference';
import {
  browserAgentClient,
} from '../features/browser-agent/browserAgentClient';
import type { PrivateAiStatus } from '../features/browser-agent/contracts';

type DateFormatOption = {
  label: string;
  value: DateFormatPreference;
};

const DATE_FORMAT_OPTIONS: DateFormatOption[] = [
  { label: 'Month/day/year (MM/DD/YYYY)', value: 'MM/DD/YYYY' },
  { label: 'Day/month/year (DD/MM/YYYY)', value: 'DD/MM/YYYY' },
];

const initialPrivateAiStatus: PrivateAiStatus = {
  message: 'Checking Private AI…',
  state: 'checking',
};

const statusLabel: Record<PrivateAiStatus['state'], string> = {
  failed: 'Needs attention',
  'not-ready': 'Not set up',
  ready: 'Ready',
  checking: 'Checking',
  downloading: 'Downloading',
  installing: 'Installing',
  updating: 'Updating',
};

export default function Settings() {
  const {
    dateFormat,
    error: dateFormatError,
    isLoading: isDateFormatLoading,
    retry: retryDateFormat,
    setDateFormat,
  } = useDateFormatPreference();
  const [privateAi, setPrivateAi] = useState(initialPrivateAiStatus);
  const [isCheckingAi, setIsCheckingAi] = useState(true);
  const [isSettingUpAi, setIsSettingUpAi] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void browserAgentClient.getPrivateAiStatus(controller.signal)
      .then(setPrivateAi)
      .catch(() => setPrivateAi({ message: 'The local ApplyFill service is not running.', state: 'failed' }))
      .finally(() => setIsCheckingAi(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!['checking', 'downloading', 'installing', 'updating'].includes(privateAi.state)) return;
    const timer = window.setInterval(() => {
      void browserAgentClient.getPrivateAiStatus().then(setPrivateAi).catch(() => undefined);
    }, 3_000);
    return () => window.clearInterval(timer);
  }, [privateAi.state]);

  const setUpPrivateAi = async () => {
    setIsSettingUpAi(true);
    setPrivateAi((current) => ({ ...current, message: 'ApplyFill is setting up Private AI…', state: 'installing' }));
    try {
      setPrivateAi(await browserAgentClient.setupPrivateAi());
    } catch (error) {
      setPrivateAi({
        message: error instanceof Error ? error.message : 'Private AI setup could not start. Try again.',
        state: 'failed',
      });
    } finally {
      setIsSettingUpAi(false);
    }
  };

  const refreshPrivateAi = async () => {
    setIsCheckingAi(true);
    try {
      setPrivateAi(await browserAgentClient.getPrivateAiStatus());
    } catch (error) {
      setPrivateAi({
        message: error instanceof Error
          ? error.message
          : 'ApplyFill could not check Private AI. Keep ApplyFill open, then try again.',
        state: 'failed',
      });
    } finally {
      setIsCheckingAi(false);
    }
  };

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h2 className="page-title">Settings</h2>
          <p className="page-copy">Choose how ApplyFill works on this computer.</p>
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
            isDisabled={isDateFormatLoading}
            isSearchable={false}
            onChange={(option) => {
              if (option) setDateFormat(option.value);
            }}
            options={DATE_FORMAT_OPTIONS}
            value={DATE_FORMAT_OPTIONS.find((option) => option.value === dateFormat)}
          />
          {dateFormatError ? (
            <div className="settings-preference-error" role="alert">
              <p className="field-error">{dateFormatError}</p>
              <Button onClick={retryDateFormat}>Try Again</Button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="surface-panel local-ai-settings-panel" aria-labelledby="private-ai-title">
        <div className="settings-preferences-heading">
          <BrainCircuit aria-hidden="true" size={24} />
          <div>
            <h3 className="section-title" id="private-ai-title">Private AI</h3>
            <p className="section-copy">ApplyFill uses AI on this computer to read resumes, improve writing, and work through job applications.</p>
          </div>
          <span className="status-pill">{isCheckingAi ? 'Checking' : statusLabel[privateAi.state]}</span>
        </div>

        {privateAi.progress !== undefined ? (
          <div
            aria-label="Private AI setup progress"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={privateAi.progress}
            className="local-ai-progress"
            role="progressbar"
          >
            <span style={{ width: `${Math.max(0, Math.min(100, privateAi.progress))}%` }} />
          </div>
        ) : null}

        <p className="field-hint" role="status" aria-live="polite">{privateAi.message}</p>
        <p className="field-hint">Setup checks this computer and chooses the right setup automatically. The one-time download is about 8 GB and stays on this computer.</p>

        <div className="resume-builder-actions">
          {privateAi.state !== 'ready' ? (
            <Button disabled={isSettingUpAi || ['checking', 'downloading', 'installing', 'updating'].includes(privateAi.state)} onClick={() => void setUpPrivateAi()} variant="primary">
              <BrainCircuit aria-hidden="true" size={17} /> {['downloading', 'installing', 'updating'].includes(privateAi.state) ? 'Setting Up Private AI…' : 'Set Up Private AI'}
            </Button>
          ) : null}
          <Button disabled={isCheckingAi} onClick={() => void refreshPrivateAi()}>Check Again</Button>
        </div>
      </section>

      <section className="surface-panel settings-preferences-panel" aria-labelledby="local-data-title">
        <div className="settings-preferences-heading">
          <Database aria-hidden="true" size={24} />
          <div>
            <h3 className="section-title" id="local-data-title">Your Data</h3>
            <p className="section-copy">Profiles, resumes, tracked applications, and Browser Agent history are stored privately by ApplyFill on this computer.</p>
          </div>
          <span className="status-pill">Local</span>
        </div>
        <p className="field-hint">Store downloaded or copied files securely.</p>
      </section>

      <section className="surface-panel settings-preferences-panel" aria-labelledby="privacy-boundary-title">
        <div className="settings-preferences-heading">
          <ShieldCheck aria-hidden="true" size={24} />
          <div>
            <h3 className="section-title" id="privacy-boundary-title">Privacy Boundary</h3>
            <p className="section-copy">Private AI, the job-application window, your saved information, and ApplyFill activity remain on this computer unless you intentionally export or share them.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

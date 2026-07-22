import { useRef, useState } from 'react';
import { Clipboard, Download, Upload } from 'lucide-react';
import Button from '../ui/Button';
import {
  parseProfileDocument,
  saveProfileDocument
} from '../../features/profile/profileBuilder';
import type { LocalProfileDocument } from '../../features/profile/profileBuilder';

type ProfileDataPanelProps = {
  document: LocalProfileDocument;
  onImported: (document: LocalProfileDocument) => void;
};

const fileName = () => `applyfill-profile-${new Date().toISOString().slice(0, 10)}.json`;

export default function ProfileDataPanel({ document, onImported }: ProfileDataPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const json = JSON.stringify(document, null, 2);

  const copyProfile = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setMessage('Profile JSON copied to your clipboard.');
    } catch {
      setMessage('The browser did not allow clipboard access.');
    }
  };

  const downloadProfile = () => {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = window.document.createElement('a');
    link.href = url;
    link.download = fileName();
    window.document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setMessage('Profile backup downloaded. Keep it somewhere private.');
  };

  const importProfile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const imported = parseProfileDocument(await file.text());
      const saved = await saveProfileDocument(imported);
      onImported(saved);
      setMessage('Profile backup imported into this browser.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The profile backup could not be imported.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <section className="profile-data-panel" aria-labelledby="profile-data-title">
      <div className="profile-data-heading">
        <div>
          <h3 className="section-title" id="profile-data-title">Your Structured Profile Data</h3>
          <p className="section-copy">
            This is the versioned JSON document stored in this browser. Download backups regularly;
            ApplyFill cannot recover locally deleted data. Exact government identifier values appear below
            and are included when you copy or download this document.
          </p>
        </div>
        <div className="toolbar-row profile-data-actions" aria-label="Profile data controls">
          <Button onClick={() => void copyProfile()} variant="secondary">
            <Clipboard size={17} aria-hidden="true" />
            Copy
          </Button>
          <Button onClick={downloadProfile} variant="secondary">
            <Download size={17} aria-hidden="true" />
            Download
          </Button>
          <Button onClick={() => fileInputRef.current?.click()} variant="secondary">
            <Upload size={17} aria-hidden="true" />
            Import
          </Button>
          <input
            ref={fileInputRef}
            aria-hidden="true"
            className="visually-hidden"
            type="file"
            accept="application/json,.json"
            onChange={(event) => void importProfile(event.target.files?.[0])}
            tabIndex={-1}
          />
        </div>
      </div>

      {message ? <p className="profile-data-message" role="status">{message}</p> : null}
      <pre className="profile-data-code" tabIndex={0} aria-label="Structured profile JSON"><code>{json}</code></pre>
      <p className="field-hint sensitive-field-warning">Downloaded files and clipboard copies may contain government identifiers and other sensitive personal information. They are not encrypted by ApplyFill.</p>
    </section>
  );
}

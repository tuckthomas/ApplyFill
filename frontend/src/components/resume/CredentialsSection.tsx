import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import Select from '../ui/AppSelect';
import { selectStyles } from '../../constants/location';
import FormModal from '../ui/FormModal';
import RepeatableEmptyState from '../ui/RepeatableEmptyState';
import RepeatableSectionHeader from '../ui/RepeatableSectionHeader';
import RichTextEditor from './RichTextEditor';
import { EMPTY_RICH_TEXT_VALUE } from '../../features/rich-text/richText';

export type CredentialType = 'Certificate' | 'Certification' | 'License' | 'Registration' | 'Permit' | 'Other';

export type CredentialEntry = {
  id: number;
  type: CredentialType;
  name: string;
  issuer: string;
  credentialId: string;
  credentialUrl: string;
  issueDate: string;
  expirationDate: string;
  doesNotExpire: boolean;
  details: string;
};

const typeOptions = ['Certificate', 'Certification', 'License', 'Registration', 'Permit', 'Other']
  .map((value) => ({ label: value, value })) as Array<{ label: CredentialType; value: CredentialType }>;

const createCredential = (): CredentialEntry => ({
  id: Date.now() + Math.floor(Math.random() * 1_000),
  type: 'Certification',
  name: '',
  issuer: '',
  credentialId: '',
  credentialUrl: '',
  issueDate: '',
  expirationDate: '',
  doesNotExpire: false,
  details: EMPTY_RICH_TEXT_VALUE,
});

type CredentialsSectionProps = {
  credentials: CredentialEntry[];
  onChange: Dispatch<SetStateAction<CredentialEntry[]>>;
};

export default function CredentialsSection({ credentials, onChange }: CredentialsSectionProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftId, setDraftId] = useState<number | null>(null);
  const [validationMessage, setValidationMessage] = useState('');

  const addCredential = () => {
    const credential = createCredential();
    onChange((current) => [...current, credential]);
    setDraftId(credential.id);
    setEditingId(credential.id);
    setValidationMessage('');
  };

  const updateCredential = <Key extends keyof CredentialEntry>(
    id: number,
    key: Key,
    value: CredentialEntry[Key],
  ) => {
    onChange((current) => current.map((credential) => (
      credential.id === id ? { ...credential, [key]: value } : credential
    )));
  };

  const closeCredential = (id: number) => {
    if (draftId === id) {
      onChange((current) => current.filter((credential) => credential.id !== id));
      setDraftId(null);
    }
    setEditingId(null);
    setValidationMessage('');
  };

  const saveCredential = (credential: CredentialEntry) => {
    if (!credential.name.trim()) {
      setValidationMessage('Credential name is required.');
      return;
    }
    setDraftId(null);
    setEditingId(null);
    setValidationMessage('');
  };

  return (
    <div className="page-stack">
      <RepeatableSectionHeader
        actionLabel="Add Credential"
        onAdd={addCredential}
        title="Certifications & Licenses"
      />

      {credentials.length === 0 ? <RepeatableEmptyState title="No Credentials Added" /> : null}

      {credentials.map((credential, index) => {
        const prefix = `credential-${credential.id}`;
        const credentialTitle = credential.name.trim() || `Credential ${index + 1}`;
        const isEditing = editingId === credential.id;

        return (
          <section className="field-card job-transition-card" key={credential.id} aria-labelledby={`${prefix}-summary-title`}>
            <div className="job-summary">
              <div className="job-summary-header">
                <div className="job-summary-identity">
                  <h4 className="job-summary-title" id={`${prefix}-summary-title`}>{credentialTitle}</h4>
                  <p className="job-summary-company">{[credential.type, credential.issuer].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="job-summary-actions">
                  <button className="icon-button" onClick={() => setEditingId(credential.id)} type="button" aria-label={`Edit ${credentialTitle}`} data-tooltip={`Edit ${credentialTitle}`}>
                    <Pencil aria-hidden="true" size={18} />
                  </button>
                  <button
                    aria-label={`Remove ${credentialTitle}`}
                    className="icon-button icon-button-danger"
                    onClick={() => onChange((current) => current.filter((item) => item.id !== credential.id))}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" size={18} />
                  </button>
                </div>
              </div>
            </div>

            {isEditing ? (
              <FormModal
                className="credential-modal-dialog"
                closeLabel={`Close ${draftId === credential.id ? 'add' : 'edit'} credential`}
                description="Add the credential details once so they can be reused in applications and resumes."
                dirtyKey={JSON.stringify(credential)}
                initialFocusId={`${prefix}-type`}
                isOpen
                onClose={() => closeCredential(credential.id)}
                title={draftId === credential.id ? 'Add Credential' : `Edit ${credentialTitle}`}
              >
                <form className="page-stack credential-modal-form" onSubmit={(event) => {
                  event.preventDefault();
                  saveCredential(credential);
                }}>
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label" htmlFor={`${prefix}-type`}>Credential Type</label>
                      <Select
                        inputId={`${prefix}-type`}
                        options={typeOptions}
                        styles={selectStyles}
                        value={typeOptions.find((option) => option.value === credential.type)}
                        onChange={(option) => updateCredential(credential.id, 'type', (option as { value: CredentialType }).value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor={`${prefix}-name`}>Credential Name</label>
                      <input className="form-input" id={`${prefix}-name`} onChange={(event) => updateCredential(credential.id, 'name', event.target.value)} value={credential.name} />
                    </div>
                  </div>
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label" htmlFor={`${prefix}-issuer`}>Issuing Organization</label>
                      <input className="form-input" id={`${prefix}-issuer`} onChange={(event) => updateCredential(credential.id, 'issuer', event.target.value)} value={credential.issuer} />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor={`${prefix}-id`}>Credential ID</label>
                      <input className="form-input" id={`${prefix}-id`} onChange={(event) => updateCredential(credential.id, 'credentialId', event.target.value)} value={credential.credentialId} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor={`${prefix}-url`}>Credential URL</label>
                    <input className="form-input" id={`${prefix}-url`} onChange={(event) => updateCredential(credential.id, 'credentialUrl', event.target.value)} type="url" value={credential.credentialUrl} />
                  </div>
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label" htmlFor={`${prefix}-issued`}>Issue Date</label>
                      <input className="form-input" id={`${prefix}-issued`} onChange={(event) => updateCredential(credential.id, 'issueDate', event.target.value)} type="month" value={credential.issueDate} />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor={`${prefix}-expires`}>Expiration Date</label>
                      <input className="form-input" disabled={credential.doesNotExpire} id={`${prefix}-expires`} onChange={(event) => updateCredential(credential.id, 'expirationDate', event.target.value)} type="month" value={credential.expirationDate} />
                    </div>
                  </div>
                  <label className="checkbox-row" htmlFor={`${prefix}-no-expiration`}>
                    <input
                      checked={credential.doesNotExpire}
                      id={`${prefix}-no-expiration`}
                      onChange={(event) => {
                        updateCredential(credential.id, 'doesNotExpire', event.target.checked);
                        if (event.target.checked) updateCredential(credential.id, 'expirationDate', '');
                      }}
                      type="checkbox"
                    />
                    <span>This credential does not expire</span>
                  </label>
                  <RichTextEditor
                    editorClassName="rich-text-editor-credential"
                    label="Details"
                    labelId={`${prefix}-details-label`}
                    onChange={(value) => updateCredential(credential.id, 'details', value)}
                    placeholder="Add credential details"
                    toolbarId={`${prefix}-details-toolbar`}
                    value={credential.details}
                  />
                  {validationMessage ? <p className="form-error-message" role="alert">{validationMessage}</p> : null}
                  <div className="modal-form-actions">
                    <button className="btn btn-secondary" data-modal-close onClick={() => closeCredential(credential.id)} type="button">Cancel</button>
                    <button className="btn btn-primary" type="submit">Save Credential</button>
                  </div>
                </form>
              </FormModal>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

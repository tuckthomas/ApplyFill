import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Select from '../ui/AppSelect';
import { selectStyles } from '../../constants/location';
import RepeatableEmptyState from '../ui/RepeatableEmptyState';

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
  details: '',
});

type CredentialsSectionProps = {
  credentials: CredentialEntry[];
  onChange: Dispatch<SetStateAction<CredentialEntry[]>>;
};

export default function CredentialsSection({ credentials, onChange }: CredentialsSectionProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const addCredential = () => {
    const credential = createCredential();
    onChange((current) => [...current, credential]);
    setExpandedId(credential.id);
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

  return (
    <div className="page-stack">
      <div className="toolbar-row">
        <div>
          <h3 className="section-title">Certifications &amp; Licenses</h3>
        </div>
        <button className="btn btn-primary" onClick={addCredential} type="button">
          <Plus aria-hidden="true" size={18} /> Add Credential
        </button>
      </div>

      {credentials.length === 0 ? <RepeatableEmptyState title="No Credentials Added" /> : null}

      {credentials.map((credential, index) => {
        const prefix = `credential-${credential.id}`;
        const expanded = expandedId === credential.id;
        return (
          <section className="field-card page-stack" key={credential.id}>
            <div className="toolbar-row">
              <div>
                <h4 className="section-title">{credential.name || `Credential ${index + 1}`}</h4>
                <p className="field-hint">{[credential.type, credential.issuer].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="toolbar-row">
                <button className="btn btn-secondary" onClick={() => setExpandedId(expanded ? null : credential.id)} type="button">
                  {expanded ? 'Done' : 'Edit'}
                </button>
                <button
                  aria-label={`Remove ${credential.name || `credential ${index + 1}`}`}
                  className="icon-button icon-button-danger"
                  onClick={() => onChange((current) => current.filter((item) => item.id !== credential.id))}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={18} />
                </button>
              </div>
            </div>

            {expanded ? (
              <div className="page-stack">
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
                <div className="form-group">
                  <label className="form-label" htmlFor={`${prefix}-details`}>Details</label>
                  <textarea className="form-textarea" id={`${prefix}-details`} onChange={(event) => updateCredential(credential.id, 'details', event.target.value)} rows={4} value={credential.details} />
                </div>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

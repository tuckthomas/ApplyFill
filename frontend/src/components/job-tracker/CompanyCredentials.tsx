import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import Button from '../ui/Button';
import Select from '../ui/AppSelect';
import FormModal from '../ui/FormModal';
import {
  createCredential,
  deleteCredential,
  loadCredentials,
  loadVaultStatus,
  setupVault,
  unlockVault,
} from '../../features/companies/credentialVault';
import type { CompanyCredential, VaultStatus } from '../../features/companies/credentialVault';

type CompanyCredentialsProps = {
  companyId: string;
  companyName: string;
  inputId: string;
  onSelect: (credentialId: string) => void;
  selectedCredentialId: string;
};

type CredentialOption = {
  label: string;
  value: string;
};

const MANAGE_CREDENTIALS_VALUE = '__manage_credentials__';

export default function CompanyCredentials({
  companyId,
  companyName,
  inputId,
  onSelect,
  selectedCredentialId,
}: CompanyCredentialsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<VaultStatus>({ isConfigured: false, isUnlocked: false });
  const [credentials, setCredentials] = useState<CompanyCredential[]>([]);
  const [vaultPassword, setVaultPassword] = useState('');
  const [label, setLabel] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginUrl, setLoginUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!companyId) {
      setCredentials([]);
      return;
    }

    void loadCredentials(companyId)
      .then(setCredentials)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Sign-ins could not be loaded.'));
  }, [companyId]);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    void Promise.all([
      loadVaultStatus(),
      companyId ? loadCredentials(companyId) : Promise.resolve([]),
    ])
      .then(([vaultStatus, loadedCredentials]) => {
        setStatus(vaultStatus);
        setCredentials(loadedCredentials);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Sign-ins could not be loaded.'));
  }, [companyId, companyName, isOpen]);

  const options = useMemo<CredentialOption[]>(
    () => [
      ...credentials.map((credential) => ({
        label: `${credential.label} — ${credential.username}`,
        value: credential.id,
      })),
      { label: 'Manage sign-ins…', value: MANAGE_CREDENTIALS_VALUE },
    ],
    [credentials],
  );
  const selectedOption = options.find((option) => option.value === selectedCredentialId) ?? null;

  const dirtyKey = useMemo(
    () => JSON.stringify({ label, username, password, loginUrl }),
    [label, username, password, loginUrl],
  );

  const submitVaultPassword = async () => {
    try {
      const next = status.isConfigured
        ? await unlockVault(vaultPassword)
        : await setupVault(vaultPassword);
      setStatus(next);
      setVaultPassword('');
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The vault could not be unlocked.');
    }
  };

  const addCredential = async () => {
    if (!companyId) {
      setError('Select or create a company first.');
      return;
    }
    try {
      const created = await createCredential(companyId, { label, username, password, loginUrl });
      setCredentials((current) => [...current, created]);
      setLabel('');
      setUsername('');
      setPassword('');
      setLoginUrl('');
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The sign-in could not be saved.');
    }
  };

  return (
    <>
      <Select<CredentialOption>
        inputId={inputId}
        isClearable
        isDisabled={!companyId}
        isSearchable={false}
        onChange={(option) => {
          if (option?.value === MANAGE_CREDENTIALS_VALUE) {
            setIsOpen(true);
            return;
          }
          onSelect(option?.value ?? '');
        }}
        options={options}
        placeholder="Select a sign-in"
        value={selectedOption}
      />
      <FormModal
        closeLabel="Close company sign-ins"
        dirtyKey={dirtyKey}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={`${companyName || 'Company'} Sign-ins`}
      >
        {error ? <p className="form-error-message" role="alert">{error}</p> : null}
        {!status.isUnlocked ? (
          <div className="modal-form-grid">
            <div className="form-group tracker-form-full-width">
              <label className="form-label" htmlFor="credential-vault-password">
                {status.isConfigured ? 'Vault password' : 'Create vault password'}
              </label>
              <input
                autoComplete={status.isConfigured ? 'current-password' : 'new-password'}
                className="form-input"
                id="credential-vault-password"
                minLength={12}
                onChange={(event) => setVaultPassword(event.target.value)}
                type="password"
                value={vaultPassword}
              />
            </div>
            <div className="modal-form-actions tracker-form-full-width">
              <Button onClick={submitVaultPassword} variant="primary">
                {status.isConfigured ? 'Unlock' : 'Create Vault'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="page-stack">
            {credentials.map((credential) => (
              <article className="repeatable-entry-card" key={credential.id}>
                <div>
                  <label>
                    <input
                      checked={selectedCredentialId === credential.id}
                      name="application-credential"
                      onChange={() => onSelect(credential.id)}
                      type="radio"
                    />{' '}
                    <strong>{credential.label}</strong>
                  </label>
                  <p>{credential.username}</p>
                  {credential.loginUrl ? <a href={credential.loginUrl} rel="noreferrer" target="_blank">Open sign-in page</a> : null}
                </div>
                <button
                  aria-label={`Delete ${credential.label}`}
                  className="icon-button icon-button-danger"
                  onClick={() => void deleteCredential(credential.id).then(() => {
                    setCredentials((current) => current.filter((item) => item.id !== credential.id));
                    if (selectedCredentialId === credential.id) onSelect('');
                  })}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={18} />
                </button>
              </article>
            ))}
            <div className="modal-form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="credential-label">Account label</label>
                <input className="form-input" id="credential-label" onChange={(event) => setLabel(event.target.value)} placeholder="UKG Pro" value={label} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="credential-username">Username</label>
                <input autoComplete="username" className="form-input" id="credential-username" onChange={(event) => setUsername(event.target.value)} value={username} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="credential-password">Password</label>
                <input autoComplete="new-password" className="form-input" id="credential-password" onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="credential-login-url">Sign-in URL</label>
                <input className="form-input" id="credential-login-url" onChange={(event) => setLoginUrl(event.target.value)} placeholder="https://..." type="url" value={loginUrl} />
              </div>
              <div className="modal-form-actions tracker-form-full-width">
                <Button disabled={!label.trim() || !username.trim() || !password} onClick={addCredential} variant="primary">Save Sign-in</Button>
              </div>
            </div>
          </div>
        )}
      </FormModal>
    </>
  );
}

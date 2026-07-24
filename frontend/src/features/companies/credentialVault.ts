import { apiRequest } from '../api/localApiClient';

export type VaultStatus = {
  isConfigured: boolean;
  isUnlocked: boolean;
};

export type CompanyCredential = {
  id: string;
  companyId: string;
  label: string;
  username: string;
  loginUrl: string;
};

export const loadVaultStatus = async () =>
  (await apiRequest<VaultStatus>('/api/v1/credential-vault')).value;

export const setupVault = async (password: string) =>
  (await apiRequest<VaultStatus>('/api/v1/credential-vault/setup', {
    body: JSON.stringify({ password }),
    method: 'POST',
  })).value;

export const unlockVault = async (password: string) =>
  (await apiRequest<VaultStatus>('/api/v1/credential-vault/unlock', {
    body: JSON.stringify({ password }),
    method: 'POST',
  })).value;

export const loadCredentials = async (companyId: string) =>
  (await apiRequest<CompanyCredential[]>(
    `/api/v1/credential-vault/companies/${encodeURIComponent(companyId)}/credentials`,
  )).value;

export const createCredential = async (
  companyId: string,
  value: Pick<CompanyCredential, 'label' | 'username' | 'loginUrl'> & { password: string },
) => (await apiRequest<CompanyCredential>(
  `/api/v1/credential-vault/companies/${encodeURIComponent(companyId)}/credentials`,
  { body: JSON.stringify(value), method: 'POST' },
)).value;

export const deleteCredential = async (id: string) => {
  await apiRequest<void>(`/api/v1/credential-vault/credentials/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
};

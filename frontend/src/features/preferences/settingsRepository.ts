import { ApiClientError, apiRequest } from '../api/localApiClient';

export type SettingKey = 'dashboard' | 'date-format';

type SettingResponse<Content extends object> = {
  concurrencyToken: string;
  content: Content;
  key: SettingKey;
  schemaVersion: number;
  updatedAt: string;
};

export type StoredSetting<Content extends object> = {
  content: Content;
  schemaVersion: number;
  updatedAt: string;
};

const settingTokens = new Map<SettingKey, string>();
const saveQueues = new Map<SettingKey, Promise<unknown>>();

export const loadSetting = async <Content extends object>(
  key: SettingKey,
  signal?: AbortSignal,
): Promise<StoredSetting<Content> | null> => {
  try {
    const response = await apiRequest<SettingResponse<Content>>(
      `/api/v1/settings/${encodeURIComponent(key)}`,
      { signal },
    );
    settingTokens.set(key, response.value.concurrencyToken || response.etag || '');
    return {
      content: response.value.content,
      schemaVersion: response.value.schemaVersion,
      updatedAt: response.value.updatedAt,
    };
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      settingTokens.delete(key);
      return null;
    }
    throw error;
  }
};

export const saveSetting = <Content extends object>(
  key: SettingKey,
  schemaVersion: number,
  content: Content,
): Promise<StoredSetting<Content>> => {
  const previousSave = saveQueues.get(key) ?? Promise.resolve();
  const save = previousSave
    .catch(() => undefined)
    .then(async () => {
      const concurrencyToken = settingTokens.get(key);
      const response = await apiRequest<SettingResponse<Content>>(
        `/api/v1/settings/${encodeURIComponent(key)}`,
        {
          body: JSON.stringify({ content, schemaVersion }),
          method: 'PUT',
        },
        concurrencyToken ? { concurrencyToken } : {},
      );
      settingTokens.set(key, response.value.concurrencyToken || response.etag || '');
      return {
        content: response.value.content,
        schemaVersion: response.value.schemaVersion,
        updatedAt: response.value.updatedAt,
      };
    });

  saveQueues.set(key, save);
  void save.finally(() => {
    if (saveQueues.get(key) === save) saveQueues.delete(key);
  }).catch(() => undefined);
  return save;
};

export const resetSettingsRepositoryForTests = () => {
  settingTokens.clear();
  saveQueues.clear();
};

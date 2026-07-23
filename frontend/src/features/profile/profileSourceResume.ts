import { apiRequest, apiUrl, ApiClientError } from '../api/localApiClient';

export type ProfileSourceResumeMetadata = {
  createdAt: string;
  fileName: string;
  id: string;
  mediaType: string;
  sha256: string;
  sizeBytes: number;
};

export const loadProfileSourceResume = async (): Promise<ProfileSourceResumeMetadata | null> => {
  try {
    return (await apiRequest<ProfileSourceResumeMetadata>('/api/v1/profiles/current/source-resume')).value;
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) return null;
    throw error;
  }
};

export const saveProfileSourceResume = async (file: File): Promise<ProfileSourceResumeMetadata> => {
  const data = new FormData();
  data.append('file', file);
  return (await apiRequest<ProfileSourceResumeMetadata>(
    '/api/v1/profiles/current/source-resume',
    { body: data, method: 'PUT' },
  )).value;
};

export const loadProfileSourceResumeBlob = async (): Promise<Blob> => {
  let response: Response;
  try {
    response = await fetch(apiUrl('/api/v1/profiles/current/source-resume/content'), {
      credentials: 'include',
      headers: { Accept: 'application/pdf,application/octet-stream' },
      redirect: 'error',
    });
  } catch {
    throw new Error('ApplyFill could not reach its local service.');
  }
  if (!response.ok) throw new Error('The saved resume could not be opened.');
  return response.blob();
};

import { apiRequest } from '../api/localApiClient';

export type ResumeArtifactMetadata = {
  createdAt: string;
  fileName: string;
  id: string;
  mediaType: string;
  resumeId: string;
  sha256: string;
  sizeBytes: number;
};

export const saveResumeArtifact = async (
  resumeId: string,
  blob: Blob,
  fileName: string,
): Promise<ResumeArtifactMetadata> => {
  const data = new FormData();
  data.append('file', new File([blob], fileName, { type: blob.type }));
  const response = await apiRequest<ResumeArtifactMetadata>(
    `/api/v1/resumes/${encodeURIComponent(resumeId)}/artifacts`,
    { body: data, method: 'POST' },
  );
  return response.value;
};

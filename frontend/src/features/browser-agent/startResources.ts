import { loadApplications } from '../../components/job-tracker/jobApplication';
import { loadCurrentProfileResource } from '../profile/profileBuilder';
import { loadResumeCollection } from '../resume/resumeDocument';

export type BrowserAgentStartResources = {
  applications: Array<{
    companyName: string;
    id: string;
    jobTitle: string;
    targetJobUrl: string;
  }>;
  profileId: string | null;
  resumes: Array<{ id: string; title: string }>;
};

export const loadBrowserAgentStartResources = async (): Promise<BrowserAgentStartResources> => {
  const [profile, resumeCollection, applications] = await Promise.all([
    loadCurrentProfileResource(),
    loadResumeCollection(),
    loadApplications(),
  ]);
  return {
    applications: applications.map(({ companyName, id, jobTitle, targetJobUrl }) => ({
      companyName,
      id,
      jobTitle,
      targetJobUrl,
    })),
    profileId: profile?.id ?? null,
    resumes: resumeCollection.resumes.map(({ id, title }) => ({ id, title })),
  };
};

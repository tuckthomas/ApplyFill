import { lazy, Suspense, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import JobApplicationForm from '../components/job-tracker/JobApplicationForm';
import {
  createEmptyApplicationForm,
  formatJobApplicationLocation,
  loadApplications,
  saveApplications
} from '../components/job-tracker/jobApplication';
import type { JobApplication, JobApplicationFormState } from '../components/job-tracker/jobApplication';
import { loadProfileBuilderState } from '../features/profile/profileBuilder';
import { createRichTextFromPlainText, normalizeRichText } from '../features/rich-text/richText';

const BrowserAgent = lazy(() => import('./BrowserAgent'));

const createApplication = (value: JobApplicationFormState, id: string): JobApplication => ({
  ...value,
  id,
  companyName: value.companyName.trim(),
  jobTitle: value.jobTitle.trim(),
  location: formatJobApplicationLocation(value),
  city: value.city.trim(),
  targetJobUrl: value.targetJobUrl.trim(),
  jobDescription: normalizeRichText(value.jobDescription),
  notes: normalizeRichText(value.notes)
});

export default function JobApplicationEditor() {
  const navigate = useNavigate();
  const { applicationId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [existingApplication, setExistingApplication] = useState<JobApplication>();
  const [isLoading, setIsLoading] = useState(true);
  const [formState, setFormState] = useState<JobApplicationFormState>(() => createEmptyApplicationForm());
  const [formError, setFormError] = useState('');
  const [jobDescriptionError, setJobDescriptionError] = useState('');
  const [isImportingJobDescription, setIsImportingJobDescription] = useState(false);
  const mode = existingApplication ? 'edit' : 'add';

  useEffect(() => {
    let isCurrent = true;
    Promise.all([loadApplications(), loadProfileBuilderState()])
      .then(([loadedApplications, profile]) => {
        if (!isCurrent) return;
        const existing = applicationId
          ? loadedApplications.find((application) => application.id === applicationId)
          : undefined;
        setApplications(loadedApplications);
        setExistingApplication(existing);
        setFormState(existing ?? createEmptyApplicationForm(profile.data.profile.country));
        if (applicationId && !existing) setFormError('That saved application could not be found.');
      })
      .catch(() => { if (isCurrent) setFormError('ApplyFill could not load the saved application data.'); })
      .finally(() => { if (isCurrent) setIsLoading(false); });
    return () => { isCurrent = false; };
  }, [applicationId]);

  const updateFormField = <Key extends keyof JobApplicationFormState>(key: Key, value: JobApplicationFormState[Key]) => {
    setFormState((current) => ({ ...current, [key]: value }));
  };

  const saveApplication = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.companyName.trim() || !formState.jobTitle.trim()) {
      setFormError('Company and job title are required.');
      return;
    }

    if (!formState.targetJobUrl.trim()) {
      setFormError('A job posting or application URL is required.');
      return;
    }
    try {
      const url = new URL(formState.targetJobUrl);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported protocol');
    } catch {
      setFormError('Enter a valid HTTP or HTTPS job posting URL.');
      return;
    }

    const application = createApplication(formState, existingApplication?.id ?? crypto.randomUUID());
    const next = existingApplication
      ? applications.map((currentApplication) => currentApplication.id === existingApplication.id ? application : currentApplication)
      : [...applications, application];
    try {
      const persisted = await saveApplications(next);
      const saved = existingApplication
        ? persisted.find((item) => item.id === existingApplication.id) ?? application
        : persisted.at(-1) ?? application;
      setApplications(persisted);
      setExistingApplication(saved);
      navigate(`/job-tracker/${saved.id}/edit`, { replace: true });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'This application could not be saved.');
    }
  };

  const importJobDescription = async () => {
    const targetJobUrl = formState.targetJobUrl.trim();
    if (!targetJobUrl) return;

    try {
      const url = new URL(targetJobUrl);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported protocol');

      setJobDescriptionError('');
      setIsImportingJobDescription(true);
      window.open(url.toString(), '_blank', 'noopener,noreferrer');
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('The job posting could not be loaded.');

      const document = new DOMParser().parseFromString(await response.text(), 'text/html');
      document.querySelectorAll('script, style, noscript, svg').forEach((element) => element.remove());
      const description = document.body.textContent?.replace(/\s+/g, ' ').trim();
      if (!description) throw new Error('No readable text was found on the job posting.');

      updateFormField('jobDescription', createRichTextFromPlainText(description));
    } catch {
      setJobDescriptionError('The posting opened in a new tab, but its site does not allow its text to be imported automatically. Copy the description from that tab and paste it here.');
    } finally {
      setIsImportingJobDescription(false);
    }
  };

  if (isLoading) {
    return <p className="section-copy" role="status">Loading application data...</p>;
  }

  return (
    <div className="page-stack">
      <div className="job-application-heading">
        <button className="icon-button" type="button" onClick={() => navigate('/job-tracker')} aria-label="Back to Job Tracker" data-tooltip="Back to Job Tracker">
          <ArrowLeft size={22} aria-hidden="true" />
        </button>
        <header className="page-header job-application-page-header">
          <div>
          <h2 className="page-title">{mode === 'add' ? 'Add Application' : 'Edit Application'}</h2>
          <p className="page-copy">Capture the application once so it can later connect to resumes and application packets.</p>
          </div>
        </header>
      </div>
      <JobApplicationForm
        agentContent={existingApplication ? (
          <Suspense fallback={<p className="section-copy" role="status">Loading browser agent...</p>}>
            <BrowserAgent
              embedded
              initialApplication={existingApplication}
              onRunChange={(runId) => {
                const next = new URLSearchParams(searchParams);
                next.set('tab', 'agent');
                if (runId) next.set('runId', runId);
                else next.delete('runId');
                setSearchParams(next, { replace: true });
              }}
              runIdOverride={searchParams.get('runId')}
            />
          </Suspense>
        ) : null}
        error={formError}
        isImportingJobDescription={isImportingJobDescription}
        initialTab={searchParams.get('tab') === 'agent' && existingApplication ? 'agent' : 'details'}
        jobDescriptionError={jobDescriptionError}
        mode={mode}
        onCancel={() => navigate('/job-tracker')}
        onChange={updateFormField}
        onImportJobDescription={importJobDescription}
        onSubmit={(event) => void saveApplication(event)}
        value={formState}
      />
    </div>
  );
}

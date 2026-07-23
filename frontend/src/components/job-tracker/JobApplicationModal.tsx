import { lazy, Suspense, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import FormModal from '../ui/FormModal';
import JobApplicationForm from './JobApplicationForm';
import {
  createEmptyApplicationForm,
  formatJobApplicationLocation
} from './jobApplication';
import type { JobApplication, JobApplicationFormState } from './jobApplication';
import { loadProfileBuilderState } from '../../features/profile/profileBuilder';
import { createRichTextFromPlainText, normalizeRichText } from '../../features/rich-text/richText';

const BrowserAgent = lazy(() => import('../../pages/BrowserAgent'));

type JobApplicationModalProps = {
  application?: JobApplication;
  onClose: () => void;
  onSave: (application: JobApplication) => void;
};

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

export default function JobApplicationModal({ application, onClose, onSave }: JobApplicationModalProps) {
  const mode = application ? 'edit' : 'add';
  const [formState, setFormState] = useState<JobApplicationFormState>(() => (
    application ?? createEmptyApplicationForm()
  ));
  const [formError, setFormError] = useState('');
  const [jobDescriptionError, setJobDescriptionError] = useState('');
  const [isImportingJobDescription, setIsImportingJobDescription] = useState(false);
  const [agentRunId, setAgentRunId] = useState<string | null>(null);

  useEffect(() => {
    if (application) return;
    let isCurrent = true;
    void loadProfileBuilderState().then((profile) => {
      if (isCurrent) setFormState(createEmptyApplicationForm(profile.data.profile.country));
    });
    return () => { isCurrent = false; };
  }, [application]);

  const updateFormField = <Key extends keyof JobApplicationFormState>(key: Key, value: JobApplicationFormState[Key]) => {
    setFormState((current) => ({ ...current, [key]: value }));
  };

  const saveApplication = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.companyName.trim() || !formState.jobTitle.trim()) {
      setFormError('Company and job title are required.');
      return;
    }

    if (formState.targetJobUrl.trim()) {
      try {
        const url = new URL(formState.targetJobUrl);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported protocol');
      } catch {
        setFormError('Enter a valid HTTP or HTTPS job posting URL.');
        return;
      }
    }

    onSave(createApplication(formState, application?.id ?? `${Date.now()}-${Math.floor(Math.random() * 1000)}`));
    onClose();
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

  return (
    <FormModal
      className="job-application-modal-dialog"
      closeLabel={`Close ${mode} application`}
      description="Capture the application once so it can later connect to resumes and application packets."
      dirtyKey={JSON.stringify(formState)}
      isOpen
      onClose={onClose}
      title={mode === 'add' ? 'Add Application' : 'Edit Application'}
    >
      <JobApplicationForm
        agentContent={application ? (
          <Suspense fallback={<p className="section-copy" role="status">Loading browser agent...</p>}>
            <BrowserAgent
              embedded
              initialApplication={application}
              onRunChange={setAgentRunId}
              runIdOverride={agentRunId}
            />
          </Suspense>
        ) : null}
        error={formError}
        isImportingJobDescription={isImportingJobDescription}
        jobDescriptionError={jobDescriptionError}
        mode={mode}
        onCancel={onClose}
        onChange={updateFormField}
        onImportJobDescription={importJobDescription}
        onSubmit={saveApplication}
        value={formState}
      />
    </FormModal>
  );
}

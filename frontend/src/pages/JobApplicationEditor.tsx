import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

const createApplication = (value: JobApplicationFormState, id: string): JobApplication => ({
  ...value,
  id,
  companyName: value.companyName.trim(),
  jobTitle: value.jobTitle.trim(),
  location: formatJobApplicationLocation(value),
  city: value.city.trim(),
  targetJobUrl: value.targetJobUrl.trim(),
  notes: value.notes.trim()
});

export default function JobApplicationEditor() {
  const navigate = useNavigate();
  const { applicationId } = useParams();
  const applications = loadApplications();
  const existingApplication = applicationId ? applications.find((application) => application.id === applicationId) : undefined;
  const mode = existingApplication ? 'edit' : 'add';
  const defaultCountry = loadProfileBuilderState().data.profile.country;
  const [formState, setFormState] = useState<JobApplicationFormState>(() => (
    existingApplication ?? createEmptyApplicationForm(defaultCountry)
  ));
  const [formError, setFormError] = useState('');
  const [jobDescriptionError, setJobDescriptionError] = useState('');
  const [isImportingJobDescription, setIsImportingJobDescription] = useState(false);

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

    const application = createApplication(formState, existingApplication?.id ?? `${Date.now()}-${Math.floor(Math.random() * 1000)}`);
    saveApplications(existingApplication
      ? applications.map((currentApplication) => currentApplication.id === existingApplication.id ? application : currentApplication)
      : [...applications, application]);
    navigate(`/job-tracker/${application.id}/edit`, { replace: true });
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

      const escapedDescription = description.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      updateFormField('jobDescription', `<p>${escapedDescription}</p>`);
    } catch {
      setJobDescriptionError('The posting opened in a new tab, but its site does not allow its text to be imported automatically. Copy the description from that tab and paste it here.');
    } finally {
      setIsImportingJobDescription(false);
    }
  };

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
        error={formError}
        isImportingJobDescription={isImportingJobDescription}
        jobDescriptionError={jobDescriptionError}
        mode={mode}
        onCancel={() => navigate('/job-tracker')}
        onChange={updateFormField}
        onImportJobDescription={importJobDescription}
        onSubmit={saveApplication}
        value={formState}
      />
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { Pencil, UserRound, Wand2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  createDefaultProfileBuilderState,
  loadProfileDocument,
  PROFILE_BUILDER_STEPS,
  toProfileBuilderState
} from '../features/profile/profileBuilder';
import type { LocalProfileDocument } from '../features/profile/profileBuilder';
import Button from '../components/ui/Button';
import { getRichTextPlainText } from '../features/rich-text/richText';
import TabbedForm from '../components/ui/TabbedForm';
import ProfileDataPanel from '../components/resume/ProfileDataPanel';
import { maskGovernmentIdentifier } from '../features/profile/applicationQuestions';
import { formatPhoneNumber } from '../features/profile/phoneNumber';

const plainText = (value: string) => getRichTextPlainText(value);

type ProfileOverviewSectionProps = {
  children: ReactNode;
  description: string;
  onEdit: () => void;
  title: string;
};

function ProfileOverviewSection({ children, description, onEdit, title }: ProfileOverviewSectionProps) {
  return (
    <section className="surface-panel profile-overview-section" aria-label={title}>
      <div className="profile-overview-section-header">
        <div>
          <h3 className="section-title">{title}</h3>
          <p className="section-copy">{description}</p>
        </div>
        <Button onClick={onEdit} variant="secondary">
          <Pencil size={17} aria-hidden="true" />
          Edit
        </Button>
      </div>
      {children}
    </section>
  );
}

export default function MyProfile() {
  const navigate = useNavigate();
  const [profileBuilderState, setProfileBuilderState] = useState(createDefaultProfileBuilderState);
  const [profileDocument, setProfileDocument] = useState<LocalProfileDocument | null>(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    const load = async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        const document = await loadProfileDocument();
        if (!isCurrent) return;
        setProfileDocument(document);
        setProfileBuilderState(document ? toProfileBuilderState(document) : createDefaultProfileBuilderState());
      } catch {
        if (isCurrent) setLoadError('Your saved profile could not be loaded from this browser. Check that site storage is allowed, then retry.');
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };
    void load();
    return () => { isCurrent = false; };
  }, [reloadKey]);

  const applyImportedDocument = (document: LocalProfileDocument) => {
    setProfileDocument(document);
    setProfileBuilderState(toProfileBuilderState(document));
  };

  const { data } = profileBuilderState;
  const editSection = (section: typeof PROFILE_BUILDER_STEPS[number]['id']) => navigate(`/job-profile/builder?section=${section}`);
  const fullName = [data.profile.firstName, data.profile.middleName, data.profile.lastName].filter(Boolean).join(' ');
  const address = [data.profile.address1, data.profile.address2, data.profile.city, data.profile.state?.label, data.profile.postalCode, data.profile.country?.label].filter(Boolean).join(', ');

  if (isLoading) {
    return <p className="section-copy" role="status">Loading your saved profile...</p>;
  }

  if (loadError) {
    return (
      <section className="surface-panel empty-state" role="alert">
        <h2 className="section-title">Profile unavailable</h2>
        <p className="section-copy">{loadError}</p>
        <Button onClick={() => setReloadKey((value) => value + 1)} variant="secondary">Retry</Button>
      </section>
    );
  }

  if (!profileBuilderState.isComplete) {
    return (
      <div className="page-stack profile-empty-page">
        <header className="page-header">
          <div>
            <h2 className="page-title">Job Profile</h2>
            <p className="page-copy">Your saved job profile collects the details you reuse across applications and resumes.</p>
          </div>
        </header>
        <section className="surface-panel empty-state profile-overview-empty" aria-labelledby="profile-empty-title">
          <UserRound size={52} strokeWidth={1.4} aria-hidden="true" />
          <h3 id="profile-empty-title" className="section-title">Complete your profile to see it here</h3>
          <p className="section-copy">The Job Profile Builder saves your personal details, experience, education, and skills in one reusable place.</p>
          <Button onClick={() => navigate('/job-profile/builder')} variant="primary">
            <Wand2 size={18} aria-hidden="true" />
            Start Job Profile Builder
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack profile-overview-page">
      <header className="page-header">
        <div>
          <h2 className="page-title">Job Profile</h2>
          <p className="page-copy">Review or export the reusable profile stored only in this browser.</p>
        </div>
        <Button onClick={() => navigate('/job-profile/builder')} variant="secondary">
          <Wand2 size={18} aria-hidden="true" />
          Open Job Profile Builder
        </Button>
      </header>

      <TabbedForm
        activeTab={activeTab}
        ariaLabel="Job profile views"
        onTabChange={setActiveTab}
        tabs={[
          { id: 'profile', label: 'My Profile' },
          { id: 'data', label: 'Structured Data' }
        ]}
      >
        {({ panelId, tabId }) => (
          <div id={panelId} role="tabpanel" aria-labelledby={tabId}>
            {activeTab === 'data' && profileDocument ? (
              <ProfileDataPanel document={profileDocument} onImported={applyImportedDocument} />
            ) : (
              <div className="page-stack profile-overview-sections">
      <ProfileOverviewSection title="Personal Information" description="Contact details, location, and professional links." onEdit={() => editSection('profile')}>
        <dl className="profile-overview-details">
          <div><dt>Name</dt><dd>{fullName || 'Not provided'}</dd></div>
          <div><dt>Email</dt><dd>{data.profile.email || 'Not provided'}</dd></div>
          <div><dt>Phone</dt><dd>{formatPhoneNumber(data.profile.phone) || 'Not provided'}</dd></div>
          <div><dt>Address</dt><dd>{address || 'Not provided'}</dd></div>
          {data.profile.alternativeNames.length > 0 && <div><dt>Alternative names</dt><dd>{data.profile.alternativeNames.map((name) => name.name).join(', ')}</dd></div>}
          {data.profile.webLinks.length > 0 && <div><dt>Web links</dt><dd>{data.profile.webLinks.map((link) => link.name || link.url).join(', ')}</dd></div>}
        </dl>
      </ProfileOverviewSection>

      <ProfileOverviewSection title="Education" description="Degrees, training, and courses." onEdit={() => editSection('education')}>
        <div className="profile-overview-list">
          {data.education.length ? data.education.map((education) => <div key={education.id}><strong>{education.level?.label || 'Education'}</strong><span>{[education.fieldOfStudy, education.provider, education.city, education.gpa && education.gpaScale ? `GPA ${education.gpa} / ${education.gpaScale}` : ''].filter(Boolean).join(' · ') || 'Details not provided'}</span></div>) : <p className="section-copy">No education entries added.</p>}
        </div>
      </ProfileOverviewSection>

      <ProfileOverviewSection title="Work Experience" description="Employment history and responsibilities." onEdit={() => editSection('experience')}>
        <div className="profile-overview-list">
          {data.experience.length ? data.experience.map((experience) => <div key={experience.id}><strong>{experience.jobTitle || 'Role not provided'}</strong><span>{experience.company || 'Company not provided'}</span>{plainText(experience.description) && <small>{plainText(experience.description)}</small>}</div>) : <p className="section-copy">No work experience entries added.</p>}
        </div>
      </ProfileOverviewSection>

      <ProfileOverviewSection title="Projects" description="Professional, academic, and personal projects." onEdit={() => editSection('projects')}>
        <div className="profile-overview-list">
          {data.projects.length ? data.projects.map((project) => <div key={project.id}><strong>{project.name || 'Project not named'}</strong><span>{[project.role, project.organization].filter(Boolean).join(' · ') || 'Details not provided'}</span>{plainText(project.description) && <small>{plainText(project.description)}</small>}</div>) : <p className="section-copy">No projects added.</p>}
        </div>
      </ProfileOverviewSection>

      <ProfileOverviewSection title="Skills" description="Skills saved for resumes and applications." onEdit={() => editSection('skills')}>
        {data.skills.length ? <div className="profile-overview-skills">{data.skills.map((skill) => <span className="status-pill" key={skill.id}>{skill.name}{skill.level ? ` · ${skill.level}` : ''}</span>)}</div> : <p className="section-copy">No skills added.</p>}
      </ProfileOverviewSection>

      <ProfileOverviewSection title="Application Questions" description="Optional demographic and work eligibility responses." onEdit={() => editSection('application-questions')}>
        <dl className="profile-overview-details">
          <div><dt>Race or ethnicity</dt><dd>{data.applicationQuestions.raceEthnicity ?? 'Not provided'}</dd></div>
          <div><dt>Veteran status</dt><dd>{data.applicationQuestions.veteranStatus ?? 'Not provided'}</dd></div>
          <div><dt>Disability status</dt><dd>{data.applicationQuestions.disabilityStatus ?? 'Not provided'}</dd></div>
          <div><dt>Work authorization</dt><dd>{data.applicationQuestions.workAuthorizations.length
            ? data.applicationQuestions.workAuthorizations.map((entry) => `${entry.country.label}: authorized ${entry.authorizedToWork ?? 'not answered'}, sponsorship ${entry.requiresSponsorship ?? 'not answered'}`).join('; ')
            : 'Not provided'}</dd></div>
          <div><dt>Government identifiers</dt><dd>{data.applicationQuestions.governmentIdentifiers.length
            ? data.applicationQuestions.governmentIdentifiers.map((entry) => `${entry.identifierType} (${entry.country.label}) ${maskGovernmentIdentifier(entry.value)}`).join('; ')
            : 'Not provided'}</dd></div>
        </dl>
      </ProfileOverviewSection>
              </div>
            )}
          </div>
        )}
      </TabbedForm>
    </div>
  );
}

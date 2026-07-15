import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import Select from '../ui/AppSelect';
import { COUNTRY_OPTIONS, STATE_OPTIONS, selectStyles } from '../../constants/location';
import FormModal from '../ui/FormModal';
import RepeatableEntryCard from '../ui/RepeatableEntryCard';
import RepeatableSectionHeader from '../ui/RepeatableSectionHeader';

export type AlternativeName = {
  id: number;
  name: string;
  context: SelectOption | null;
};

type SelectOption = {
  value: string;
  label: string;
};

export type WebLink = {
  id: number;
  name: string;
  url: string;
};

export type ProfileSectionData = {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  phone: string;
  alternativeNames: AlternativeName[];
  address1: string;
  address2: string;
  city: string;
  state: SelectOption | null;
  postalCode: string;
  country: SelectOption | null;
  webLinks: WebLink[];
};

const ALTERNATIVE_NAME_CONTEXT_OPTIONS: SelectOption[] = [
  { value: 'Former legal name', label: 'Former legal name' },
  { value: 'Maiden name', label: 'Maiden name' },
  { value: 'Preferred name', label: 'Preferred name' },
  { value: 'Professional name', label: 'Professional name' },
  { value: 'Nickname', label: 'Nickname' },
  { value: 'Other', label: 'Other' }
];

type ProfileSectionProps = {
  data: ProfileSectionData;
  onChange: Dispatch<SetStateAction<ProfileSectionData>>;
};

export default function ProfileSection({ data, onChange }: ProfileSectionProps) {
  const [alternativeNameDraft, setAlternativeNameDraft] = useState<AlternativeName | null>(null);
  const [webLinkDraft, setWebLinkDraft] = useState<WebLink | null>(null);

  const setAlternativeNames = (updater: SetStateAction<AlternativeName[]>) => {
    onChange((current) => ({
      ...current,
      alternativeNames: typeof updater === 'function'
        ? updater(current.alternativeNames)
        : updater
    }));
  };

  const setWebLinks = (updater: SetStateAction<WebLink[]>) => {
    onChange((current) => ({
      ...current,
      webLinks: typeof updater === 'function'
        ? updater(current.webLinks)
        : updater
    }));
  };

  const updateField = <Key extends keyof ProfileSectionData>(
    key: Key,
    value: ProfileSectionData[Key]
  ) => {
    onChange((current) => ({ ...current, [key]: value }));
  };

  const addAlternativeName = () => {
    setAlternativeNameDraft({ id: Date.now(), name: '', context: null });
  };

  const removeAlternativeName = (id: number) => {
    setAlternativeNames((current) => current.filter((name) => name.id !== id));
  };

  const editAlternativeName = (alternativeName: AlternativeName) => {
    setAlternativeNameDraft({ ...alternativeName });
  };

  const saveAlternativeName = () => {
    if (!alternativeNameDraft?.name.trim()) return;

    const savedName = { ...alternativeNameDraft, name: alternativeNameDraft.name.trim() };
    setAlternativeNames((current) => {
      const withoutBlankEntries = current.filter((name) => name.name.trim());
      return current.some((name) => name.id === savedName.id)
        ? withoutBlankEntries.map((name) => name.id === savedName.id ? savedName : name)
        : [...withoutBlankEntries, savedName];
    });
    setAlternativeNameDraft(null);
  };

  const addWebLink = () => {
    setWebLinkDraft({ id: Date.now(), name: '', url: '' });
  };

  const removeWebLink = (id: number) => {
    setWebLinks((current) => current.filter(link => link.id !== id));
  };

  const editWebLink = (webLink: WebLink) => {
    setWebLinkDraft({ ...webLink });
  };

  const saveWebLink = () => {
    if (!webLinkDraft?.name.trim() || !webLinkDraft.url.trim()) return;

    const savedLink = {
      ...webLinkDraft,
      name: webLinkDraft.name.trim(),
      url: webLinkDraft.url.trim()
    };
    setWebLinks((current) => {
      const withoutBlankEntries = current.filter((link) => link.name.trim() || link.url.trim());
      return current.some((link) => link.id === savedLink.id)
        ? withoutBlankEntries.map((link) => link.id === savedLink.id ? savedLink : link)
        : [...withoutBlankEntries, savedLink];
    });
    setWebLinkDraft(null);
  };

  const savedAlternativeNames = data.alternativeNames.filter((name) => name.name.trim());
  const savedWebLinks = data.webLinks.filter((link) => link.name.trim() || link.url.trim());

  return (
    <div className="page-stack">
      <div>
        <h3 className="section-title">Personal Information</h3>
        <p className="section-copy">
        Enter your core details. These will appear at the top of your resume.
        </p>
      </div>

      <FormModal
        className="repeatable-entry-modal"
        closeLabel="Close alternative name form"
        description="Save another name and its context for reuse in job applications."
        initialFocusId="alternative-name-value"
        isOpen={Boolean(alternativeNameDraft)}
        onClose={() => setAlternativeNameDraft(null)}
        title={data.alternativeNames.some((name) => name.id === alternativeNameDraft?.id)
          ? 'Edit alternative name'
          : 'Add alternative name'}
      >
        {alternativeNameDraft ? (
          <form
            className="page-stack repeatable-entry-modal-form"
            onSubmit={(event) => {
              event.preventDefault();
              saveAlternativeName();
            }}
          >
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="alternative-name-value">Alternative Name *</label>
              <input
                autoComplete="off"
                className="form-input"
                id="alternative-name-value"
                onChange={(event) => setAlternativeNameDraft((current) => current
                  ? { ...current, name: event.target.value }
                  : current)}
                placeholder="e.g. Jane M. Smith"
                required
                type="text"
                value={alternativeNameDraft.name}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="alternative-name-context">Context (Optional)</label>
              <Select
                inputId="alternative-name-context"
                isClearable
                onChange={(option) => setAlternativeNameDraft((current) => current
                  ? { ...current, context: option as SelectOption | null }
                  : current)}
                options={ALTERNATIVE_NAME_CONTEXT_OPTIONS}
                placeholder="Select context"
                styles={selectStyles}
                value={alternativeNameDraft.context}
              />
            </div>
            <div className="modal-form-actions">
              <button className="btn btn-secondary" onClick={() => setAlternativeNameDraft(null)} type="button">
                Cancel
              </button>
              <button className="btn btn-primary" type="submit">Save Name</button>
            </div>
          </form>
        ) : null}
      </FormModal>

      <FormModal
        className="repeatable-entry-modal"
        closeLabel="Close web link form"
        description="Save a professional link for reuse in applications and generated resumes."
        initialFocusId="web-link-name"
        isOpen={Boolean(webLinkDraft)}
        onClose={() => setWebLinkDraft(null)}
        title={data.webLinks.some((link) => link.id === webLinkDraft?.id)
          ? 'Edit web link'
          : 'Add web link'}
      >
        {webLinkDraft ? (
          <form
            className="page-stack repeatable-entry-modal-form"
            onSubmit={(event) => {
              event.preventDefault();
              saveWebLink();
            }}
          >
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="web-link-name">Link Type or Name *</label>
              <input
                className="form-input"
                id="web-link-name"
                onChange={(event) => setWebLinkDraft((current) => current
                  ? { ...current, name: event.target.value }
                  : current)}
                placeholder="e.g. LinkedIn or Portfolio"
                required
                type="text"
                value={webLinkDraft.name}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="web-link-url">URL *</label>
              <input
                className="form-input"
                id="web-link-url"
                onChange={(event) => setWebLinkDraft((current) => current
                  ? { ...current, url: event.target.value }
                  : current)}
                placeholder="https://..."
                required
                type="url"
                value={webLinkDraft.url}
              />
            </div>
            <div className="modal-form-actions">
              <button className="btn btn-secondary" onClick={() => setWebLinkDraft(null)} type="button">
                Cancel
              </button>
              <button className="btn btn-primary" type="submit">Save Link</button>
            </div>
          </form>
        ) : null}
      </FormModal>
      
      <div className="form-grid">
        <div className="profile-name-grid">
        <div className="form-group">
          <label className="form-label" htmlFor="profile-first-name">First Name</label>
          <input
            id="profile-first-name"
            type="text"
            className="form-input"
            placeholder="e.g. Jane"
            autoComplete="given-name"
            value={data.firstName}
            onChange={(event) => updateField('firstName', event.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="profile-middle-name">Middle Name (Optional)</label>
          <input
            id="profile-middle-name"
            type="text"
            className="form-input"
            placeholder="e.g. Marie"
            autoComplete="additional-name"
            value={data.middleName}
            onChange={(event) => updateField('middleName', event.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="profile-last-name">Last Name</label>
          <input
            id="profile-last-name"
            type="text"
            className="form-input"
            placeholder="e.g. Doe"
            autoComplete="family-name"
            value={data.lastName}
            onChange={(event) => updateField('lastName', event.target.value)}
          />
        </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="profile-email">Email</label>
          <input
            id="profile-email"
            type="email"
            className="form-input"
            placeholder="jane.doe@example.com"
            autoComplete="email"
            value={data.email}
            onChange={(event) => updateField('email', event.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="profile-phone">Phone</label>
          <input
            id="profile-phone"
            type="tel"
            className="form-input"
            placeholder="(555) 123-4567"
            autoComplete="tel"
            value={data.phone}
            onChange={(event) => updateField('phone', event.target.value)}
          />
        </div>

        <RepeatableSectionHeader
          actionLabel="Add Name"
          className="form-grid-full"
          headingLevel={4}
          onAdd={addAlternativeName}
          title="Alternative Names"
        />
        <hr className="form-grid-full subtle-divider" />

        {savedAlternativeNames.length === 0 ? (
          <div className="form-grid-full field-card profile-empty-state" aria-label="No alternative names added">
            <p className="section-copy">No alternative names added</p>
          </div>
        ) : null}

        {savedAlternativeNames.map((name) => (
          <div className="form-grid-full" key={name.id}>
            <RepeatableEntryCard
              editLabel={`Edit ${name.name}`}
              onEdit={() => editAlternativeName(name)}
              onRemove={() => removeAlternativeName(name.id)}
              removeLabel={`Remove ${name.name}`}
              subtitle={name.context?.label || 'Context not specified'}
              title={name.name}
            />
          </div>
        ))}

        <div className="form-grid-full">
          <h4 className="section-title">Location</h4>
          <hr className="subtle-divider" />
        </div>
        
        <div className="form-group">
          <label className="form-label" htmlFor="profile-address-1">Address Line 1</label>
          <input
            id="profile-address-1"
            type="text"
            className="form-input"
            placeholder="123 Main St"
            autoComplete="address-line1"
            value={data.address1}
            onChange={(event) => updateField('address1', event.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="profile-address-2">Address Line 2 (Optional)</label>
          <input
            id="profile-address-2"
            type="text"
            className="form-input"
            placeholder="Suite 100"
            autoComplete="address-line2"
            value={data.address2}
            onChange={(event) => updateField('address2', event.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="profile-city">City</label>
          <input
            id="profile-city"
            type="text"
            className="form-input"
            placeholder="San Francisco"
            autoComplete="address-level2"
            value={data.city}
            onChange={(event) => updateField('city', event.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="profile-state">State/Province</label>
          <Select 
            inputId="profile-state"
            options={STATE_OPTIONS} 
            styles={selectStyles} 
            placeholder="Select State"
            value={data.state}
            onChange={(option) => updateField('state', option as SelectOption | null)}
            isClearable 
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="profile-postal-code">ZIP/Postal Code</label>
          <input
            id="profile-postal-code"
            type="text"
            className="form-input"
            placeholder="94105"
            autoComplete="postal-code"
            value={data.postalCode}
            onChange={(event) => updateField('postalCode', event.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="profile-country">Country</label>
          <Select 
            inputId="profile-country"
            options={COUNTRY_OPTIONS} 
            styles={selectStyles} 
            value={data.country}
            onChange={(option) => updateField('country', option as SelectOption | null)}
            isClearable 
          />
        </div>
        
        <RepeatableSectionHeader
          actionLabel="Add Link"
          className="form-grid-full"
          headingLevel={4}
          onAdd={addWebLink}
          title="Web Links"
        />
        <hr className="form-grid-full subtle-divider" />
        
        {savedWebLinks.length === 0 ? (
          <div className="form-grid-full field-card profile-empty-state" aria-label="No web links added">
            <p className="section-copy">No web links added</p>
          </div>
        ) : null}

        {savedWebLinks.map((link) => (
          <div className="form-grid-full" key={link.id}>
            <RepeatableEntryCard
              editLabel={`Edit ${link.name || link.url}`}
              onEdit={() => editWebLink(link)}
              onRemove={() => removeWebLink(link.id)}
              removeLabel={`Remove ${link.name || link.url}`}
              subtitle={(
                <a href={link.url} rel="noreferrer" target="_blank">{link.url}</a>
              )}
              title={link.name || 'Web link'}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

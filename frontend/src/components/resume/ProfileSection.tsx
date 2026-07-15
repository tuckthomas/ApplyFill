import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import Select from '../ui/AppSelect';
import { selectStyles } from '../../constants/location';
import FormModal from '../ui/FormModal';
import RepeatableEntryCard from '../ui/RepeatableEntryCard';
import RepeatableSectionHeader from '../ui/RepeatableSectionHeader';
import AddressFlow from '../ui/AddressFlow';
import type { AddressValue } from '../ui/AddressFlow';

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
  const [addressDraft, setAddressDraft] = useState<AddressValue | null>(null);
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

  const openAddress = () => {
    setAddressDraft({
      address1: data.address1,
      address2: data.address2,
      city: data.city,
      state: data.state,
      postalCode: data.postalCode,
      country: data.country
    });
  };

  const saveAddress = () => {
    if (!addressDraft?.country) return;

    onChange((current) => ({
      ...current,
      address1: addressDraft.address1 ?? '',
      address2: addressDraft.address2 ?? '',
      city: addressDraft.city,
      state: addressDraft.state,
      postalCode: addressDraft.postalCode ?? '',
      country: addressDraft.country
    }));
    setAddressDraft(null);
  };

  const removeAddress = () => {
    onChange((current) => ({
      ...current,
      address1: '',
      address2: '',
      city: '',
      state: null,
      postalCode: '',
      country: null
    }));
  };

  const savedAlternativeNames = data.alternativeNames.filter((name) => name.name.trim());
  const savedWebLinks = data.webLinks.filter((link) => link.name.trim() || link.url.trim());
  const hasAddress = Boolean(data.country);
  const addressLocation = [data.city, data.state?.value, data.postalCode, data.country?.label]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="page-stack">
      <div>
        <h3 className="section-title">Personal Information</h3>
        <p className="section-copy">
        Enter your core details. These will appear at the top of your resume.
        </p>
      </div>

      <FormModal
        className="address-modal-dialog"
        closeLabel="Close address form"
        description="Save this address once for reuse in job applications."
        dirtyKey={addressDraft ? JSON.stringify(addressDraft) : undefined}
        initialFocusId={addressDraft?.country ? 'profile-address-address-1' : 'profile-address-country'}
        isOpen={Boolean(addressDraft)}
        onClose={() => setAddressDraft(null)}
        title={hasAddress ? 'Edit address' : 'Add address'}
      >
        {addressDraft ? (
          <form
            autoComplete="on"
            className="address-modal-form"
            onSubmit={(event) => {
              event.preventDefault();
              saveAddress();
            }}
          >
            <AddressFlow
              idPrefix="profile-address"
              onChange={(field, value) => setAddressDraft((current) => current
                ? { ...current, [field]: value }
                : current)}
              showSaveAction
              value={addressDraft}
            />
          </form>
        ) : null}
      </FormModal>

      <FormModal
        className="repeatable-entry-modal"
        closeLabel="Close alternative name form"
        description="Save another name and its context for reuse in job applications."
        dirtyKey={alternativeNameDraft ? JSON.stringify(alternativeNameDraft) : undefined}
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
              <button className="btn btn-secondary" data-modal-close onClick={() => setAlternativeNameDraft(null)} type="button">
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
        dirtyKey={webLinkDraft ? JSON.stringify(webLinkDraft) : undefined}
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
              <button className="btn btn-secondary" data-modal-close onClick={() => setWebLinkDraft(null)} type="button">
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

        <RepeatableSectionHeader
          actionLabel={hasAddress ? undefined : 'Add Address'}
          className="form-grid-full"
          headingLevel={4}
          onAdd={hasAddress ? undefined : openAddress}
          title="Location"
        />
        <hr className="form-grid-full subtle-divider" />

        {!hasAddress ? (
          <div className="form-grid-full field-card profile-empty-state" aria-label="No address added">
            <p className="section-copy">No address added</p>
          </div>
        ) : (
          <div className="form-grid-full">
            <RepeatableEntryCard
              editLabel="Edit address"
              onEdit={openAddress}
              onRemove={removeAddress}
              removeLabel="Remove address"
              subtitle={addressLocation}
              title={data.address1 || 'Saved address'}
            />
          </div>
        )}
        
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

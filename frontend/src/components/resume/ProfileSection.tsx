import type { Dispatch, SetStateAction } from 'react';
import Select from 'react-select';
import { Trash2, Plus } from 'lucide-react';
import { COUNTRY_OPTIONS, STATE_OPTIONS, selectStyles } from '../../constants/location';

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
    const alternativeName = { id: Date.now(), name: '', context: null };
    setAlternativeNames((current) => [...current, alternativeName]);
  };

  const removeAlternativeName = (id: number) => {
    setAlternativeNames((current) => current.filter((name) => name.id !== id));
  };

  const updateAlternativeName = (
    id: number,
    field: 'name' | 'context',
    value: string | SelectOption | null
  ) => {
    setAlternativeNames((current) => current.map((name) => (
      name.id === id ? { ...name, [field]: value } : name
    )));
  };

  const addWebLink = () => {
    setWebLinks((current) => [...current, { id: Date.now(), name: '', url: '' }]);
  };

  const removeWebLink = (id: number) => {
    setWebLinks((current) => current.filter(link => link.id !== id));
  };

  const updateWebLink = (id: number, field: 'name' | 'url', value: string) => {
    setWebLinks((current) => current.map(link =>
      link.id === id ? { ...link, [field]: value } : link
    ));
  };

  return (
    <div className="page-stack">
      <div>
        <h3 className="section-title">Personal Information</h3>
        <p className="section-copy">
        Enter your core details. These will appear at the top of your resume.
        </p>
      </div>
      
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

        <div className="form-grid-full toolbar-row">
          <h4 className="section-title">Alternative Names</h4>
          <button
            onClick={addAlternativeName}
            className="btn btn-secondary btn-add-action"
            type="button"
          >
            <Plus size={18} /> Add Name
          </button>
        </div>
        <hr className="form-grid-full subtle-divider" />

        {data.alternativeNames.length === 0 ? (
          <div className="form-grid-full field-card profile-empty-state" aria-label="No alternative names added">
            <p className="section-copy">No alternative names added</p>
          </div>
        ) : null}

        {data.alternativeNames.map((name, index) => (
          <div key={name.id} className="form-grid-full profile-repeat-row">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor={`alternative-name-${name.id}`}>Alternative Name</label>
              <input
                id={`alternative-name-${name.id}`}
                type="text"
                className="form-input"
                placeholder="e.g. Jane M. Smith"
                value={name.name}
                onChange={(event) => updateAlternativeName(name.id, 'name', event.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor={`alternative-name-context-${name.id}`}>Context (Optional)</label>
              <Select
                inputId={`alternative-name-context-${name.id}`}
                options={ALTERNATIVE_NAME_CONTEXT_OPTIONS}
                styles={selectStyles}
                placeholder="Select context"
                value={name.context}
                onChange={(option) => updateAlternativeName(name.id, 'context', option as SelectOption | null)}
                isClearable
              />
            </div>
            <button
              onClick={() => removeAlternativeName(name.id)}
              className="icon-button icon-button-danger"
              type="button"
              aria-label={`Remove alternative name ${index + 1}`}
            >
              <Trash2 size={18} />
            </button>
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
        
        <div className="form-grid-full toolbar-row">
          <h4 className="section-title">Web Links</h4>
          <button 
            onClick={addWebLink}
            className="btn btn-secondary btn-add-action"
            type="button"
          >
            <Plus size={18} /> Add Link
          </button>
        </div>
        <hr className="form-grid-full subtle-divider" />
        
        {data.webLinks.map((link, index) => (
          <div key={link.id} className="form-grid-full profile-repeat-row profile-web-link-row">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor={`web-link-name-${link.id}`}>{index === 0 ? 'Link Type/Name' : 'Link Type/Name'}</label>
              <input 
                id={`web-link-name-${link.id}`}
                type="text" 
                className="form-input" 
                placeholder="e.g. LinkedIn, Portfolio" 
                value={link.name}
                onChange={(e) => updateWebLink(link.id, 'name', e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor={`web-link-url-${link.id}`}>URL</label>
              <input 
                id={`web-link-url-${link.id}`}
                type="url" 
                className="form-input" 
                placeholder="https://..." 
                value={link.url}
                onChange={(e) => updateWebLink(link.id, 'url', e.target.value)}
              />
            </div>
            <button 
              onClick={() => removeWebLink(link.id)}
              className="icon-button icon-button-danger"
              type="button"
              aria-label={`Remove web link ${index + 1}`}
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

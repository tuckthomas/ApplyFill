import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Checkbox from './Checkbox';
import AutofillSelect from './AutofillSelect';
import {
  AUSTRALIAN_STATE_OPTIONS,
  CANADIAN_PROVINCE_OPTIONS,
  COUNTRY_OPTIONS,
  STATE_OPTIONS
} from '../../constants/location';
import type { LocationOption } from '../../constants/location';

export type AddressValue = {
  address1?: string;
  address2?: string;
  city: string;
  state: LocationOption | null;
  postalCode?: string;
  country: LocationOption | null;
};

type AddressField = keyof AddressValue;
type AddressStep = 'country' | 'details';

type RemoteControl = {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
};

type AddressFlowProps = {
  idPrefix: string;
  mode?: 'full' | 'locality';
  onChange: (field: AddressField, value: AddressValue[AddressField]) => void;
  remoteControl?: RemoteControl;
  saveLabel?: string;
  showSaveAction?: boolean;
  value: AddressValue;
};

type AddressFormat = {
  administrativeAreaLabel: string;
  administrativeAreaOptions?: LocationOption[];
  cityLabel: string;
  hideAdministrativeArea?: boolean;
  postalCodeLabel: string;
  postalCodePlaceholder: string;
};

const NO_ADMINISTRATIVE_AREA_COUNTRIES = new Set([
  'Denmark', 'France', 'Germany', 'Iceland', 'Luxembourg', 'Monaco',
  'Singapore', 'United Kingdom', 'Vatican City'
]);

const getAddressFormat = (country: string | undefined): AddressFormat => {
  if (country === 'United States') {
    return {
      administrativeAreaLabel: 'State',
      administrativeAreaOptions: STATE_OPTIONS,
      cityLabel: 'City',
      postalCodeLabel: 'ZIP Code',
      postalCodePlaceholder: 'e.g. 46204'
    };
  }

  if (country === 'Canada') {
    return {
      administrativeAreaLabel: 'Province or Territory',
      administrativeAreaOptions: CANADIAN_PROVINCE_OPTIONS,
      cityLabel: 'City',
      postalCodeLabel: 'Postal Code',
      postalCodePlaceholder: 'e.g. M5V 3A8'
    };
  }

  if (country === 'Australia') {
    return {
      administrativeAreaLabel: 'State or Territory',
      administrativeAreaOptions: AUSTRALIAN_STATE_OPTIONS,
      cityLabel: 'Suburb or City',
      postalCodeLabel: 'Postcode',
      postalCodePlaceholder: 'e.g. 2000'
    };
  }

  if (country === 'United Kingdom') {
    return {
      administrativeAreaLabel: 'County',
      cityLabel: 'Town or City',
      hideAdministrativeArea: true,
      postalCodeLabel: 'Postcode',
      postalCodePlaceholder: 'e.g. SW1A 1AA'
    };
  }

  return {
    administrativeAreaLabel: 'State, Province, or Region',
    cityLabel: 'City or Locality',
    hideAdministrativeArea: country ? NO_ADMINISTRATIVE_AREA_COUNTRIES.has(country) : false,
    postalCodeLabel: 'Postal Code',
    postalCodePlaceholder: 'Enter postal code'
  };
};

export default function AddressFlow({
  idPrefix,
  mode = 'full',
  onChange,
  remoteControl,
  saveLabel = 'Save Address',
  showSaveAction = false,
  value
}: AddressFlowProps) {
  const [step, setStep] = useState<AddressStep>(value.country ? 'details' : 'country');
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const countryPanelRef = useRef<HTMLDivElement>(null);
  const detailsPanelRef = useRef<HTMLDivElement>(null);
  const format = getAddressFormat(value.country?.value);
  const isRemote = remoteControl?.checked ?? false;

  useLayoutEffect(() => {
    const activePanel = step === 'country' ? countryPanelRef.current : detailsPanelRef.current;
    if (!activePanel) return undefined;

    const measure = () => setViewportHeight(Math.ceil(activePanel.scrollHeight));
    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(activePanel);
    return () => resizeObserver.disconnect();
  }, [mode, step]);

  const focusDetails = () => {
    setStep('details');
    window.requestAnimationFrame(() => {
      document.getElementById(`${idPrefix}-${mode === 'full' ? 'address-1' : 'city'}`)?.focus();
    });
  };

  const focusCountry = () => {
    setStep('country');
    window.requestAnimationFrame(() => document.getElementById(`${idPrefix}-country`)?.focus());
  };

  const changeCountry = (country: LocationOption | null) => {
    const nextFormat = getAddressFormat(country?.value);
    const stateIsCompatible = !value.state
      || (!nextFormat.hideAdministrativeArea
        && (!nextFormat.administrativeAreaOptions
          || nextFormat.administrativeAreaOptions.some((option) => option.value === value.state?.value)));

    onChange('country', country);
    if (country && country.value !== value.country?.value && !stateIsCompatible) {
      onChange('state', null);
    }
  };

  const changeAdministrativeArea = (administrativeArea: LocationOption | null) => {
    onChange('state', administrativeArea);
  };

  return (
    <div
      className={`address-flow address-flow-${mode}`}
      data-step={step}
      style={viewportHeight === null ? undefined : { height: `${viewportHeight}px` }}
    >
      <div className="address-flow-track">
        <section
          aria-hidden={step !== 'country'}
          className="address-flow-panel address-flow-country-panel"
          inert={step !== 'country'}
        >
          <div className="address-flow-country-content" ref={countryPanelRef}>
            <div>
              <h4 className="section-title">Address Country</h4>
              <p className="section-copy">Select the country first so the correct address fields can be shown.</p>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor={`${idPrefix}-country`}>Country</label>
              <AutofillSelect
                autoComplete="country-name"
                inputId={`${idPrefix}-country`}
                name={`${idPrefix}-country`}
                onChange={changeCountry}
                options={COUNTRY_OPTIONS}
                placeholder="Select country"
                value={value.country}
              />
            </div>
            <div className="modal-form-actions">
              <button
                className="btn btn-primary"
                disabled={!value.country}
                onClick={focusDetails}
                type="button"
              >
                Next
                <ArrowRight aria-hidden="true" size={18} />
              </button>
            </div>
          </div>
        </section>

        <section
          aria-hidden={step !== 'details'}
          className="address-flow-panel address-flow-details-panel"
          inert={step !== 'details'}
        >
          {step === 'details' && value.country ? (
            <div className="address-flow-details-content" ref={detailsPanelRef}>
              <div className="address-flow-details-heading">
                <h4 className="section-title">{value.country.label} Address</h4>
                <p className="section-copy">Enter the address using the fields recognized for this country.</p>
              </div>
              <div className="form-grid address-fields">
                {remoteControl ? (
                  <div className="form-group address-fields-remote">
                    <span className="form-label" aria-hidden="true">Remote Learning</span>
                    <Checkbox
                      checked={remoteControl.checked}
                      label={remoteControl.label}
                      onChange={(event) => remoteControl.onChange(event.target.checked)}
                    />
                  </div>
                ) : null}

                {mode === 'full' ? (
                  <>
                    <div className="form-group address-fields-line-1">
                      <label className="form-label" htmlFor={`${idPrefix}-address-1`}>Address Line 1</label>
                      <input
                        autoComplete="address-line1"
                        className="form-input"
                        id={`${idPrefix}-address-1`}
                        name={`${idPrefix}-address-line1`}
                        onChange={(event) => onChange('address1', event.target.value)}
                        placeholder="e.g. 123 Main St"
                        type="text"
                        value={value.address1 ?? ''}
                      />
                    </div>
                    <div className="form-group address-fields-line-2">
                      <label className="form-label" htmlFor={`${idPrefix}-address-2`}>Address Line 2 (Optional)</label>
                      <input
                        autoComplete="address-line2"
                        className="form-input"
                        id={`${idPrefix}-address-2`}
                        name={`${idPrefix}-address-line2`}
                        onChange={(event) => onChange('address2', event.target.value)}
                        placeholder="e.g. Suite 100"
                        type="text"
                        value={value.address2 ?? ''}
                      />
                    </div>
                  </>
                ) : null}

                <div className="form-group address-fields-city">
                  <label className="form-label" htmlFor={`${idPrefix}-city`}>{format.cityLabel}</label>
                  <input
                    autoComplete="address-level2"
                    className="form-input"
                    disabled={isRemote}
                    id={`${idPrefix}-city`}
                    name={`${idPrefix}-city`}
                    onChange={(event) => onChange('city', event.target.value)}
                    placeholder={isRemote ? 'Not required for remote learning' : `Enter ${format.cityLabel.toLowerCase()}`}
                    type="text"
                    value={value.city}
                  />
                </div>

                {!format.hideAdministrativeArea ? (
                  <div className="form-group address-fields-administrative-area">
                    <label className="form-label" htmlFor={`${idPrefix}-state`}>{format.administrativeAreaLabel}</label>
                    {format.administrativeAreaOptions ? (
                      <AutofillSelect
                        autoComplete="address-level1"
                        disabled={isRemote}
                        inputId={`${idPrefix}-state`}
                        name={`${idPrefix}-state`}
                        onChange={changeAdministrativeArea}
                        options={format.administrativeAreaOptions}
                        placeholder={`Select ${format.administrativeAreaLabel.toLowerCase()}`}
                        value={value.state}
                      />
                    ) : (
                      <input
                        autoComplete="address-level1"
                        className="form-input"
                        disabled={isRemote}
                        id={`${idPrefix}-state`}
                        name={`${idPrefix}-state`}
                        onChange={(event) => onChange('state', event.target.value
                          ? { label: event.target.value, value: event.target.value }
                          : null)}
                        placeholder={`Enter ${format.administrativeAreaLabel.toLowerCase()}`}
                        type="text"
                        value={value.state?.value ?? ''}
                      />
                    )}
                  </div>
                ) : null}

                {mode === 'full' ? (
                  <div className="form-group address-fields-postal-code">
                    <label className="form-label" htmlFor={`${idPrefix}-postal-code`}>{format.postalCodeLabel}</label>
                    <input
                      autoComplete="postal-code"
                      className="form-input"
                      id={`${idPrefix}-postal-code`}
                      name={`${idPrefix}-postal-code`}
                      onChange={(event) => onChange('postalCode', event.target.value)}
                      placeholder={format.postalCodePlaceholder}
                      type="text"
                      value={value.postalCode ?? ''}
                    />
                  </div>
                ) : null}
              </div>

              <div className="modal-form-actions address-flow-actions">
                <button className="btn btn-secondary" onClick={focusCountry} type="button">
                  <ArrowLeft aria-hidden="true" size={18} />
                  Back
                </button>
                {showSaveAction ? <button className="btn btn-primary" type="submit">{saveLabel}</button> : null}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

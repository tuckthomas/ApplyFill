import { useEffect, useMemo, useState } from 'react';
import CreatableSelect from 'react-select/creatable';
import type { StylesConfig } from 'react-select';
import { selectStyles } from '../../constants/location';
import { loadCompanies } from '../../features/companies/companies';
import type { Company } from '../../features/companies/companies';

type CompanyOption = {
  label: string;
  value: Company;
};

type CompanySelectProps = {
  inputId: string;
  onChange: (company: Company | null) => void;
  value: string;
};

const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

const companySelectStyles: StylesConfig<CompanyOption, false> = {
  ...selectStyles,
  control: (base, state) => ({
    ...selectStyles.control(base, state),
    cursor: 'text',
  }),
  valueContainer: (base) => ({
    ...selectStyles.valueContainer(base),
    cursor: 'text',
  }),
  input: (base) => ({
    ...selectStyles.input(base),
    cursor: 'text',
  }),
  singleValue: (base) => ({
    ...selectStyles.singleValue(base),
    cursor: 'text',
  }),
  dropdownIndicator: (base) => ({
    ...selectStyles.dropdownIndicator(base),
    cursor: 'pointer',
  }),
  clearIndicator: (base) => ({
    ...selectStyles.clearIndicator(base),
    cursor: 'pointer',
  }),
  option: (base, props) => ({
    ...selectStyles.option(base, props),
    cursor: 'pointer',
  }),
};

export default function CompanySelect({ inputId, onChange, value }: CompanySelectProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let current = true;
    loadCompanies()
      .then((loaded) => { if (current) setCompanies(loaded); })
      .catch(() => { if (current) setCompanies([]); })
      .finally(() => { if (current) setIsLoading(false); });
    return () => { current = false; };
  }, []);

  const options = useMemo<CompanyOption[]>(
    () => companies.map((company) => ({ label: company.name, value: company })),
    [companies],
  );
  const selected = value.trim()
    ? options.find((option) => normalize(option.value.name) === normalize(value))
      ?? { label: value, value: { id: '', name: value } }
    : null;

  return (
    <CreatableSelect<CompanyOption>
      inputId={inputId}
      isClearable
      isLoading={isLoading}
      onChange={(option) => onChange(option?.value ?? null)}
      onCreateOption={(name) => onChange({ id: '', name: name.trim() })}
      options={options}
      placeholder="Search or enter a company"
      styles={companySelectStyles}
      value={selected}
    />
  );
}

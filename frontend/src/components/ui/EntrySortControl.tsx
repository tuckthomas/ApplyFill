import Select from './AppSelect';

import { selectStyles } from '../../constants/location';
import { DEFAULT_ENTRY_SORT_ORDER } from './entrySorting';
import type { EntrySortOrder } from './entrySorting';

type SortOption = {
  value: EntrySortOrder;
  label: string;
};

type EntrySortControlProps = {
  alphaLabel: string;
  inputId: string;
  onChange: (order: EntrySortOrder) => void;
  value: EntrySortOrder;
};

export default function EntrySortControl({ alphaLabel, inputId, onChange, value }: EntrySortControlProps) {
  const options: SortOption[] = [
    { value: 'recent', label: 'Most recent first' },
    { value: 'oldest', label: 'Oldest first' },
    { value: 'alpha-asc', label: `${alphaLabel} A-Z` },
    { value: 'alpha-desc', label: `${alphaLabel} Z-A` }
  ];

  return (
    <div className="entry-sort-control">
      <label className="form-label" htmlFor={inputId}>Sort saved entries</label>
      <Select
        inputId={inputId}
        isSearchable={false}
        onChange={(option) => onChange(option?.value ?? DEFAULT_ENTRY_SORT_ORDER)}
        options={options}
        styles={selectStyles}
        value={options.find((option) => option.value === value)}
      />
    </div>
  );
}

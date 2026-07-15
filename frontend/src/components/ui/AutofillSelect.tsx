import { components } from 'react-select';
import type { InputActionMeta, InputProps } from 'react-select';
import AppSelect from './AppSelect';
import { selectStyles } from '../../constants/location';
import type { LocationOption } from '../../constants/location';

type AutofillSelectProps = {
  autoComplete: string;
  disabled?: boolean;
  inputId: string;
  name: string;
  onChange: (option: LocationOption | null) => void;
  options: LocationOption[];
  placeholder: string;
  value: LocationOption | null;
};

export default function AutofillSelect({
  autoComplete,
  disabled = false,
  inputId,
  name,
  onChange,
  options,
  placeholder,
  value
}: AutofillSelectProps) {
  const AutofillInput = (props: InputProps<LocationOption, false>) => (
    <components.Input
      {...props}
      autoComplete={autoComplete}
      name={`${name}-search`}
    />
  );

  const handleInputChange = (inputValue: string, actionMeta: InputActionMeta) => {
    if (actionMeta.action === 'input-change') {
      const normalizedInput = inputValue.trim().toLocaleLowerCase();
      const exactMatch = options.find((option) => (
        option.label.toLocaleLowerCase() === normalizedInput
        || option.value.toLocaleLowerCase() === normalizedInput
      ));
      if (exactMatch) onChange(exactMatch);
    }
    return inputValue;
  };

  return (
    <AppSelect<LocationOption>
      components={{ Input: AutofillInput }}
      inputId={inputId}
      isClearable
      isDisabled={disabled}
      name={name}
      onChange={(option) => onChange(option)}
      onInputChange={handleInputChange}
      options={options}
      placeholder={placeholder}
      styles={selectStyles}
      value={value}
    />
  );
}

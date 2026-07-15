import type { InputHTMLAttributes, ReactNode } from 'react';
import { Check } from 'lucide-react';

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: ReactNode;
};

export default function Checkbox({ className = '', label, ...props }: CheckboxProps) {
  const classes = ['checkbox-row', className].filter(Boolean).join(' ');

  return (
    <label className={classes}>
      <input {...props} className="checkbox-input" type="checkbox" />
      <span className="checkbox-control" aria-hidden="true">
        <Check className="checkbox-check" strokeWidth={3.25} />
      </span>
      <span className="checkbox-label">{label}</span>
    </label>
  );
}

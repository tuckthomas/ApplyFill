import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Plus } from 'lucide-react';

type AddButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  children: ReactNode;
};

export default function AddButton({ children, className = '', type = 'button', ...props }: AddButtonProps) {
  const classes = ['btn', 'btn-primary', 'btn-add-action', className].filter(Boolean).join(' ');

  return (
    <button {...props} className={classes} type={type}>
      <Plus size={18} aria-hidden="true" />
      {children}
    </button>
  );
}

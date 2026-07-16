import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Plus } from 'lucide-react';
import Button from './Button';

type AddButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  children: ReactNode;
};

export default function AddButton({ children, className = '', type = 'button', ...props }: AddButtonProps) {
  const classes = ['btn-add-action', className].filter(Boolean).join(' ');

  return (
    <Button {...props} className={classes} type={type} variant="primary">
      <Plus size={18} aria-hidden="true" />
      {children}
    </Button>
  );
}

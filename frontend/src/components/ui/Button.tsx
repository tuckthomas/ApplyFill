import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
};

export default function Button({
  children,
  className = '',
  type = 'button',
  variant = 'secondary',
  ...props
}: ButtonProps) {
  const classes = ['btn', `btn-${variant}`, className].filter(Boolean).join(' ');

  return (
    <button {...props} className={classes} type={type}>
      {children}
    </button>
  );
}

import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  fullWidth?: boolean;
}

export const Button = ({ variant = 'primary', fullWidth, className = '', children, ...props }: ButtonProps) => {
  const baseStyle = "font-medium py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-primary text-[#0d0d0d] hover:bg-opacity-90",
    secondary: "bg-surface text-textPri border border-border hover:bg-border",
    danger: "bg-blocked text-white hover:bg-opacity-90",
    ghost: "bg-transparent text-primary hover:bg-surface",
  };

  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

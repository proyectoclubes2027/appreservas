import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  fullWidth?: boolean;
}

export const Button = ({ variant = 'primary', fullWidth, className = '', children, ...props }: ButtonProps) => {
  const baseStyle = "font-medium py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-primary text-white hover:bg-opacity-90 font-bold shadow-md",
    secondary: "bg-white text-gray-800 border border-gray-300 hover:bg-gray-50",
    danger: "bg-blocked text-white hover:bg-opacity-90 font-bold",
    ghost: "bg-transparent text-primary hover:bg-gray-100",
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

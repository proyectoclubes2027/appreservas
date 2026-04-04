import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className={`flex flex-col gap-1 w-full ${className}`}>
        {label && <label className="text-sm text-textSec font-semibold uppercase">{label}</label>}
        <input
          ref={ref}
          className={`bg-surface border ${error ? 'border-blocked' : 'border-border'} text-textPri rounded-md px-4 py-3 outline-none focus:border-primary transition-colors`}
          {...props}
        />
        {error && <span className="text-xs text-blocked mt-1">{error}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';

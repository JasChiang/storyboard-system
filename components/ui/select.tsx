import { SelectHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={clsx(
            'w-full rounded-xl border px-3.5 py-2.5 text-sm',
            'border-border/80 bg-white/72 text-foreground shadow-[0_10px_20px_-14px_rgba(15,23,42,0.45)] backdrop-blur-lg',
            'dark:bg-slate-900/65',
            'focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40',
            'disabled:cursor-not-allowed disabled:opacity-55',
            error && 'border-destructive/70 focus:ring-destructive/35 focus:border-destructive/60',
            className
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="mt-1 text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

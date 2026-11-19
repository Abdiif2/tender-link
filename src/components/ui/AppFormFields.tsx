import React from 'react';
import { AlertCircle } from 'lucide-react';

interface BaseFieldProps {
  id: string;
  label: string;
  helperText?: string;
  error?: string;
  required?: boolean;
}

interface AppInputProps
  extends BaseFieldProps,
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> {}

export function AppInput({
  id,
  label,
  helperText,
  error,
  required,
  className = '',
  ...rest
}: AppInputProps) {
  const describedBy = error
    ? `${id}-error`
    : helperText
      ? `${id}-helper`
      : undefined;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-sm font-semibold text-[#0B1F3A] text-start"
      >
        {label}
        {required && (
          <span className="ms-1 text-[#B91C1C]" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        required={required}
        className={`w-full min-h-[44px] rounded-lg bg-white px-3.5 py-2.5 text-base sm:text-sm text-[#0B1F3A] placeholder:text-[#64748B] border transition-colors ${
          error
            ? 'border-[#B91C1C] focus:border-[#B91C1C]'
            : 'border-[#CBD5E1] focus:border-[#2563EB]'
        } ${className}`}
        {...rest}
      />
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="flex items-start gap-1.5 text-xs font-medium text-[#B91C1C]"
        >
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <p id={`${id}-helper`} className="text-xs text-[#64748B]">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

interface AppSelectProps
  extends BaseFieldProps,
    Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export function AppSelect({
  id,
  label,
  helperText,
  error,
  required,
  options,
  placeholder,
  className = '',
  ...rest
}: AppSelectProps) {
  const describedBy = error
    ? `${id}-error`
    : helperText
      ? `${id}-helper`
      : undefined;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-sm font-semibold text-[#0B1F3A] text-start"
      >
        {label}
        {required && (
          <span className="ms-1 text-[#B91C1C]" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <select
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        required={required}
        className={`w-full min-h-[44px] rounded-lg bg-white px-3.5 py-2.5 text-base sm:text-sm text-[#0B1F3A] border transition-colors ${
          error
            ? 'border-[#B91C1C] focus:border-[#B91C1C]'
            : 'border-[#CBD5E1] focus:border-[#2563EB]'
        } ${className}`}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="flex items-start gap-1.5 text-xs font-medium text-[#B91C1C]"
        >
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <p id={`${id}-helper`} className="text-xs text-[#64748B]">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

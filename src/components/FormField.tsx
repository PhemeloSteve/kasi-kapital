import type { ReactNode } from "react";

const inputClass = "mt-1 input";

type BaseProps = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
};

function Frame({
  id,
  label,
  error,
  hint,
  required = true,
  children,
}: BaseProps & { children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
        {!required && <span className="font-normal text-gray-500"> (optional)</span>}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-gray-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

const describedBy = (id: string, hint?: string, error?: string) =>
  [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;

type InputProps = BaseProps & {
  type?: string;
  autoComplete?: string;
  defaultValue?: string;
  minLength?: number;
  maxLength?: number;
  inputMode?: "text" | "decimal" | "url";
  placeholder?: string;
};

export function FormField({ type = "text", error, hint, required = true, ...rest }: InputProps) {
  const { id, label, ...inputProps } = rest;
  return (
    <Frame id={id} label={label} error={error} hint={hint} required={required}>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={inputClass}
        {...inputProps}
      />
    </Frame>
  );
}

export function TextAreaField({
  error,
  hint,
  required = true,
  defaultValue,
  maxLength,
  rows = 3,
  ...base
}: BaseProps & { defaultValue?: string; maxLength?: number; rows?: number }) {
  return (
    <Frame {...base} error={error} hint={hint} required={required}>
      <textarea
        id={base.id}
        name={base.id}
        rows={rows}
        required={required}
        maxLength={maxLength}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(base.id, hint, error)}
        className={inputClass}
      />
    </Frame>
  );
}

export function SelectField({
  error,
  hint,
  required = true,
  defaultValue,
  options,
  placeholder,
  ...base
}: BaseProps & {
  defaultValue?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <Frame {...base} error={error} hint={hint} required={required}>
      <select
        id={base.id}
        name={base.id}
        required={required}
        defaultValue={defaultValue ?? ""}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(base.id, hint, error)}
        className={inputClass}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Frame>
  );
}

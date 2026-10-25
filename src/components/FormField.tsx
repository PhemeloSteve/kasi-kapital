type Props = {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  defaultValue?: string;
  error?: string;
  hint?: string;
  minLength?: number;
  maxLength?: number;
};

export function FormField({ id, label, type = "text", error, hint, ...rest }: Props) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        {...rest}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
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

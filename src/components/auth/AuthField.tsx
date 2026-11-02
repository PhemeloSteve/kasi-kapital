"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

type Props = {
  id: string;
  label: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  defaultValue?: string;
  error?: string;
  hint?: string;
  minLength?: number;
  maxLength?: number;
  inputMode?: "text" | "numeric" | "email";
  centered?: boolean;
  required?: boolean;
};

const inputBase =
  "w-full rounded-xl border px-3.5 py-3 text-base transition-colors focus:outline-none " +
  // on the green sheet (phones)
  "border-white/40 bg-transparent text-white placeholder:text-white/40 focus:border-white " +
  // on the cream card (large screens)
  "lg:border-gray-300 lg:bg-white lg:text-gray-900 lg:placeholder:text-gray-400 lg:focus:border-brand";

/** A labelled field for the sign-in screens, with a show/hide eye on passwords. */
export function AuthField({
  id,
  label,
  type = "text",
  error,
  hint,
  centered,
  required = true,
  ...rest
}: Props) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const describedBy =
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-brand-cream/90 lg:text-gray-700"
      >
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          name={id}
          type={isPassword && visible ? "text" : type}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${inputBase} ${isPassword ? "pr-12" : ""} ${centered ? "text-center text-2xl tracking-widest" : ""} ${error ? "border-red-300 lg:border-red-500" : ""}`}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-white/70 hover:text-white lg:text-gray-500 lg:hover:text-gray-800"
          >
            {visible ? (
              <EyeOff aria-hidden="true" className="h-5 w-5" />
            ) : (
              <Eye aria-hidden="true" className="h-5 w-5" />
            )}
          </button>
        )}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-white/60 lg:text-gray-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-red-300 lg:text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

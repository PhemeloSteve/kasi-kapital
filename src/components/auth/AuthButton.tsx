import type { ReactNode } from "react";

const base =
  "inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70";
// white pill on the green sheet (phones), dark green pill on the cream card (large screens)
const primary =
  "bg-brand-cream text-brand-deep hover:bg-white lg:bg-brand lg:text-white lg:hover:bg-brand-dark";

export function Spinner() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 animate-spin" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function AuthSubmit({
  pending,
  children,
  pendingLabel,
}: {
  pending: boolean;
  children: ReactNode;
  pendingLabel: string;
}) {
  return (
    <button type="submit" disabled={pending} className={`${base} ${primary}`}>
      {pending && <Spinner />}
      {pending ? pendingLabel : children}
    </button>
  );
}

export const authLinkClass = "font-semibold underline underline-offset-2 hover:opacity-80";
export const authErrorClass =
  "rounded-xl border border-red-300/40 bg-red-500/15 px-4 py-3 text-sm text-red-100 lg:border-red-200 lg:bg-red-50 lg:text-red-800";

/** For links and plain form buttons that should look like the main sign-in button. */
export const authPrimaryClass = `${base} ${primary}`;
export const authSecondaryClass = `${base} border border-white/40 text-brand-cream hover:bg-white/10 lg:border-gray-300 lg:text-gray-800 lg:hover:bg-gray-50`;

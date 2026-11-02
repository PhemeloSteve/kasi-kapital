"use client";

import { Briefcase, HandCoins, HeartHandshake } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { signUpAction, type FormState } from "@/app/(auth)/actions";
import { AuthField } from "./auth/AuthField";
import { authErrorClass, authLinkClass, AuthSubmit } from "./auth/AuthButton";

const initial: FormState = { status: "idle" };

const roles = [
  {
    value: "business",
    title: "I run a business",
    text: "Create a profile, set funding goals and show your progress.",
    Icon: Briefcase,
  },
  {
    value: "investor",
    title: "I want to back businesses",
    text: "Discover verified local businesses and fund their goals.",
    Icon: HandCoins,
  },
  {
    value: "donor",
    title: "I represent a company or want to donate",
    text: "Support local businesses with nothing expected in return.",
    Icon: HeartHandshake,
  },
] as const;

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, initial);

  if (state.status === "confirm_email") {
    return (
      <div role="status" className="space-y-2">
        <h1 className="text-3xl font-medium tracking-tight">Check your email</h1>
        <p className="text-sm text-brand-cream/90 lg:text-gray-700">
          We sent a confirmation link to <strong>{state.values?.email}</strong>. Open it to finish
          creating your account.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <div>
        <h1 className="text-3xl font-medium tracking-tight">Create your account</h1>
        <p className="mt-1.5 text-sm text-brand-cream/80 lg:text-gray-600">
          Join the community backing South Africa&apos;s small businesses.
        </p>
      </div>

      {state.message && (
        <p role="alert" className={authErrorClass}>
          {state.message}
        </p>
      )}

      <AuthField
        id="fullName"
        label="Full name"
        autoComplete="name"
        defaultValue={state.values?.fullName}
        error={state.fields?.fullName}
        maxLength={100}
      />
      <AuthField
        id="email"
        label="Email address"
        type="email"
        inputMode="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        error={state.fields?.email}
      />
      <AuthField
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="At least 10 characters. A short phrase works well."
        error={state.fields?.password}
        minLength={10}
        maxLength={72}
      />

      <fieldset>
        <legend className="text-sm font-medium text-brand-cream/90 lg:text-gray-700">
          How will you use Kasi Kapital?
        </legend>
        <div className="mt-2 space-y-2">
          {roles.map(({ value, title, text, Icon }) => (
            <label
              key={value}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/30 p-3 transition-colors has-[:checked]:border-white has-[:checked]:bg-white/10 lg:border-gray-300 lg:bg-white lg:has-[:checked]:border-brand lg:has-[:checked]:bg-brand-light"
            >
              <input
                type="radio"
                name="role"
                value={value}
                required
                defaultChecked={state.values?.role === value}
                className="mt-1 accent-[#FDFBF7] lg:accent-brand"
              />
              <Icon
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 shrink-0 text-brand-cream/80 lg:text-brand"
              />
              <span>
                <span className="block text-sm font-medium">{title}</span>
                <span className="block text-xs text-brand-cream/70 lg:text-gray-600">{text}</span>
              </span>
            </label>
          ))}
        </div>
        {state.fields?.role && (
          <p role="alert" className="mt-1.5 text-sm text-red-300 lg:text-red-700">
            {state.fields.role}
          </p>
        )}
      </fieldset>

      <div>
        <label className="flex items-start gap-3 text-sm text-brand-cream/90 lg:text-gray-700">
          <input
            type="checkbox"
            name="consent"
            required
            defaultChecked={state.values?.consent}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[#FDFBF7] lg:accent-brand"
          />
          <span>
            I have read the{" "}
            <Link href="/privacy" className={authLinkClass} target="_blank">
              privacy notice
            </Link>{" "}
            and agree that Kasi Kapital may process my personal information as described, including
            identity and business documents I choose to upload.
          </span>
        </label>
        {state.fields?.consent && (
          <p role="alert" className="mt-1.5 text-sm text-red-300 lg:text-red-700">
            {state.fields.consent}
          </p>
        )}
      </div>

      <AuthSubmit pending={pending} pendingLabel="Creating account…">
        Create account
      </AuthSubmit>

      <p className="text-center text-sm text-brand-cream/90 lg:text-gray-700">
        Already registered?{" "}
        <Link href="/login" className={authLinkClass}>
          Log in
        </Link>
      </p>
    </form>
  );
}

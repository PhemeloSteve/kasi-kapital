"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUpAction, type FormState } from "@/app/(auth)/actions";
import { FormField } from "./FormField";

const initial: FormState = { status: "idle" };

const roles = [
  {
    value: "business",
    title: "I run a business",
    text: "Create a profile, set funding goals and show your progress.",
  },
  {
    value: "investor",
    title: "I want to back businesses",
    text: "Discover verified local businesses and fund their goals.",
  },
  {
    value: "donor",
    title: "I represent a company or want to donate",
    text: "Support local businesses with nothing expected in return.",
  },
] as const;

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, initial);

  if (state.status === "confirm_email") {
    return (
      <div
        role="status"
        className="rounded-md border border-brand/30 bg-brand-light p-4 text-slate-800"
      >
        <p className="font-medium">Check your email</p>
        <p className="mt-1 text-sm">
          We sent a confirmation link to <strong>{state.values?.email}</strong>. Open it to finish
          creating your account.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {state.message}
        </p>
      )}

      <FormField
        id="fullName"
        label="Full name"
        autoComplete="name"
        defaultValue={state.values?.fullName}
        error={state.fields?.fullName}
        maxLength={100}
      />
      <FormField
        id="email"
        label="Email address"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        error={state.fields?.email}
      />
      <FormField
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
        <legend className="text-sm font-medium text-slate-800">
          How will you use Kasi Kapital?
        </legend>
        <div className="mt-2 space-y-2">
          {roles.map((r) => (
            <label
              key={r.value}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-300 p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-light"
            >
              <input
                type="radio"
                name="role"
                value={r.value}
                required
                defaultChecked={state.values?.role === r.value}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium">{r.title}</span>
                <span className="block text-xs text-slate-600">{r.text}</span>
              </span>
            </label>
          ))}
        </div>
        {state.fields?.role && (
          <p role="alert" className="mt-1 text-sm text-red-700">
            {state.fields.role}
          </p>
        )}
      </fieldset>

      <div>
        <label className="flex items-start gap-3 text-sm text-slate-800">
          <input
            type="checkbox"
            name="consent"
            required
            defaultChecked={state.values?.consent}
            className="mt-1"
          />
          <span>
            I have read the{" "}
            <Link href="/privacy" className="text-brand underline" target="_blank">
              privacy notice
            </Link>{" "}
            and agree that Kasi Kapital may process my personal information as described, including
            identity and business documents I choose to upload.
          </span>
        </label>
        {state.fields?.consent && (
          <p role="alert" className="mt-1 text-sm text-red-700">
            {state.fields.consent}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>

      <p className="text-center text-sm text-slate-600">
        Already registered?{" "}
        <Link href="/login" className="text-brand underline">
          Log in
        </Link>
      </p>
    </form>
  );
}

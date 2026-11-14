"use client";

import Link from "next/link";
import { useActionState } from "react";
import { logInAction, type FormState } from "@/app/(auth)/actions";
import { AuthField } from "./auth/AuthField";
import { TurnstileField } from "./auth/TurnstileField";
import { authErrorClass, authLinkClass, AuthSubmit } from "./auth/AuthButton";

const initial: FormState = { status: "idle" };

export function LogInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(logInAction, initial);

  return (
    <form action={action} className="space-y-5" noValidate>
      <h1 className="text-3xl font-medium tracking-tight">Sign In</h1>

      {state.message && (
        <p role="alert" className={authErrorClass}>
          {state.message}
        </p>
      )}
      {next && <input type="hidden" name="next" value={next} />}

      <AuthField
        id="email"
        label="Email address"
        type="email"
        autoComplete="email"
        inputMode="email"
        defaultValue={state.values?.email}
      />
      <AuthField
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        maxLength={72}
        hint="Encrypted sign-in. Your details stay private."
      />

      <label className="flex cursor-pointer items-center gap-3 text-sm text-brand-cream lg:text-gray-800">
        <input
          type="checkbox"
          name="keep"
          className="h-5 w-5 rounded border-white/50 accent-[#FDFBF7] lg:border-gray-400 lg:accent-brand"
        />
        Keep me logged in
      </label>

      <TurnstileField resetSignal={state} />
      <AuthSubmit pending={pending} pendingLabel="Signing in…">
        Sign in
      </AuthSubmit>

      <p className="text-center text-sm text-brand-cream/90 lg:text-gray-700">
        New to Kasi Kapital?{" "}
        <Link href="/signup" className={authLinkClass}>
          Create an account
        </Link>
      </p>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useActionState } from "react";
import { logInAction, type FormState } from "@/app/(auth)/actions";
import { FormField } from "./FormField";

const initial: FormState = { status: "idle" };

export function LogInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(logInAction, initial);

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {state.message}
        </p>
      )}
      {next && <input type="hidden" name="next" value={next} />}
      <FormField
        id="email"
        label="Email address"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
      />
      <FormField
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        maxLength={72}
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "Logging in…" : "Log in"}
      </button>
      <p className="text-center text-sm text-slate-600">
        New here?{" "}
        <Link href="/signup" className="text-brand underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

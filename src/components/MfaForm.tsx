"use client";

import { useActionState } from "react";
import {
  beginEnrollmentAction,
  verifyMfaAction,
  type EnrollState,
  type VerifyState,
} from "@/app/admin/mfa/actions";
import { AuthField } from "./auth/AuthField";
import { authErrorClass, authPrimaryClass, AuthSubmit } from "./auth/AuthButton";

/** Two-factor setup (first time) or code entry (every login) for administrators. */
export function MfaForm({ existingFactorId }: { existingFactorId: string | null }) {
  const [enroll, enrollAction, enrolling] = useActionState<EnrollState, FormData>(
    beginEnrollmentAction,
    { status: "idle" },
  );
  const [verify, verifyAction, verifying] = useActionState<VerifyState, FormData>(verifyMfaAction, {
    status: "idle",
  });

  const factorId =
    existingFactorId ?? (enroll.status === "ready" ? (enroll.factorId ?? null) : null);

  if (!factorId) {
    return (
      <form action={enrollAction} className="space-y-4">
        <p className="text-sm text-brand-cream/90 lg:text-gray-700">
          Administrators must use an authenticator app (such as Google Authenticator, Microsoft
          Authenticator or Authy). This protects the verification and payout tools if your password
          is ever stolen.
        </p>
        {enroll.status === "error" && (
          <p role="alert" className={authErrorClass}>
            {enroll.message}
          </p>
        )}
        <button type="submit" disabled={enrolling} className={authPrimaryClass}>
          {enrolling ? "Preparing…" : "Set up my authenticator app"}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-5">
      {enroll.status === "ready" && enroll.qrCode && (
        <div className="space-y-3 rounded-2xl bg-white p-4 text-center text-gray-800">
          <p className="text-sm font-medium">1. Scan this code with your authenticator app</p>
          {/* The QR code is an SVG data address made by Supabase for this account only. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enroll.qrCode}
            alt="QR code to add Kasi Kapital to your authenticator app"
            className="mx-auto h-44 w-44"
          />
          <p className="text-xs text-gray-600">
            Can&apos;t scan? Enter this key by hand:{" "}
            <code className="break-all rounded bg-gray-100 px-1">{enroll.secret}</code>
          </p>
        </div>
      )}

      <form action={verifyAction} className="space-y-4" noValidate>
        <input type="hidden" name="factorId" value={factorId} />
        <AuthField
          id="code"
          label={
            enroll.status === "ready"
              ? "2. Enter the 6-digit code it shows"
              : "Enter the 6-digit code from your authenticator app"
          }
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          centered
        />
        {verify.status === "error" && (
          <p role="alert" className={authErrorClass}>
            {verify.message}
          </p>
        )}
        <AuthSubmit pending={verifying} pendingLabel="Checking…">
          Verify and continue
        </AuthSubmit>
      </form>
    </div>
  );
}

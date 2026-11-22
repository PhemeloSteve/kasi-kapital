import { DashboardShell } from "@/components/DashboardShell";
import { requireUser } from "@/app/_lib/guard";
import { createAccountEraser } from "@/infrastructure/supabase/account-eraser";
import { deleteAccountAction } from "./actions";

export const metadata = { title: "Delete my account | Kasi Kapital" };

const errors: Record<string, string> = {
  confirm_required: "Please type DELETE in the box to confirm.",
  money_held:
    "Money is still held for you, so your account can't be deleted yet. Try again once it has been paid out.",
  not_allowed: "This account can't be deleted here.",
  failed: "We couldn't delete your account, and nothing was changed. Please try again.",
};

export default async function DeleteAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser(["business", "investor", "donor"]);
  const { error } = await searchParams;
  const blocked = await createAccountEraser().moneyInPlay();

  return (
    <DashboardShell
      role={user.role}
      name={user.fullName}
      title="Delete my account"
      subtitle="You can ask us to delete your personal information at any time."
      narrow
    >
      {error && errors[error] && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {errors[error]}
        </p>
      )}

      <div className="card space-y-4 p-6 text-sm text-gray-700 sm:p-8">
        <p>
          <strong>This cannot be undone.</strong> We remove your name and profile details straight
          away, and you are signed out everywhere.
        </p>
        {user.role === "business" && (
          <p>
            Your business is closed and its profile details are removed. Documents that were never
            approved are deleted within a day, and approved ones 12 months after it closes.
          </p>
        )}
        <p>
          Records of money that moved through Kasi Kapital are kept, without your name, because the
          law requires us to keep them for several years.
        </p>

        {blocked ? (
          <p role="note" className="rounded-xl bg-amber-50 p-3 text-amber-900">
            Money is still held for you (or for your business), so your account can&apos;t be
            deleted yet. Once it has been paid out, you can come back here.
          </p>
        ) : (
          <form action={deleteAccountAction} className="space-y-4">
            <div>
              <label htmlFor="confirmation" className="block text-sm font-medium text-gray-700">
                Type DELETE to confirm
              </label>
              <input
                id="confirmation"
                name="confirmation"
                type="text"
                required
                autoComplete="off"
                className="mt-1 input"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
            >
              Delete my account
            </button>
          </form>
        )}
      </div>
    </DashboardShell>
  );
}

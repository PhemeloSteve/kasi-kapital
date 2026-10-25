import Link from "next/link";
import { redirect } from "next/navigation";
import { landingPathForRole } from "@/domain/roles";
import { createAuthGateway } from "@/infrastructure/supabase/auth-gateway";

export default async function Home() {
  const user = await createAuthGateway().getCurrentUser();
  if (user) redirect(user.consented ? landingPathForRole(user.role) : "/consent");

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-4xl font-bold text-brand">Kasi Kapital</h1>
      <p className="mt-3 text-lg text-slate-700">
        Your kasi, your capital. Verified small businesses, backed by the community around them.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/signup"
          className="rounded-md bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark"
        >
          Create account
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-slate-300 px-5 py-2.5 font-medium hover:bg-slate-50"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}

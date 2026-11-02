import Link from "next/link";
import { Wordmark } from "@/components/brand/Logo";

export const metadata = { title: "Privacy notice | Kasi Kapital" };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <header className="bg-brand text-brand-cream">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4 sm:px-6">
          <Link href="/" aria-label="Kasi Kapital home">
            <Wordmark className="text-3xl" />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-brand">Privacy notice</h1>
        <p role="note" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Draft for the hackathon demo. Before launch this must be reviewed by a lawyer and name our
          Information Officer.
        </p>
        <h2 className="pt-2 text-lg font-semibold text-gray-900">What we collect and why</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
          <li>Account details (name, email) to run your account.</li>
          <li>
            Business details and documents (such as registration and bank statements) to verify
            businesses and prevent fraud.
          </li>
          <li>
            Identity details from people who fund businesses, to prevent fraud and meet legal
            obligations.
          </li>
        </ul>
        <h2 className="pt-2 text-lg font-semibold text-gray-900">How we protect it</h2>
        <p className="text-sm text-gray-700">
          Documents are kept in private storage and are visible only to you and authorised
          administrators. Business locations are shown only as an approximate area, never a home
          address.
        </p>
        <h2 className="pt-2 text-lg font-semibold text-gray-900">
          Documents and how long we keep them
        </h2>
        <p className="text-sm text-gray-700">
          ID documents and bank statements are opened only by you and our verification team, and
          every time a team member opens one it is recorded. You can delete documents that have not
          been approved. Approved documents are kept while your business is active so decisions can
          be checked, and are deleted when you close your account, unless the law requires us to
          keep them.
        </p>
        <h2 className="pt-2 text-lg font-semibold text-gray-900">Your rights</h2>
        <p className="text-sm text-gray-700">
          Under POPIA you may ask to see, correct or delete your information, or complain to the
          Information Regulator.
        </p>
      </main>
    </div>
  );
}

export const metadata = { title: "Privacy notice | Kasi Kapital" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-bold text-brand">Privacy notice</h1>
      <p role="note" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
        Draft for the hackathon demo. Before launch this must be reviewed by a lawyer and name our
        Information Officer.
      </p>
      <h2 className="text-lg font-semibold">What we collect and why</h2>
      <ul className="list-disc space-y-1 pl-5 text-sm">
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
      <h2 className="text-lg font-semibold">How we protect it</h2>
      <p className="text-sm">
        Documents are kept in private storage and are visible only to you and authorised
        administrators. Business locations are shown only as an approximate area, never a home
        address.
      </p>
      <h2 className="text-lg font-semibold">Your rights</h2>
      <p className="text-sm">
        Under POPIA you may ask to see, correct or delete your information, or complain to the
        Information Regulator.
      </p>
    </main>
  );
}

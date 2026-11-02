import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { DocumentUploadForm } from "@/components/DocumentUploadForm";
import { VerificationBadge } from "@/components/VerificationBadge";
import { requireUser } from "@/app/_lib/guard";
import {
  documentInfo,
  isUploadableType,
  missingRequirements,
  trustTierLabels,
  uploadableTypes,
} from "@/domain/documents";
import { createBusinessStore } from "@/infrastructure/supabase/business-store";
import { createDocumentStore } from "@/infrastructure/supabase/document-store";
import { deleteDocumentAction, submitForReviewAction } from "./actions";
import { pageErrors, pageNotices } from "./messages";

export const metadata = { title: "Verify your business | Kasi Kapital" };

const dateFormat = new Intl.DateTimeFormat("en-ZA", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await requireUser(["business"]);
  const { notice, error } = await searchParams;

  const business = await createBusinessStore().getMyBusiness(user.userId);
  if (!business) redirect("/business/profile");
  const documents = await createDocumentStore().listMyDocuments(business.id);

  const missing = missingRequirements(documents);
  const canSubmit =
    (business.verification === "unverified" || business.verification === "rejected") &&
    missing.length === 0;
  const label = (type: string) => (isUploadableType(type) ? documentInfo[type].label : type);

  return (
    <DashboardShell
      role="business"
      name={user.fullName}
      title="Verify your business"
      subtitle="Upload your documents so supporters can find and trust you."
    >
      <div className="space-y-8">
        <Link href="/business" className="text-sm text-gray-600 underline">
          Back to your business
        </Link>

        {notice && pageNotices[notice] && (
          <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-900">
            {pageNotices[notice]}
          </p>
        )}
        {error && pageErrors[error] && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {pageErrors[error]}
          </p>
        )}

        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">{business.name}</h2>
              <p className="text-sm text-gray-600">
                Trust level: {trustTierLabels[business.trustTier]}
              </p>
            </div>
            <VerificationBadge status={business.verification} />
          </div>
          <p className="mt-3 text-sm text-gray-700">
            Supporters can see your business once we have checked <strong>who you are</strong> and{" "}
            <strong>that the business trades</strong>. Everything you upload stays private.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {uploadableTypes.map((type) => {
              const done = documents.some((d) => d.type === type && d.status !== "rejected");
              return (
                <li key={type} className="flex gap-2">
                  <span aria-hidden="true" className={done ? "text-green-700" : "text-gray-400"}>
                    {done ? "✓" : "○"}
                  </span>
                  <span>
                    <span className="font-medium">
                      {documentInfo[type].label}
                      {!documentInfo[type].required && (
                        <span className="font-normal text-gray-500"> (optional)</span>
                      )}
                    </span>
                    <span className="block text-xs text-gray-600">{documentInfo[type].hint}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {business.verification !== "suspended" && (
          <section>
            <h2 className="mb-3 text-lg font-semibold">Upload a document</h2>
            <DocumentUploadForm />
          </section>
        )}

        <section>
          <h2 className="mb-3 text-lg font-semibold">Your documents</h2>
          {documents.length === 0 ? (
            <p className="card border-dashed p-8 text-center text-sm text-gray-600">
              Nothing uploaded yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {documents.map((doc) => (
                <li key={doc.id} className="card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{label(doc.type)}</p>
                      <p className="text-xs text-gray-500">
                        Uploaded {dateFormat.format(new Date(doc.createdAt))}
                      </p>
                    </div>
                    <DocumentStatusBadge status={doc.status} />
                  </div>
                  {doc.status === "rejected" && doc.reviewNote && (
                    <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-900">
                      <span className="font-medium">Why it was rejected:</span> {doc.reviewNote}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-4 text-sm">
                    <a
                      href={`/documents/${doc.id}/view`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand underline"
                    >
                      Open
                    </a>
                    {doc.status !== "verified" && (
                      <form action={deleteDocumentAction}>
                        <input type="hidden" name="documentId" value={doc.id} />
                        <button type="submit" className="text-red-700 underline">
                          Delete
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="text-lg font-semibold">Submit for review</h2>
          {business.verification === "pending" && (
            <p className="mt-2 text-sm text-gray-700">
              Your documents are with our team. You can still add more while you wait.
            </p>
          )}
          {business.verification === "verified" && (
            <p className="mt-2 text-sm text-gray-700">
              Your business is verified. Add a CIPC registration to reach the highest trust level.
            </p>
          )}
          {business.verification === "suspended" && (
            <p className="mt-2 text-sm text-red-800">
              Your business is suspended. Please contact support.
            </p>
          )}
          {(business.verification === "unverified" || business.verification === "rejected") && (
            <>
              {business.verification === "rejected" && (
                <p className="mt-2 text-sm text-red-800">
                  Something needed fixing. Read the reasons above, upload a replacement, then submit
                  again.
                </p>
              )}
              {missing.length > 0 && (
                <p className="mt-2 text-sm text-gray-700">
                  Still needed: {missing.map((type) => documentInfo[type].label).join(" and ")}.
                </p>
              )}
              <form action={submitForReviewAction} className="mt-3">
                <button type="submit" disabled={!canSubmit} className="btn-primary px-5">
                  Submit for review
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}

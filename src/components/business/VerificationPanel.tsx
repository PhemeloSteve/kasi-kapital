import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileUp,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { DocumentRecord } from "@/application/ports";
import {
  documentInfo,
  trustTierLabels,
  uploadableTypes,
  type TrustTier,
  type UploadableType,
} from "@/domain/documents";
import type { VerificationStatus } from "@/domain/types";

type Row = { Icon: LucideIcon; row: string; icon: string; status: string };

const rows: Record<"verified" | "pending" | "rejected" | "missing", Row> = {
  verified: {
    Icon: CheckCircle2,
    row: "border-emerald-100 bg-emerald-50",
    icon: "text-emerald-600",
    status: "Approved",
  },
  pending: {
    Icon: Clock,
    row: "border-amber-100 bg-amber-50",
    icon: "text-amber-600",
    status: "Under review",
  },
  rejected: {
    Icon: AlertCircle,
    row: "border-red-100 bg-red-50",
    icon: "text-red-600",
    status: "Rejected: upload a new one",
  },
  missing: {
    Icon: FileUp,
    row: "border-dashed border-gray-300 bg-white",
    icon: "text-gray-400",
    status: "Not uploaded yet",
  },
};

/** The best state across a document type's uploads: approved beats under review beats rejected. */
function stateFor(type: UploadableType, documents: DocumentRecord[]): keyof typeof rows {
  const mine = documents.filter((d) => d.type === type);
  if (mine.some((d) => d.status === "verified")) return "verified";
  if (mine.some((d) => d.status === "pending")) return "pending";
  if (mine.some((d) => d.status === "rejected")) return "rejected";
  return "missing";
}

const headline: Record<VerificationStatus, { title: string; text: string; box: string }> = {
  verified: {
    title: "You are verified",
    text: "Supporters can see and back your business.",
    box: "bg-brand text-white",
  },
  pending: {
    title: "Under review",
    text: "Our team is checking your documents.",
    box: "bg-amber-50 text-amber-900",
  },
  unverified: {
    title: "Not verified yet",
    text: "Upload your documents so supporters can find you.",
    box: "bg-gray-100 text-gray-800",
  },
  rejected: {
    title: "Needs attention",
    text: "Some documents were rejected. Read the reasons and upload new ones.",
    box: "bg-red-50 text-red-900",
  },
  suspended: { title: "Suspended", text: "Please contact support.", box: "bg-red-50 text-red-900" },
};

export function VerificationPanel({
  status,
  tier,
  documents,
}: {
  status: VerificationStatus;
  tier: TrustTier;
  documents: DocumentRecord[];
}) {
  const top = headline[status];
  return (
    <section aria-labelledby="trust-heading" className="card p-6">
      <h2 id="trust-heading" className="flex items-center gap-2 text-lg font-bold text-gray-900">
        <ShieldCheck aria-hidden="true" className="h-5 w-5 text-brand" />
        Verification &amp; trust
      </h2>

      <div className={`mt-4 rounded-xl p-4 ${top.box}`}>
        <p className="font-semibold">{top.title}</p>
        <p className="mt-0.5 text-sm opacity-90">{top.text}</p>
        {tier > 0 && (
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide opacity-80">
            Trust level: {trustTierLabels[tier]}
          </p>
        )}
      </div>

      <ul className="mt-4 space-y-2.5">
        {uploadableTypes.map((type) => {
          const { Icon, row, icon, status: label } = rows[stateFor(type, documents)];
          return (
            <li key={type} className={`flex items-start gap-3 rounded-xl border p-3 ${row}`}>
              <Icon aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${icon}`} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {documentInfo[type].label}
                  {!documentInfo[type].required && (
                    <span className="font-normal text-gray-500"> (optional)</span>
                  )}
                </p>
                <p className="text-xs text-gray-600">{label}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <Link href="/business/documents" className="btn-secondary mt-5 w-full">
        Manage documents
      </Link>
    </section>
  );
}

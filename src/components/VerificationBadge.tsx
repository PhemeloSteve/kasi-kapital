import type { VerificationStatus } from "@/domain/types";

const styles: Record<VerificationStatus, { label: string; className: string }> = {
  unverified: { label: "Not yet verified", className: "bg-gray-100 text-gray-700" },
  pending: { label: "Under review", className: "bg-amber-100 text-amber-900" },
  verified: { label: "Verified", className: "bg-green-100 text-green-800" },
  rejected: { label: "Needs attention", className: "bg-red-100 text-red-800" },
  suspended: { label: "Suspended", className: "bg-red-100 text-red-800" },
};

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const { label, className } = styles[status];
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

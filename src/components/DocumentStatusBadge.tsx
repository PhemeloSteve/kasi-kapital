import type { DocumentStatus } from "@/domain/documents";

const styles: Record<DocumentStatus, { label: string; className: string }> = {
  pending: { label: "Waiting for review", className: "bg-amber-100 text-amber-900" },
  verified: { label: "Approved", className: "bg-green-100 text-green-800" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800" },
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const { label, className } = styles[status];
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

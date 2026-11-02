import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const tones = {
  green: "bg-brand-light text-brand",
  amber: "bg-amber-50 text-amber-700",
  slate: "bg-gray-100 text-gray-600",
} as const;

/** One number with an icon, as in the dashboard designs. */
export function StatCard({
  label,
  value,
  Icon,
  tone = "green",
  note,
}: {
  label: string;
  value: ReactNode;
  Icon: LucideIcon;
  tone?: keyof typeof tones;
  note?: ReactNode;
}) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${tones[tone]}`}
      >
        <Icon aria-hidden="true" className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="truncate text-2xl font-bold text-gray-900">{value}</p>
        {note && <p className="text-xs text-gray-500">{note}</p>}
      </div>
    </div>
  );
}

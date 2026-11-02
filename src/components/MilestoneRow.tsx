import { AlertCircle, CheckCircle2, Clock, Lock, Upload, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { formatRand } from "@/domain/money";
import type { MilestoneTone } from "./milestone-labels";

const tones: Record<MilestoneTone, { Icon: LucideIcon; row: string; icon: string }> = {
  success: {
    Icon: CheckCircle2,
    row: "border-emerald-100 bg-emerald-50/60",
    icon: "text-emerald-600",
  },
  waiting: { Icon: Clock, row: "border-amber-100 bg-amber-50/60", icon: "text-amber-600" },
  action: { Icon: Upload, row: "border-amber-200 bg-amber-50", icon: "text-amber-600" },
  attention: { Icon: AlertCircle, row: "border-red-100 bg-red-50", icon: "text-red-600" },
  locked: { Icon: Lock, row: "border-gray-100 bg-gray-50", icon: "text-gray-400" },
};

type Props = {
  index: number;
  title: string;
  amountCents: number;
  label: string;
  tone: MilestoneTone;
  children?: ReactNode;
};

/** One milestone: an icon for where it stands, its name and status, and its amount. */
export function MilestoneRow({ index, title, amountCents, label, tone, children }: Props) {
  const { Icon, row, icon } = tones[tone];
  return (
    <li className={`rounded-xl border p-3.5 ${row} ${tone === "locked" ? "opacity-80" : ""}`}>
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${icon}`} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900">
            {index}. {title}
          </p>
          <p className="text-sm text-gray-600">{label}</p>
        </div>
        <p className="shrink-0 font-semibold text-gray-900">{formatRand(amountCents)}</p>
      </div>
      {children}
    </li>
  );
}

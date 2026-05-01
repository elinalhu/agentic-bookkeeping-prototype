import { cn } from "@/lib/utils";
import type { TransactionStatus } from "@/lib/types";

const STYLES: Record<
  TransactionStatus,
  { label: string; className: string }
> = {
  needs_review: {
    label: "Needs review",
    className: "bg-amber-50 text-amber-900 ring-amber-200",
  },
  auto_categorized: {
    label: "Auto-categorized",
    className: "bg-zinc-50 text-zinc-700 ring-zinc-200",
  },
  rule_applied: {
    label: "Rule applied",
    className: "bg-violet-50 text-violet-900 ring-violet-200",
  },
  resolved_by_user: {
    label: "Resolved",
    className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
  flagged_for_cpa: {
    label: "Flagged for CPA",
    className: "bg-rose-50 text-rose-900 ring-rose-200",
  },
};

export function StatusBadge({ status }: { status: TransactionStatus }) {
  const s = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        s.className,
      )}
    >
      {s.label}
    </span>
  );
}

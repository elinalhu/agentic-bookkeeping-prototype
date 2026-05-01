import { cn } from "@/lib/utils";
import type { ConfidenceLevel } from "@/lib/types";

const STYLES: Record<ConfidenceLevel, string> = {
  high: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  medium: "bg-amber-50 text-amber-900 ring-amber-200",
  low: "bg-rose-50 text-rose-900 ring-rose-200",
};

// Short labels — the colored dot already conveys the level visually,
// and the chip lives in narrow inbox columns where "Medium confidence"
// would wrap to two lines.
const LABELS: Record<ConfidenceLevel, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function ConfidenceChip({
  level,
  score,
}: {
  level: ConfidenceLevel;
  score?: number;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        STYLES[level],
      )}
      title={`${level} confidence${
        typeof score === "number" ? ` (${score.toFixed(2)})` : ""
      }`}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
          level === "high"
            ? "bg-emerald-500"
            : level === "medium"
              ? "bg-amber-500"
              : "bg-rose-500",
        )}
      />
      {LABELS[level]}
      {typeof score === "number" ? (
        <span className="font-mono opacity-70">·{score.toFixed(2)}</span>
      ) : null}
    </span>
  );
}

import type { Company } from "@/lib/types";

export function EmptyHistoryNotice({ company }: { company: Company }) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-blue-500"
        />
        <div className="flex-1">
          <div className="text-sm font-medium text-blue-900">
            {company.joinedDaysAgo} days in Pilot — still learning your patterns
          </div>
          <p className="mt-1 text-sm text-blue-800">
            We don&apos;t have prior categorizations to pattern-match against
            yet, so the agent will lean on your business profile and ask a few
            more focused questions than usual. Each decision you make here helps
            us get faster and more confident over time.
          </p>
        </div>
      </div>
    </div>
  );
}

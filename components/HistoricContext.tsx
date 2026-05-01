"use client";

import { accountById, getCompany } from "@/lib/fixtures";
import { buildAgentContext } from "@/lib/agent/buildContext";
import type { Transaction } from "@/lib/types";
import { cn, formatCurrency, formatDateShort } from "@/lib/utils";

interface Props {
  companyId: string;
  txn: Transaction;
}

// Renders the historic transactions the agent had visibility into when
// it formed its hypothesis. Pulled directly from buildAgentContext so
// what's shown here is exactly what the model saw — no hand-curation.
//
// Two sections:
//   1. Prior transactions for THIS merchant (the strongest signal)
//   2. Other recent confirmed categorizations (general business shape)

export function HistoricContext({ companyId, txn }: Props) {
  const company = getCompany(companyId);
  const context = buildAgentContext(company, txn, []);
  const merchant = context.transaction.merchant;

  const hasMerchantHistory = context.similarMerchantHistory.length > 0;
  const hasOtherHistory = context.recentOtherTransactions.length > 0;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        What the agent looked at
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Exactly the historical data the agent had when forming its
        hypothesis. Use this to verify any pattern it cited.
      </p>

      <div className="mt-4 space-y-5">
        <div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-semibold text-zinc-900">
              Prior {merchant} transactions
            </h3>
            <span className="font-mono text-xs text-zinc-400">
              {context.similarMerchantHistory.length}
            </span>
          </div>
          {hasMerchantHistory ? (
            <ul className="mt-2 divide-y divide-zinc-100 rounded-md border border-zinc-200">
              {context.similarMerchantHistory.map((h, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 px-3 py-2 text-xs"
                >
                  <span className="w-16 shrink-0 text-zinc-500">
                    {formatDateShort(h.date)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-zinc-500">
                    {h.memo}
                  </span>
                  <span className="w-24 shrink-0 truncate text-zinc-700">
                    {h.categorizedAs}
                  </span>
                  <span className="w-20 shrink-0 text-right font-mono text-zinc-900 tabular-nums">
                    {formatCurrency(h.amount)}
                  </span>
                  <ViaBadge via={h.via} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
              No prior transactions with this merchant. The agent has to
              reason from the business profile alone.
            </p>
          )}
        </div>

        <div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-semibold text-zinc-900">
              Other recent transactions (general business shape)
            </h3>
            <span className="font-mono text-xs text-zinc-400">
              {context.recentOtherTransactions.length}
            </span>
          </div>
          {hasOtherHistory ? (
            <ul className="mt-2 divide-y divide-zinc-100 rounded-md border border-zinc-200">
              {context.recentOtherTransactions.map((h, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 px-3 py-2 text-xs"
                >
                  <span className="w-16 shrink-0 text-zinc-500">
                    {formatDateShort(h.date)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-zinc-700">
                    {h.merchant}
                  </span>
                  <span className="w-32 shrink-0 truncate text-zinc-700">
                    {h.categorizedAs}
                  </span>
                  <span className="w-20 shrink-0 text-right font-mono text-zinc-900 tabular-nums">
                    {formatCurrency(h.amount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
              No other categorized history yet.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
          <span>
            <span className="font-medium text-zinc-700">Days in Pilot:</span>{" "}
            {context.totals.daysInPilot}
          </span>
          <span>
            <span className="font-medium text-zinc-700">Total history:</span>{" "}
            {context.totals.totalHistoryCount} transactions
          </span>
          {context.isColdStart ? (
            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-800 ring-1 ring-inset ring-blue-200">
              Cold-start mode
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ViaBadge({ via }: { via: "user_confirmed" | "rule_applied" | "agent_auto" }) {
  const styles: Record<typeof via, string> = {
    user_confirmed: "bg-zinc-100 text-zinc-700",
    rule_applied: "bg-violet-100 text-violet-900",
    agent_auto: "bg-blue-100 text-blue-900",
  };
  const labels: Record<typeof via, string> = {
    user_confirmed: "owner",
    rule_applied: "rule",
    agent_auto: "agent",
  };
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        styles[via],
      )}
    >
      {labels[via]}
    </span>
  );
}

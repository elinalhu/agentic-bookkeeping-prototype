"use client";

import Link from "next/link";
import { use } from "react";
import { findTransaction } from "@/lib/fixtures";
import {
  effectiveTransaction,
  useActiveCompany,
  useAgent,
  useAuditLog,
  useDecisions,
  useUserProfile,
} from "@/lib/store";
import type { Transaction } from "@/lib/types";
import { formatCurrency, formatDateShort } from "@/lib/utils";
import {
  AgentActionPanel,
  ResolvedActionPanel,
} from "@/components/AgentActionPanel";
import { AgentHypothesisView } from "@/components/AgentHypothesisView";
import { AgentInspectInline } from "@/components/AgentInspectInline";
import { ClarifyingChat } from "@/components/ClarifyingChat";
import { HistoricContext } from "@/components/HistoricContext";
import { StatusBadge } from "@/components/StatusBadge";

export default function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { company, hydrated } = useActiveCompany();
  const { profile } = useUserProfile();
  const { decisions } = useDecisions(company.id);
  const { eventsForTxn } = useAuditLog(company.id);
  const { state } = useAgent(company.id, id);

  if (!hydrated) {
    return <div className="h-96 animate-pulse rounded-lg bg-zinc-100" />;
  }

  const found = findTransaction(company.id, id);
  if (!found) {
    return (
      <div className="space-y-3">
        <Link href="/tasks" className="text-sm text-zinc-600 hover:text-zinc-900">
          ← Back to Tasks
        </Link>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-700">
          Transaction <span className="font-mono">{id}</span> isn&apos;t in{" "}
          <span className="font-medium">{company.profile.name}</span>. You may
          have switched accounts.
        </div>
      </div>
    );
  }

  const txn = effectiveTransaction(found.transaction, decisions);
  const decision = decisions[txn.id];
  const events = eventsForTxn(txn.id);
  // Auto-categorized intentionally excluded — the agent decided, but
  // the user hasn't formally validated. Detail page should still show
  // the full feedback panel (👍 / 👎 / 🚩) for those.
  const isResolved =
    txn.status === "resolved_by_user" ||
    txn.status === "rule_applied" ||
    txn.status === "flagged_for_cpa";

  // Loading + error states render before we have the agent response.
  if (state.status === "loading" || state.status === "idle") {
    return (
      <div className="space-y-6">
        <BackLink />
        <TransactionHeader txn={txn} />
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Agent thinking…
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-100" />
            <div className="h-3 w-full animate-pulse rounded bg-zinc-100" />
            <div className="h-3 w-11/12 animate-pulse rounded bg-zinc-100" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-zinc-100" />
          </div>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-4">
        <BackLink />
        <TransactionHeader txn={txn} />
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-rose-900">
            Agent unavailable
          </div>
          <p className="mt-1 text-sm text-rose-950">{state.error}</p>
          {/api[_ ]?key|authentic|x-api-key|authorization/i.test(
            state.error,
          ) ? (
            <p className="mt-2 text-xs text-rose-800">
              Set <code className="rounded bg-rose-100 px-1 py-0.5">ANTHROPIC_API_KEY</code> in{" "}
              <code className="rounded bg-rose-100 px-1 py-0.5">.env.local</code> at the project root and save.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const { hypothesis, inspect } = state.data;

  return (
    <div className="space-y-5">
      <BackLink />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* LEFT: read */}
        <div className="space-y-5">
          <TransactionHeader txn={txn} />
          <AgentHypothesisView hypothesis={hypothesis} />
          <HistoricContext companyId={company.id} txn={found.transaction} />
          {/* Inspect surface — system prompt, full context, raw model
              output. Hidden from owners (they don't need engineering
              detail to do bookkeeping); shown to Pilot's internal
              bookkeeping team for QA, debugging, and audit support. */}
          {profile === "cpa" ? <AgentInspectInline inspect={inspect} /> : null}
        </div>

        {/* RIGHT: act (sticky on desktop) */}
        <div className="space-y-4 lg:sticky lg:top-5 lg:self-start">
          {isResolved && decision ? (
            <ResolvedActionPanel
              companyId={company.id}
              txn={txn}
              decidedAt={decision.decidedAt}
              hypothesisAtDecision={decision.hypothesisAtDecision}
              events={events}
            />
          ) : (
            <AgentActionPanel
              companyId={company.id}
              txn={found.transaction}
              hypothesis={hypothesis}
            />
          )}
          <ClarifyingChat
            companyId={company.id}
            txn={found.transaction}
            hypothesis={hypothesis}
            suggestions={chatSuggestions(found.transaction)}
          />
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/tasks" className="text-sm text-zinc-600 hover:text-zinc-900">
      ← Back to Tasks
    </Link>
  );
}

function TransactionHeader({ txn }: { txn: Transaction }) {
  const sign = txn.direction === "inflow" ? "+" : "−";
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {formatDateShort(txn.date)}
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900">
            {txn.merchant}
          </h1>
          <div className="font-mono text-xs text-zinc-500">{txn.memo}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="font-mono text-2xl font-semibold tabular-nums">
            <span
              className={
                txn.direction === "inflow"
                  ? "text-emerald-700"
                  : "text-zinc-900"
              }
            >
              {sign}
              {formatCurrency(txn.amount)}
            </span>
          </div>
          <StatusBadge status={txn.status} />
        </div>
      </div>
    </div>
  );
}

function chatSuggestions(txn: Transaction): string[] {
  const m = txn.merchant.toLowerCase();
  // Founder reimbursements / draws / officer loans — match by id
  // since the parsed merchant is the recipient name (e.g. "J. Carter")
  // and doesn't carry semantic meaning.
  if (txn.id.includes("owner")) {
    return [
      "What if I want to record this as a loan instead?",
      "Tell me more about AFR rates and the IRS rule.",
      "What if it's part reimbursement, part bonus?",
    ];
  }
  if (m.includes("aws")) {
    return [
      "How should I split this between COGS and Software & Tech?",
      "Will this affect my reported gross margin?",
      "What % is typical for SaaS at our stage?",
    ];
  }
  if (m.includes("adp")) {
    return [
      "Was this run for employees or a contractor?",
      "What's the year-end 1099 implication?",
    ];
  }
  if (m.includes("stripe")) {
    return [
      "How should I handle refunds in the payout?",
      "Should I split processor fees out as COGS?",
    ];
  }
  if (m.includes("costco")) {
    return [
      "Why didn't you ask whether this was inventory?",
      "What would change your answer here?",
    ];
  }
  return [];
}

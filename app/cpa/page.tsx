"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { accountById } from "@/lib/fixtures";
import {
  effectiveTransaction,
  useActiveCompany,
  useAuditLog,
  useDecisions,
  useRules,
  useUserProfile,
} from "@/lib/store";
import type { AuditEvent, ConfidenceLevel, Transaction } from "@/lib/types";
import { cn, formatCurrency, formatDateShort } from "@/lib/utils";
import { AuditTrail } from "@/components/AuditTrail";
import { ConfidenceChip } from "@/components/ConfidenceChip";
import { StatusBadge } from "@/components/StatusBadge";

type FilterId =
  | "all"
  | "needs_review"
  | "low_conf"
  | "overrides"
  | "rule_applied"
  | "flagged";

const FILTERS: Array<{ id: FilterId; label: string }> = [
  { id: "all", label: "All" },
  { id: "needs_review", label: "Needs review" },
  { id: "low_conf", label: "Low-confidence resolves" },
  { id: "overrides", label: "Owner overrode agent" },
  { id: "rule_applied", label: "Rule auto-applied" },
  { id: "flagged", label: "Flagged for tax time" },
];

// Hardcoded period for the demo. In production this would come from
// the active books period (typically last completed month).
const PERIOD_LABEL = "April 2026";

export default function CpaPage() {
  const router = useRouter();
  const { company, hydrated } = useActiveCompany();
  const { profile, hydrated: profileHydrated } = useUserProfile();
  const { decisions } = useDecisions(company.id);
  const { events, eventsForTxn, append } = useAuditLog(company.id);
  const { rules } = useRules(company.id);
  const [filter, setFilter] = useState<FilterId>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Redirect non-CPA profiles to Tasks. The nav link is already hidden
  // for owners, but the route is still hittable directly — and switching
  // profiles while sitting on this page should also bounce them out.
  useEffect(() => {
    if (profileHydrated && profile !== "cpa") {
      router.replace("/tasks");
    }
  }, [profile, profileHydrated, router]);

  const allTxns = useMemo(() => {
    if (!hydrated) return [];
    const inbox = company.inbox.map((t) => effectiveTransaction(t, decisions));
    return [...company.history, ...inbox].sort((a, b) =>
      b.date.localeCompare(a.date),
    );
  }, [company, decisions, hydrated]);

  if (!hydrated || !profileHydrated) {
    return <div className="h-96 animate-pulse rounded-lg bg-zinc-100" />;
  }

  // While the redirect is in flight, render nothing to avoid a flash of
  // the CPA-only content for an owner.
  if (profile !== "cpa") {
    return null;
  }

  const counts = countByFilter(allTxns, decisions, eventsForTxn);
  const stats = computeStats(allTxns, decisions, events, rules);

  const filtered = allTxns.filter((t) =>
    matchesFilter(filter, t, decisions[t.id], eventsForTxn(t.id)),
  );

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const toggleFlag = (txn: Transaction) => {
    const now = new Date().toISOString();
    const isFlagged = txn.status === "flagged_for_cpa";
    append({
      id: `evt.${txn.id}.${now}.cpaflag`,
      txnId: txn.id,
      timestamp: now,
      type: isFlagged ? "cpa_unflagged" : "cpa_flagged",
      actor: "cpa",
      summary: isFlagged
        ? "CPA cleared the flag"
        : "CPA flagged for follow-up at tax time",
    });
  };

  const approveTxn = (txn: Transaction) => {
    const now = new Date().toISOString();
    append({
      id: `evt.${txn.id}.${now}.cpaapprove`,
      txnId: txn.id,
      timestamp: now,
      type: "cpa_approved",
      actor: "cpa",
      summary: "CPA reviewed and approved",
    });
  };

  const isApproved = (txnId: string): boolean =>
    eventsForTxn(txnId).some((e) => e.type === "cpa_approved");

  const handleSignOff = () => {
    if (
      !confirm(
        `Sign off all unapproved transactions in ${PERIOD_LABEL}? Each one gets a "CPA reviewed and approved" audit event.`,
      )
    )
      return;
    const now = Date.now();
    for (const t of allTxns) {
      if (isApproved(t.id)) continue;
      const ts = new Date(now + Math.random() * 1000).toISOString();
      append({
        id: `evt.${t.id}.${ts}.cpaapprove`,
        txnId: t.id,
        timestamp: ts,
        type: "cpa_approved",
        actor: "cpa",
        summary: `CPA signed off on ${PERIOD_LABEL}`,
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Page header — period framing, copy that says "month-end review" */}
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-zinc-900">
              CPA review
            </h1>
            <span className="rounded bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
              {PERIOD_LABEL}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-600">
            Month-end audit pass for{" "}
            <span className="font-medium text-zinc-900">
              {company.profile.name}
            </span>
            . Spot-check the agent&apos;s work, flag anything for follow-up,
            sign off when ready.
          </p>
        </div>
        <Link
          href="/tasks"
          className="text-sm text-zinc-600 hover:text-zinc-900"
        >
          ← Tasks
        </Link>
      </div>

      {/* Stats panel — audit metrics for the period */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Decisions in period"
          value={stats.totalDecided}
          subtitle={`of ${stats.total} transactions`}
        />
        <StatCard
          label="Auto-applied"
          value={stats.autoApplied}
          subtitle={
            stats.totalDecided > 0
              ? `${Math.round((stats.autoApplied / stats.totalDecided) * 100)}% of decisions`
              : "—"
          }
          accent="violet"
        />
        <StatCard
          label="Owner overrides"
          value={stats.overrides}
          subtitle="vs agent's pick"
          accent={stats.overrides > 0 ? "amber" : "zinc"}
        />
        <StatCard
          label="Flagged for tax time"
          value={stats.flagged}
          subtitle="awaiting your eyes"
          accent={stats.flagged > 0 ? "rose" : "zinc"}
        />
        <StatCard
          label="Active rules"
          value={stats.rules}
          subtitle="learned this period"
        />
      </div>

      {/* Sign-off banner */}
      <div className="flex items-center justify-between rounded-lg border border-violet-200 bg-violet-50 px-5 py-3">
        <div>
          <div className="text-sm font-semibold text-violet-900">
            {stats.unapproved === 0
              ? `${PERIOD_LABEL} signed off ✓`
              : `${stats.unapproved} transaction${stats.unapproved === 1 ? "" : "s"} awaiting CPA approval`}
          </div>
          <p className="text-xs text-violet-800">
            {stats.unapproved === 0
              ? "Every transaction has a CPA review event on its audit trail."
              : "Approve individually below, or sign off the whole period at once."}
          </p>
        </div>
        {stats.unapproved > 0 ? (
          <button
            onClick={handleSignOff}
            className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-violet-800"
          >
            Sign off period →
          </button>
        ) : null}
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count = counts[f.id] ?? 0;
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
                active
                  ? "border-violet-700 bg-violet-700 text-white"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
              )}
            >
              <span>{f.label}</span>
              <span
                className={cn(
                  "rounded px-1.5 text-[11px] font-semibold tabular-nums",
                  active
                    ? "bg-white/20 text-white"
                    : "bg-zinc-100 text-zinc-600",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center gap-4 border-b border-zinc-200 bg-zinc-50 px-6 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          <div className="w-16">Date</div>
          <div className="flex-1">Merchant</div>
          <div className="w-44">Category</div>
          <div className="w-32">Decided by</div>
          <div className="w-24 text-right">Amount</div>
          <div className="w-32 text-right">Status</div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-500">
            Nothing matches this filter.
          </div>
        ) : null}

        {filtered.map((txn) => {
          const account = txn.categoryId ? accountById(txn.categoryId) : null;
          const decision = decisions[txn.id];
          const decidedBy = decidedByLabel(txn, decision);
          const evts = eventsForTxn(txn.id);
          const isOpen = expanded.has(txn.id);
          const conf = decision?.hypothesisAtDecision?.confidence;
          const approved = evts.some((e) => e.type === "cpa_approved");

          return (
            <div
              key={txn.id}
              className={cn(
                "border-b border-zinc-100 last:border-b-0",
                approved ? "bg-emerald-50/30" : "",
              )}
            >
              <button
                onClick={() => toggleExpand(txn.id)}
                className="flex w-full items-center gap-4 px-6 py-3 text-left transition-colors hover:bg-zinc-50"
              >
                <div className="w-16 shrink-0 text-xs text-zinc-500">
                  {formatDateShort(txn.date)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-zinc-900">
                    {txn.merchant}
                  </div>
                  <div className="truncate font-mono text-xs text-zinc-500">
                    {txn.memo}
                  </div>
                </div>
                <div className="w-44 truncate text-sm text-zinc-700">
                  {account?.name ?? (
                    <span className="text-zinc-400">— uncategorized —</span>
                  )}
                </div>
                <div className="w-32">
                  <div className="text-xs text-zinc-600">{decidedBy}</div>
                  {conf ? (
                    <div className="mt-0.5">
                      <ConfidenceChip level={conf} />
                    </div>
                  ) : null}
                </div>
                <div className="w-24 text-right font-mono text-sm tabular-nums text-zinc-900">
                  {txn.direction === "inflow" ? "+" : "−"}
                  {formatCurrency(txn.amount)}
                </div>
                <div className="flex w-32 items-center justify-end gap-1.5">
                  {approved ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-inset ring-emerald-200"
                      title="CPA reviewed and approved"
                    >
                      ✓ Reviewed
                    </span>
                  ) : null}
                  <StatusBadge status={txn.status} />
                </div>
              </button>

              {isOpen ? (
                <div className="space-y-4 border-t border-zinc-100 bg-zinc-50 px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">
                      Audit trail
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/transactions/${txn.id}`}
                        className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
                      >
                        Open transaction
                      </Link>
                      <button
                        onClick={() => toggleFlag(txn)}
                        className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
                      >
                        {txn.status === "flagged_for_cpa"
                          ? "Clear flag"
                          : "Flag for follow-up"}
                      </button>
                      {!approved ? (
                        <button
                          onClick={() => approveTxn(txn)}
                          className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm hover:bg-emerald-700"
                        >
                          Approve
                        </button>
                      ) : (
                        <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
                          ✓ Approved
                        </span>
                      )}
                    </div>
                  </div>
                  <AuditTrail events={evts} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {rules.length > 0 ? <RulesSummary rules={rules} /> : null}
    </div>
  );
}

// ---- Stat card ----

function StatCard({
  label,
  value,
  subtitle,
  accent = "zinc",
}: {
  label: string;
  value: number | string;
  subtitle?: string;
  accent?: "zinc" | "violet" | "amber" | "rose";
}) {
  const accentClasses: Record<string, string> = {
    zinc: "text-zinc-900",
    violet: "text-violet-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
  };
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-mono text-2xl font-semibold tabular-nums",
          accentClasses[accent],
        )}
      >
        {value}
      </div>
      {subtitle ? (
        <div className="mt-0.5 text-[11px] text-zinc-500">{subtitle}</div>
      ) : null}
    </div>
  );
}

// ---- Stats compute ----

interface PeriodStats {
  total: number;
  totalDecided: number;
  autoApplied: number;
  overrides: number;
  flagged: number;
  rules: number;
  unapproved: number;
}

function computeStats(
  txns: Transaction[],
  decisions: Record<
    string,
    { hypothesisAtDecision?: { confidence?: ConfidenceLevel } }
  >,
  events: AuditEvent[],
  rules: ReturnType<typeof useRules>["rules"],
): PeriodStats {
  const decidedSet = new Set<string>();
  let autoApplied = 0;
  let overrides = 0;
  let flagged = 0;
  for (const t of txns) {
    if (t.status !== "needs_review") {
      decidedSet.add(t.id);
    }
    if (
      t.status === "auto_categorized" ||
      t.status === "rule_applied" ||
      t.source === "rule_applied" ||
      t.source === "agent_auto"
    ) {
      autoApplied++;
    }
    if (t.status === "flagged_for_cpa") {
      flagged++;
    }
  }
  for (const e of events) {
    if (e.type === "user_overrode") overrides++;
  }
  const approvedTxns = new Set(
    events.filter((e) => e.type === "cpa_approved").map((e) => e.txnId),
  );
  const unapproved = txns.filter((t) => !approvedTxns.has(t.id)).length;
  return {
    total: txns.length,
    totalDecided: decidedSet.size,
    autoApplied,
    overrides,
    flagged,
    rules: rules.filter((r) => !r.suspended).length,
    unapproved,
  };
}

// ---- Existing helpers ----

function decidedByLabel(
  txn: Transaction,
  decision: { hypothesisAtDecision?: unknown } | undefined,
): string {
  if (txn.status === "needs_review") return "—";
  if (txn.status === "auto_categorized") return "Agent (auto)";
  if (txn.status === "rule_applied") return "Auto (rule)";
  if (txn.status === "flagged_for_cpa") return "Owner (flagged)";
  if (decision) {
    return decision.hypothesisAtDecision ? "Owner (with agent)" : "Owner";
  }
  if (txn.source === "rule_applied") return "Auto (rule)";
  if (txn.source === "agent_auto") return "Agent";
  if (txn.source === "user_confirmed") return "Owner";
  return "—";
}

function countByFilter(
  txns: Transaction[],
  decisions: Record<
    string,
    { hypothesisAtDecision?: { confidence?: ConfidenceLevel } }
  >,
  eventsForTxn: (id: string) => AuditEvent[],
): Record<FilterId, number> {
  const out: Record<FilterId, number> = {
    all: txns.length,
    needs_review: 0,
    low_conf: 0,
    overrides: 0,
    rule_applied: 0,
    flagged: 0,
  };
  for (const t of txns) {
    if (matchesFilter("needs_review", t, decisions[t.id], eventsForTxn(t.id)))
      out.needs_review++;
    if (matchesFilter("low_conf", t, decisions[t.id], eventsForTxn(t.id)))
      out.low_conf++;
    if (matchesFilter("overrides", t, decisions[t.id], eventsForTxn(t.id)))
      out.overrides++;
    if (matchesFilter("rule_applied", t, decisions[t.id], eventsForTxn(t.id)))
      out.rule_applied++;
    if (matchesFilter("flagged", t, decisions[t.id], eventsForTxn(t.id)))
      out.flagged++;
  }
  return out;
}

function matchesFilter(
  filter: FilterId,
  txn: Transaction,
  decision:
    | { hypothesisAtDecision?: { confidence?: ConfidenceLevel } }
    | undefined,
  events: AuditEvent[],
): boolean {
  if (filter === "all") return true;
  if (filter === "needs_review") return txn.status === "needs_review";
  if (filter === "rule_applied")
    return txn.status === "rule_applied" || txn.source === "rule_applied";
  if (filter === "flagged") return txn.status === "flagged_for_cpa";
  if (filter === "low_conf")
    return decision?.hypothesisAtDecision?.confidence === "low";
  if (filter === "overrides")
    return events.some((e) => e.type === "user_overrode");
  return false;
}

function RulesSummary({
  rules,
}: {
  rules: ReturnType<typeof useRules>["rules"];
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        Active rules ({rules.length})
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Auto-categorize matching future transactions. Roll back any rule that
        looks wrong from the Vendor Review tab.
      </p>
      <ul className="mt-3 space-y-2">
        {rules.map((r) => (
          <li
            key={r.id}
            className={cn(
              "flex items-center justify-between rounded-md border px-3 py-2 text-sm",
              r.suspended
                ? "border-rose-200 bg-rose-50"
                : "border-zinc-200 bg-zinc-50",
            )}
          >
            <div>
              <div className="font-medium text-zinc-900">
                {r.merchant} → {accountById(r.accountId)?.name ?? r.accountId}
              </div>
              <div className="font-mono text-xs text-zinc-500">
                {r.scope === "merchant_amount_band"
                  ? `between $${r.amountMin?.toFixed(0)}–$${r.amountMax?.toFixed(0)}`
                  : "any amount"}
                {" · "}
                last confirmed{" "}
                {new Date(r.lastConfirmedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
                {" · "}applied {r.applicationsCount}×
              </div>
            </div>
            {r.suspended ? (
              <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-900">
                Suspended
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { accountById, isColdStart } from "@/lib/fixtures";
import {
  effectiveTransaction,
  useActiveCompany,
  useAuditLog,
  useCachedAgent,
  useDecisions,
  usePrefetchAgents,
  useRules,
  useUserProfile,
} from "@/lib/store";
import type { Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { pushToastExternal } from "@/components/ToastProvider";
import { EmptyHistoryNotice } from "@/components/EmptyHistoryNotice";
import { TransactionRow } from "@/components/TransactionRow";
import { VendorReviewView } from "@/components/VendorReviewView";

// The Tasks page — mimics Pilot's existing Tasks tab structure
// (Questions / Transaction Requests / Vendor Review). Transaction
// Requests is the agentic enhancement this take-home proposes.

type TabId = "questions" | "requests" | "vendor";

const TABS: Array<{ id: TabId; label: string; count?: () => number }> = [
  { id: "questions", label: "Questions" },
  { id: "requests", label: "Transaction Requests" },
  { id: "vendor", label: "Rules" },
];

export default function TasksPage() {
  const { company, hydrated } = useActiveCompany();
  const { decisions, recordDecision, clearDecision } = useDecisions(
    company.id,
  );
  const { append } = useAuditLog(company.id);
  const { cache } = useCachedAgent(company.id);
  const { rules, bumpRuleCount } = useRules(company.id);
  const { profile } = useUserProfile();
  const [tab, setTab] = useState<TabId>("requests");

  // Match an active rule against a transaction (same logic the agent
  // sees in its context's activeRules — but this fires deterministically
  // here, before any LLM call.)
  const matchRule = (txn: Transaction) =>
    rules.find(
      (r) =>
        !r.suspended &&
        r.merchant.toLowerCase() === txn.merchant.toLowerCase() &&
        (r.scope === "this_merchant" ||
          (r.scope === "merchant_amount_band" &&
            txn.amount >= (r.amountMin ?? 0) &&
            txn.amount <= (r.amountMax ?? Number.POSITIVE_INFINITY))),
    );

  // Don't waste LLM calls on transactions a rule will short-circuit.
  const reviewableIds = useMemo(() => {
    if (!hydrated) return [];
    return company.inbox
      .map((t) => effectiveTransaction(t, decisions))
      .filter((t) => {
        if (t.status !== "needs_review" && t.status !== "auto_categorized") return false;
        if (matchRule(t)) return false;
        return true;
      })
      .map((t) => t.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, decisions, hydrated, rules]);

  const { pending } = usePrefetchAgents(company.id, reviewableIds);

  // Auto-resolve undecided transactions:
  //   1. If an active rule matches → apply it (status: rule_applied).
  //   2. Else if the agent's prediction is high-confidence with no
  //      clarifying question → auto-categorize (status: auto_categorized).
  // Rules short-circuit the agent entirely — no LLM call needed.
  useEffect(() => {
    if (!hydrated) return;
    for (const t of company.inbox) {
      const existing = decisions[t.id];

      // Path 1: rule fires — takes priority, even over auto_categorized.
      // This lets a newly-created rule retroactively claim txns the agent
      // had already bucketed, so the rule auto-fire demo works end-to-end.
      const rule = matchRule(t);
      if (rule) {
        // Don't overwrite a user's explicit resolution or an existing rule.
        if (
          existing &&
          existing.status !== "auto_categorized"
        )
          continue;
        const decidedAt = new Date().toISOString();
        const accountName =
          accountById(rule.accountId)?.name ?? rule.accountId;
        recordDecision({
          txnId: t.id,
          categoryId: rule.accountId,
          status: "rule_applied",
          decidedAt,
          notes: `Rule fired: ${rule.merchant} → ${accountName}`,
        });
        append({
          id: `evt.${t.id}.${decidedAt}.rulefire`,
          txnId: t.id,
          timestamp: decidedAt,
          type: "rule_applied",
          actor: "system",
          summary: `Rule fired: ${rule.merchant} → ${accountName}`,
          detail: { ruleId: rule.id, accountId: rule.accountId },
        });
        bumpRuleCount(rule.id);
        continue;
      }

      // Path 2: agent auto-categorizes high-confidence calls.
      if (existing) continue;
      const cached = cache[t.id];
      if (!cached) continue;
      const h = cached.hypothesis;
      const eligible = h.confidence === "high" && !h.clarifyingQuestion;
      if (!eligible) continue;
      const decidedAt = new Date().toISOString();
      recordDecision({
        txnId: t.id,
        categoryId: h.accountId,
        status: "auto_categorized",
        decidedAt,
        hypothesisAtDecision: h,
      });
      append({
        id: `evt.${t.id}.${decidedAt}.auto`,
        txnId: t.id,
        timestamp: decidedAt,
        type: "agent_proposed",
        actor: "agent",
        summary: `Auto-categorized as ${accountById(h.accountId)?.name ?? h.accountId} (high confidence, score ${h.confidenceScore.toFixed(2)})`,
        detail: { accountId: h.accountId, hypothesis: h },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, company, cache, decisions, rules, recordDecision, append, bumpRuleCount]);

  if (!hydrated) {
    return <div className="h-96 animate-pulse rounded-lg bg-zinc-100" />;
  }

  const inbox = company.inbox.map((t) => effectiveTransaction(t, decisions));
  const needsReview = inbox
    .filter((t) => t.status === "needs_review")
    .sort((a, b) => b.amount - a.amount);
  const auto = inbox
    .filter((t) => t.status === "auto_categorized")
    .sort((a, b) => b.amount - a.amount);
  const otherDecided = inbox
    .filter(
      (t) =>
        t.status === "resolved_by_user" ||
        t.status === "rule_applied" ||
        t.status === "flagged_for_cpa",
    )
    .sort((a, b) => b.amount - a.amount);

  const cold = isColdStart(company);
  const activeRulesCount = rules.filter((r) => !r.suspended).length;
  const counts = {
    questions: 0,
    requests: needsReview.length,
    vendor: activeRulesCount,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Tasks</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Things Pilot needs from you for{" "}
          <span className="font-medium text-zinc-900">
            {company.profile.name}
          </span>
          .
        </p>
      </div>

      <div className="border-b border-zinc-200">
        <div className="flex gap-1">
          {TABS.map((t) => {
            const active = tab === t.id;
            const count = counts[t.id];
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-3 pb-2.5 pt-1 text-sm transition-colors",
                  active
                    ? "border-violet-700 font-semibold text-violet-700"
                    : "border-transparent text-zinc-600 hover:text-zinc-900",
                )}
              >
                <span>{t.label}</span>
                {count > 0 ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                      active
                        ? "bg-violet-100 text-violet-700"
                        : "bg-zinc-100 text-zinc-600",
                    )}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "questions" ? <QuestionsStub /> : null}
      {tab === "vendor" ? <VendorReviewView /> : null}

      {tab === "requests" ? (
        <div className="space-y-6">
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-violet-500" />
              <div className="text-sm text-violet-900">
                <span className="font-medium">
                  AI-assisted transaction review (proposed)
                </span>{" "}
                — Pilot&apos;s agent forms a hypothesis on every flagged
                transaction, auto-applies high-confidence calls, and only
                surfaces the genuinely ambiguous ones to you. Your decisions
                train the agent and are recorded on the audit trail.
              </div>
            </div>
          </div>

          {cold ? <EmptyHistoryNotice company={company} /> : null}

          <Section
            title="Needs your review"
            count={needsReview.length}
            emptyState={
              <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-500">
                All clear. The agent didn&apos;t find anything ambiguous in
                this batch.
              </div>
            }
          >
            {needsReview.map((txn) => (
              <TransactionRow
                key={txn.id}
                txn={txn}
                prediction={cache[txn.id]?.hypothesis}
                predictionPending={pending.has(txn.id)}
                companyId={company.id}
              />
            ))}
          </Section>

          {auto.length > 0 ? (
            <Section
              title="Auto-categorized by agent"
              subtitle="Validate or override below"
              count={auto.length}
              actions={
                <button
                  onClick={() => {
                    const actorLabel = profile === "cpa" ? "CPA" : "Owner";
                    const undoIds: string[] = [];
                    for (const t of auto) {
                      const cached = cache[t.id];
                      if (!cached) continue;
                      const decidedAt = new Date().toISOString();
                      recordDecision({
                        txnId: t.id,
                        categoryId: cached.hypothesis.accountId,
                        status: "resolved_by_user",
                        decidedAt,
                        hypothesisAtDecision: cached.hypothesis,
                      });
                      append({
                        id: `evt.${t.id}.${decidedAt}.bulk`,
                        txnId: t.id,
                        timestamp: decidedAt,
                        type: "user_confirmed",
                        actor: profile,
                        summary: `${actorLabel} bulk-confirmed ${accountById(cached.hypothesis.accountId)?.name ?? cached.hypothesis.accountId}`,
                        detail: { accountId: cached.hypothesis.accountId },
                      });
                      undoIds.push(t.id);
                    }
                    if (undoIds.length === 0) return;
                    pushToastExternal({
                      message: `Confirmed ${undoIds.length} auto-categorization${undoIds.length === 1 ? "" : "s"}`,
                      detail: "Each one logged to the audit trail",
                      actionLabel: "Undo",
                      onAction: () => {
                        const undoAt = new Date().toISOString();
                        for (const id of undoIds) {
                          clearDecision(id);
                          append({
                            id: `evt.${id}.${undoAt}.bulkundo`,
                            txnId: id,
                            timestamp: undoAt,
                            type: "user_reopened",
                            actor: profile,
                            summary: `${actorLabel} undid the bulk confirmation`,
                          });
                        }
                      },
                    });
                  }}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 shadow-sm hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                >
                  Confirm all {auto.length}
                </button>
              }
            >
              {auto.map((txn) => (
                <TransactionRow
                  key={txn.id}
                  txn={txn}
                  prediction={cache[txn.id]?.hypothesis}
                  companyId={company.id}
                />
              ))}
            </Section>
          ) : null}

          {otherDecided.length > 0 ? (
            <Section title="Already actioned" count={otherDecided.length}>
              {otherDecided.map((txn) => (
                <TransactionRow
                  key={txn.id}
                  txn={txn}
                  prediction={cache[txn.id]?.hypothesis}
                />
              ))}
            </Section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ---- Sections ----

function Section({
  title,
  subtitle,
  count,
  actions,
  children,
  emptyState,
}: {
  title: string;
  subtitle?: string;
  count: number;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  emptyState?: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {title}
        </h2>
        <span className="font-mono text-xs text-zinc-400">{count}</span>
        {subtitle ? (
          <span className="ml-2 text-xs text-zinc-500">{subtitle}</span>
        ) : null}
        {actions ? <div className="ml-auto">{actions}</div> : null}
      </div>
      {count === 0 && emptyState ? (
        emptyState
      ) : (
        <>
          <ColumnHeader />
          <div className="space-y-2">{children}</div>
        </>
      )}
    </div>
  );
}

// Column labels above the cards. Aligned to the card's internal
// columns: date (w-16), vendor (flex-1), category (w-56), amount
// (w-28). Skips the help-icon and arrow micro-columns.
function ColumnHeader() {
  return (
    <div className="mb-1.5 flex items-center gap-4 px-5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
      <div className="w-16">Date</div>
      <div className="flex-1">Vendor</div>
      <div className="w-56">Category</div>
      <div className="w-7 shrink-0" />
      <div className="w-28 text-right">Amount</div>
      <div className="w-4 shrink-0" />
    </div>
  );
}

// ---- Stubs for the other Tasks tabs ----

function QuestionsStub() {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">
        No open questions
      </h2>
      <p className="mt-1 text-sm text-zinc-600">
        Questions from your bookkeeping team would appear here. This tab is
        unchanged from the existing Pilot product — the agentic enhancement
        in this prototype lives in the{" "}
        <span className="font-medium text-zinc-900">Transaction Requests</span>{" "}
        tab.
      </p>
    </div>
  );
}


// Unused but keeps types happy if/when we wire counts into the tab list.
export function _markType(_t: Transaction) {
  return _t.id;
}
